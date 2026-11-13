/**
 * Handwriting transcription eval: runs the app's real transcriber + prompt over
 * pages of a dataset and scores the text against a human reference.
 *
 *   npx tsx scripts/eval.ts --dataset eval/l8-workflow --provider ollama --model qwen2.5vl:3b
 *   npx tsx scripts/eval.ts --dataset eval/l8-workflow --provider openrouter --model dots-studio/dots-3-note-preview:free
 *
 * Dataset layout (see scripts/pdf_to_strokes.py):
 *   strokes.json          pages → InkStroke[] in canvas px
 *   pages/page-N.png      raster of the original page (pdftoppm)
 *   pages/centerline-N.png re-rendering of the extracted strokes
 *   reference.md          ground truth, pages separated by `<!-- page N -->`; a page may end with a
 *                         ```json figures fence listing expected diagrams (see src/sim/metrics.ts),
 *                         which adds figure recall / text leak / label recall to the scores.
 * Results go to <dataset>/results/<run>/page-N.json + summary.md
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { InkStroke } from '../src/model/page';
import { sortBlocksForReading } from '../src/model/page';
import { buildStrokeGroups, mergeBlocks, rawToDigitalBlock, reconcileFigureBlocks } from '../src/transcribe/regions';
import { OpenRouterTranscriber } from '../src/transcribe/openrouter';
import { OllamaTranscriber } from '../src/transcribe/ollama';
import type { StrokeGroupMeta, TranscribeRequest, Transcriber } from '../src/transcribe/types';
import { MODEL_RENDER, renderStrokesToPng, type CanvasFactory } from '../src/transcribe/render';
import { unionBounds } from '../src/model/page';
import { createCanvas } from '@napi-rs/canvas';
import { Agent, setGlobalDispatcher } from 'undici';

// CPU inference can take >5 min per page; lift Node's default 300 s headers timeout.
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

const nodeCanvas: CanvasFactory = (w, h) => createCanvas(w, h) as unknown as ReturnType<CanvasFactory>;
import { ModelOutputError } from '../src/transcribe/prompt';
import { resolveFigureRefs } from '../src/transcribe/figure';
import { diagramMetrics, parseReferencePage, pct, relationMetrics, type DiagramMetrics, type RelationMetrics } from '../src/sim/metrics';

export interface Args {
  dataset: string;
  provider: 'ollama' | 'openrouter';
  model: string;
  prompt?: 'compact' | 'full';
  pages?: number[];
  /** pdf = raster of the original page; strokes = the app's own rendering of the extracted ink. */
  image: 'pdf' | 'strokes';
  /** 0 = whole page in one request; N = horizontal bands of N line-groups rendered from strokes (how the app works). */
  band: number;
  /** Extra neighbouring line-groups rendered around each band for context; only blocks on the band's strokes are kept. */
  context: number;
  /** Stroke rendering for stroke-based requests: model = MODEL_RENDER (what the app sends), original = user's ink. */
  render: 'model' | 'original';
  /** Directory (under the dataset) holding page-N.png rasters; e.g. pages220 for a 220 dpi render. */
  raster: string;
  run?: string;
  url: string;
  /** Only score pages generated at this messiness (`neat|normal|messy`; synthetic datasets record it in reference.md). */
  messiness?: string;
  /** Apply the app's geometry reconciliation (reconcileFigureBlocks) to the model's blocks, as the live app does. `--reconcile 0` scores raw model output. */
  reconcile: boolean;
}

export function parseArgs(): Args {
  const a: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  const provider = (a.provider ?? 'ollama') as Args['provider'];
  return {
    dataset: a.dataset ?? 'eval/l8-workflow',
    provider,
    model: a.model ?? (provider === 'ollama' ? 'qwen2.5vl:3b' : 'dots-studio/dots-3-note-preview:free'),
    pages: a.pages ? a.pages.split(',').map(Number) : undefined,
    prompt: a.prompt === 'compact' || a.prompt === 'full' ? a.prompt : undefined,
    image: (a.image as Args['image']) ?? 'pdf',
    band: Number(a.band ?? 0),
    context: Number(a.context ?? 0),
    render: (a.render as Args['render']) ?? 'model',
    raster: a.raster ?? 'pages',
    run: a.run,
    url: a.url ?? 'http://localhost:11434',
    messiness: a.messiness,
    reconcile: !(a.reconcile === '0' || a.reconcile === 'off' || a.reconcile === 'false'),
  };
}

/** Sums over pages, for the total row, one scene kind, or one dataset. */
export interface Agg {
  pages: number;
  textPages: number;
  wer: number;
  cer: number;
  figures: number;
  detected: number;
  figureStrokes: number;
  leaked: number;
  labels: number;
  labelsFound: number;
  spurious: number;
  edges: number;
  edgesFound: number;
  predicted: number;
  predictedMatched: number;
  sequences: number;
  sequencesExact: number;
  steps: number;
  stepsFound: number;
  tauSum: number;
  tauN: number;
  /** Sequences scored against the structured `figure.sequence` rather than caption text. */
  sequencesStructured: number;
  contains: number;
  containsFound: number;
  /** Pages whose containment was scored against structured `figure.nodes` parents. */
  containsStructuredPages: number;
  /** Pages with expected figures, and how many had exactly that many diagram blocks. */
  countPages: number;
  countExact: number;
}

export function emptyAgg(): Agg {
  return { pages: 0, textPages: 0, wer: 0, cer: 0, figures: 0, detected: 0, figureStrokes: 0, leaked: 0, labels: 0, labelsFound: 0, spurious: 0, edges: 0, edgesFound: 0, predicted: 0, predictedMatched: 0, sequences: 0, sequencesExact: 0, steps: 0, stepsFound: 0, tauSum: 0, tauN: 0, sequencesStructured: 0, contains: 0, containsFound: 0, containsStructuredPages: 0, countPages: 0, countExact: 0 };
}

export function addAgg(into: Agg, from: Agg): Agg {
  for (const k of Object.keys(into) as (keyof Agg)[]) into[k] += from[k];
  return into;
}

function accumulate(a: Agg, s: { wer: number; cer: number } | null, figures: { strokeIds: string[] }[], dm: DiagramMetrics, rm: RelationMetrics): void {
  a.pages++;
  if (s) { a.textPages++; a.wer += s.wer; a.cer += s.cer; }
  const figureStrokes = figures.reduce((t, f) => t + f.strokeIds.length, 0);
  a.figures += dm.figures; a.detected += dm.detected; a.figureStrokes += figureStrokes;
  a.leaked += Math.round((dm.textLeak ?? 0) * figureStrokes); a.labels += dm.labels; a.labelsFound += dm.labelsFound; a.spurious += dm.spuriousDiagrams;
  a.edges += rm.edges; a.edgesFound += rm.edgesFound; a.predicted += rm.predicted; a.predictedMatched += rm.predictedMatched;
  a.sequences += rm.sequences; a.sequencesExact += rm.sequencesExact; a.steps += rm.steps; a.stepsFound += rm.stepsFound;
  if (rm.sequenceTau !== null) { a.tauSum += rm.sequenceTau; a.tauN++; }
  a.sequencesStructured += rm.sequencesStructured;
  a.contains += rm.contains; a.containsFound += rm.containsFound;
  if (rm.contains && rm.containsStructured) a.containsStructuredPages++;
  if (figures.length) { a.countPages++; if (rm.figureCountExact) a.countExact++; }
}

const ratio = (a: number, b: number) => (b ? a / b : null);
const frac = (a: number, b: number) => (b ? `${a}/${b} (${pct(ratio(a, b))})` : '—');

export const AGG_HEADER = [
  '| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
];

/** One Markdown row of aggregate scores. */
export function aggRow(name: string, a: Agg): string {
  const cells = [
    name,
    String(a.pages),
    a.textPages ? (a.wer / a.textPages).toFixed(3) : '—',
    a.textPages ? (a.cer / a.textPages).toFixed(3) : '—',
    frac(a.detected, a.figures),
    a.figures ? pct(ratio(a.leaked, a.figureStrokes)) : '—',
    frac(a.labelsFound, a.labels),
    frac(a.edgesFound, a.edges),
    frac(a.predictedMatched, a.predicted),
    frac(a.sequencesExact, a.sequences),
    a.tauN ? (a.tauSum / a.tauN).toFixed(2) : '—',
    frac(a.containsFound, a.contains),
    frac(a.countExact, a.countPages),
  ];
  return `| ${cells.join(' | ')} |`;
}

export const METRIC_NOTES =
  'figures found = a `diagram` block covers ≥80 % of the figure\'s strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · ' +
  'edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · ' +
  'sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · ' +
  'figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.';

export interface EvalResult {
  run: string;
  outDir: string;
  total: Agg;
  byKind: Record<string, Agg>;
}

function pngSize(buf: Buffer) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function referencePages(md: string): Map<number, string> {
  const out = new Map<number, string>();
  const parts = md.split(/<!--\s*page\s+(\d+)\s*-->/);
  for (let i = 1; i < parts.length; i += 2) out.set(Number(parts[i]), parts[i + 1].trim());
  return out;
}

/** Normalise for scoring: lowercase, drop markdown/bullets/arrows/punctuation, collapse spaces. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_#>|]/g, ' ')
    .replace(/\[(x| )\]/g, ' ')
    .replace(/[→⇒⟶↳↪➔➜➝➞➡]/g, ' ')
    .replace(/[“”"'’‘.,;:!?(){}…★—–[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein<T>(a: T[], b: T[]): number {
  const prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function score(hyp: string, ref: string) {
  const h = normalise(hyp), r = normalise(ref);
  const hw = h ? h.split(' ') : [], rw = r.split(' ');
  return {
    wer: +(levenshtein(hw, rw) / Math.max(1, rw.length)).toFixed(3),
    cer: +(levenshtein([...h], [...r]) / Math.max(1, r.length)).toFixed(3),
    refWords: rw.length,
    hypWords: hw.length,
  };
}

export async function runEval(args: Args): Promise<EvalResult> {
  const data = JSON.parse(readFileSync(join(args.dataset, 'strokes.json'), 'utf8')) as { source: string; pages: { index: number; width: number; height: number; strokes: InkStroke[] }[] };
  const refs = referencePages(readFileSync(join(args.dataset, 'reference.md'), 'utf8'));
  const run = args.run ?? `${args.provider}-${args.model.replace(/[^a-z0-9.]+/gi, '_')}-${args.band ? `band${args.band}${args.context ? `ctx${args.context}` : ''}` : args.image}${args.band || args.image === 'strokes' ? `-${args.render}` : ''}${args.raster !== 'pages' ? `-${args.raster}` : ''}${args.reconcile ? '' : '-raw'}${args.messiness ? `-${args.messiness}` : ''}`;
  const outDir = join(args.dataset, 'results', run);
  mkdirSync(outDir, { recursive: true });

  const transcriber: Transcriber =
    args.provider === 'ollama'
      ? new OllamaTranscriber({ url: args.url, model: args.model, promptStyle: args.prompt })
      : new OpenRouterTranscriber({ apiKey: process.env.OPENROUTER_API_KEY ?? process.env.VITE_OPENROUTER_API_KEY ?? '', model: args.model, siteName: 'InkMind eval' });

  const rows: string[] = [];
  const rawLog = new Map<number, string>();
  const total = emptyAgg();
  const byKind: Record<string, Agg> = {};
  for (const page of data.pages) {
    if (args.pages && !args.pages.includes(page.index)) continue;
    const refPage = refs.get(page.index);
    if (!refPage) continue;
    const { text: ref, figures, meta } = parseReferencePage(refPage);
    if (args.messiness && (meta.messiness ?? 'normal') !== args.messiness) continue;
    const kind = meta.kind ?? 'page';
    const pageTag = `${kind}${meta.messiness && meta.messiness !== 'normal' ? ` (${meta.messiness})` : ''}`;
    const pageGroups = buildStrokeGroups(page.strokes);
    const byId = new Map(page.strokes.map((st) => [st.id, st]));
    const title = data.source.replace(/\.pdf$/i, '');
    const profile = { glossary: [], habits: [], examples: [] };

    // One request per band (or one for the whole page). Each band is rendered from strokes
    // exactly like the app renders a dirty region, and gets the previous band's text as context.
    const bands: { target: StrokeGroupMeta[]; all: StrokeGroupMeta[] }[] = [];
    if (args.band > 0) {
      for (let i = 0; i < pageGroups.length; i += args.band) {
        bands.push({ target: pageGroups.slice(i, i + args.band), all: pageGroups.slice(Math.max(0, i - args.context), i + args.band + args.context) });
      }
    } else bands.push({ target: pageGroups, all: pageGroups });

    process.stderr.write(`page ${page.index}: ${page.strokes.length} strokes, ${pageGroups.length} groups, ${bands.length} request(s) → ${transcriber.name} … `);
    const started = Date.now();
    const result: { blocks: ReturnType<typeof rawToDigitalBlock>[]; model: string; durationMs: number } = { blocks: [], model: transcriber.name, durationMs: 0 };
    let context = '';
    let failed = false;
    for (const band of bands) {
      const strokes = band.all.flatMap((g) => g.strokeIds.map((id) => byId.get(id)!));
      const targetIds = new Set(band.target.flatMap((g) => g.strokeIds));
      const targetBounds = band.target.map((g) => g.bbox).reduce(unionBounds);
      let req: TranscribeRequest;
      if (args.band === 0 && args.image === 'pdf') {
        const png = readFileSync(join(args.dataset, args.raster, `page-${page.index}.png`));
        req = {
          imageDataUrl: `data:image/png;base64,${png.toString('base64')}`,
          imageBounds: { left: 0, top: 0, right: page.width, bottom: page.height },
          imageSize: pngSize(png),
          strokes: page.strokes,
          groups: pageGroups,
          contextText: '',
          pageTitle: title,
          profile,
        };
      } else {
        const rendered = renderStrokesToPng(strokes, band.all.map((g) => g.bbox).reduce(unionBounds), { createCanvas: nodeCanvas, ...(args.render === 'model' ? MODEL_RENDER : {}) });
        if (!rendered) continue;
        req = {
          imageDataUrl: rendered.dataUrl,
          imageBounds: rendered.bounds,
          imageSize: rendered.size,
          strokes,
          groups: buildStrokeGroups(strokes),
          contextText: context,
          pageTitle: title,
          profile,
        };
      }
      try {
        const r = await transcriber.transcribe(req);
        result.durationMs += r.durationMs;
        if (r.raw) {
          rawLog.set(page.index, (rawLog.get(page.index) ?? '') + r.raw + '\n---\n');
          writeFileSync(join(outDir, `page-${page.index}.raw.txt`), rawLog.get(page.index)!);
        }
        const mapped = r.blocks
          .map((b) => rawToDigitalBlock(b, req.groups, req.imageBounds, req.imageSize, req.strokes))
          .filter((b) => {
            if (args.band === 0) return true;
            if (b.strokeIds.length) return b.strokeIds.some((id) => targetIds.has(id));
            const cy = (b.bbox.top + b.bbox.bottom) / 2;
            return cy >= targetBounds.top - 10 && cy <= targetBounds.bottom + 10;
          });
        // With --context a block spanning a band boundary is returned by both bands; keep the first,
        // unless the later one is the only transcription of some target strokes.
        const seen = new Set(result.blocks.flatMap((b) => b.strokeIds));
        for (const b of mapped) {
          const shared = b.strokeIds.filter((id) => seen.has(id)).length;
          const bringsNewTarget = b.strokeIds.some((id) => targetIds.has(id) && !seen.has(id));
          if (b.strokeIds.length && shared / b.strokeIds.length > 0.5 && !bringsNewTarget) continue;
          b.strokeIds.forEach((id) => seen.add(id));
          result.blocks.push(b);
        }
        context = mapped.map((b) => b.text).join('\n').slice(-600);
      } catch (e) {
        const cause = (e as { cause?: { message?: string; code?: string } }).cause;
        process.stderr.write(`ERROR ${(e as Error).message}${cause ? ` (${cause.code ?? ''} ${cause.message ?? ''})` : ''}\n`);
        if (e instanceof ModelOutputError) writeFileSync(join(outDir, `page-${page.index}.raw.txt`), e.raw);
        failed = true;
        break;
      }
    }
    if (failed) {
      rows.push(`| ${page.index} | ${pageTag} | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |`);
      continue;
    }
    // Same post-processing as useTranscription on a fresh page: geometry reconciliation (figure groups from
    // shape hints), unclaimed strokes attached to the last block, then mergeBlocks into an empty page.
    let incoming = args.reconcile ? reconcileFigureBlocks(result.blocks, pageGroups, page.strokes) : result.blocks;
    if (args.reconcile) {
      const claimed = new Set(incoming.flatMap((b) => b.strokeIds));
      const unclaimed = page.strokes.filter((st) => !claimed.has(st.id)).map((st) => st.id);
      if (unclaimed.length && incoming.length) {
        incoming = [...incoming];
        incoming[incoming.length - 1] = { ...incoming[incoming.length - 1], strokeIds: [...incoming[incoming.length - 1].strokeIds, ...unclaimed] };
      }
      incoming = mergeBlocks([], [], incoming);
    }
    const blocks = sortBlocksForReading(incoming);
    const hyp = blocks.filter((b) => b.kind !== 'diagram').map((b) => b.text).join('\n');
    const s = score(hyp, ref);
    const dm: DiagramMetrics = diagramMetrics(figures, blocks);
    const rm: RelationMetrics = relationMetrics(figures, blocks.map((b) => b.figure ? { ...b, figure: resolveFigureRefs(b.figure) } : b));
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    process.stderr.write(`${secs}s WER ${s.wer} CER ${s.cer} (${blocks.length} blocks)${figures.length ? ` figures ${dm.detected}/${dm.figures} leak ${pct(dm.textLeak)} labels ${dm.labelsFound}/${dm.labels}` : ''}${rm.edges ? ` edges ${rm.edgesFound}/${rm.edges} (P ${rm.predictedMatched}/${rm.predicted})` : ''}${rm.sequences ? ` seq ${rm.sequencesExact}/${rm.sequences} τ ${rm.sequenceTau ?? '—'}` : ''}${rm.contains ? ` nesting ${rm.containsFound}/${rm.contains}` : ''}\n`);
    writeFileSync(join(outDir, `page-${page.index}.json`), JSON.stringify({ model: result.model, durationMs: result.durationMs, kind, messiness: meta.messiness, score: s, diagrams: dm, relations: rm, blocks, hyp, ref }, null, 2));
    const kinds = Object.entries(blocks.reduce<Record<string, number>>((m, b) => ((m[b.kind] = (m[b.kind] ?? 0) + 1), m), {})).map(([k, v]) => `${k}:${v}`).join(', ');
    const textCell = ref ? `${s.wer} | ${s.cer}` : '— | —';
    const figCell = figures.length ? `${dm.detected}/${dm.figures} | ${pct(dm.textLeak)} | ${dm.labels ? `${dm.labelsFound}/${dm.labels}` : '—'}` : '— | — | —';
    const relCell = [
      rm.edges ? `${rm.edgesFound}/${rm.edges} · P ${rm.predictedMatched}/${rm.predicted}` : '—',
      rm.sequences ? `${rm.sequencesExact}/${rm.sequences} τ ${rm.sequenceTau ?? '—'}` : '—',
      rm.contains ? `${rm.containsFound}/${rm.contains}` : '—',
      figures.length ? `${rm.diagramBlocks}/${rm.expectedFigures} ${rm.figureCountExact ? '✓' : '✗'}` : '—',
    ].join(' | ');
    const captions = dm.perFigure.filter((f) => f.caption).map((f) => `${f.type}: “${f.caption.replace(/\|/g, '/').slice(0, 80)}”`).join('; ');
    rows.push(`| ${page.index} | ${pageTag} | ${textCell} | ${figCell} | ${relCell} | ${blocks.length} blocks (${kinds})${dm.spuriousDiagrams ? `, ${dm.spuriousDiagrams} spurious diagram(s)` : ''}, ${secs}s${captions ? ` · ${captions}` : ''} |`);
    const pageAgg = emptyAgg();
    accumulate(pageAgg, ref ? s : null, figures, dm, rm);
    addAgg(total, pageAgg);
    addAgg((byKind[kind] ??= emptyAgg()), pageAgg);
  }
  const kindRows = Object.keys(byKind).length > 1 ? Object.entries(byKind).sort(([a], [b]) => a.localeCompare(b)).map(([k, a]) => aggRow(k, a)) : [];
  const summary = [
    `# ${run}`,
    '',
    `Transcriber: \`${transcriber.name}\` · image: ${args.band ? `band ${args.band} (+${args.context} ctx)` : args.image} · render: ${args.band || args.image === 'strokes' ? args.render : 'pdf raster'} · reconcile: ${args.reconcile ? 'on' : 'off'}${args.messiness ? ` · messiness: ${args.messiness}` : ''} · ${new Date().toISOString()}`,
    '',
    '| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    ...AGG_HEADER,
    ...kindRows,
    aggRow('**total**', total),
    '',
    total.figures ? METRIC_NOTES : '',
    '',
  ].join('\n');
  writeFileSync(join(outDir, 'summary.md'), summary);
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ run, total, byKind }, null, 2));
  console.log(summary);
  return { run, outDir, total, byKind };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void runEval(parseArgs());
