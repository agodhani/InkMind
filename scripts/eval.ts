/**
 * Handwriting transcription eval: runs the app's real transcriber + prompt over
 * pages of a dataset and scores the text against a human reference.
 *
 *   npx tsx scripts/eval.ts --dataset eval/l8-workflow --provider ollama --model qwen2.5vl:3b
 *   npx tsx scripts/eval.ts --dataset eval/l8-workflow --provider openrouter --model google/gemma-4-31b-it:free
 *
 * Dataset layout (see scripts/pdf_to_strokes.py):
 *   strokes.json          pages → InkStroke[] in canvas px
 *   pages/page-N.png      raster of the original page (pdftoppm)
 *   pages/centerline-N.png re-rendering of the extracted strokes
 *   reference.md          ground truth, pages separated by `<!-- page N -->`
 * Results go to <dataset>/results/<run>/page-N.json + summary.md
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InkStroke } from '../src/model/page';
import { sortBlocksForReading } from '../src/model/page';
import { buildStrokeGroups, rawToDigitalBlock } from '../src/transcribe/regions';
import { OpenAICompatTranscriber } from '../src/transcribe/openaiCompat';
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

interface Args {
  dataset: string;
  provider: 'ollama' | 'openrouter';
  model: string;
  pages?: number[];
  /** pdf = raster of the original page; strokes = the app's own rendering of the extracted ink. */
  image: 'pdf' | 'strokes';
  /** 0 = whole page in one request; N = horizontal bands of N line-groups rendered from strokes (how the app works). */
  band: number;
  /** Extra neighbouring line-groups rendered around each band for context; only blocks on the band's strokes are kept. */
  context: number;
  /** Stroke rendering for stroke-based requests: model = MODEL_RENDER (what the app sends), original = user's ink. */
  render: 'model' | 'original';
  run?: string;
  url: string;
}

function parseArgs(): Args {
  const a: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  const provider = (a.provider ?? 'ollama') as Args['provider'];
  return {
    dataset: a.dataset ?? 'eval/l8-workflow',
    provider,
    model: a.model ?? (provider === 'ollama' ? 'qwen2.5vl:3b' : 'google/gemma-4-31b-it:free'),
    pages: a.pages ? a.pages.split(',').map(Number) : undefined,
    image: (a.image as Args['image']) ?? 'pdf',
    band: Number(a.band ?? 0),
    context: Number(a.context ?? 0),
    render: (a.render as Args['render']) ?? 'model',
    run: a.run,
    url: a.url ?? 'http://localhost:11434',
  };
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

async function main() {
  const args = parseArgs();
  const data = JSON.parse(readFileSync(join(args.dataset, 'strokes.json'), 'utf8')) as { source: string; pages: { index: number; width: number; height: number; strokes: InkStroke[] }[] };
  const refs = referencePages(readFileSync(join(args.dataset, 'reference.md'), 'utf8'));
  const run = args.run ?? `${args.provider}-${args.model.replace(/[^a-z0-9.]+/gi, '_')}-${args.band ? `band${args.band}${args.context ? `ctx${args.context}` : ''}` : args.image}${args.band || args.image === 'strokes' ? `-${args.render}` : ''}`;
  const outDir = join(args.dataset, 'results', run);
  mkdirSync(outDir, { recursive: true });

  const transcriber: Transcriber =
    args.provider === 'ollama'
      ? new OllamaTranscriber({ url: args.url, model: args.model })
      : new OpenAICompatTranscriber({ provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: args.model, apiKey: process.env.OPENROUTER_API_KEY ?? process.env.VITE_OPENROUTER_API_KEY, headers: { 'X-Title': 'InkMind eval' } });

  const rows: string[] = [];
  const rawLog = new Map<number, string>();
  let totWer = 0, totCer = 0, n = 0;
  for (const page of data.pages) {
    if (args.pages && !args.pages.includes(page.index)) continue;
    const ref = refs.get(page.index);
    if (!ref) continue;
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
        const png = readFileSync(join(args.dataset, 'pages', `page-${page.index}.png`));
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
        // With --context a block spanning a band boundary is returned by both bands; keep the first.
        const seen = new Set(result.blocks.flatMap((b) => b.strokeIds));
        for (const b of mapped) {
          const shared = b.strokeIds.filter((id) => seen.has(id)).length;
          if (b.strokeIds.length && shared / b.strokeIds.length > 0.5) continue;
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
      rows.push(`| ${page.index} | — | — | error (see .raw.txt) |`);
      continue;
    }
    const blocks = sortBlocksForReading(result.blocks);
    const hyp = blocks.filter((b) => b.kind !== 'diagram').map((b) => b.text).join('\n');
    const s = score(hyp, ref);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    process.stderr.write(`${secs}s WER ${s.wer} CER ${s.cer} (${blocks.length} blocks)\n`);
    writeFileSync(join(outDir, `page-${page.index}.json`), JSON.stringify({ model: result.model, durationMs: result.durationMs, score: s, blocks, hyp, ref }, null, 2));
    rows.push(`| ${page.index} | ${s.wer} | ${s.cer} | ${blocks.length} blocks (${Object.entries(blocks.reduce<Record<string, number>>((m, b) => ((m[b.kind] = (m[b.kind] ?? 0) + 1), m), {})).map(([k, v]) => `${k}:${v}`).join(', ')}), ${secs}s |`);
    totWer += s.wer; totCer += s.cer; n++;
  }
  const summary = [
    `# ${run}`,
    '',
    `Transcriber: \`${transcriber.name}\` · image: ${args.band ? `band ${args.band} (+${args.context} ctx)` : args.image} · render: ${args.band || args.image === 'strokes' ? args.render : 'pdf raster'} · ${new Date().toISOString()}`,
    '',
    '| page | WER | CER | notes |',
    '|---|---|---|---|',
    ...rows,
    n ? `| **mean** | **${(totWer / n).toFixed(3)}** | **${(totCer / n).toFixed(3)}** | ${n} pages |` : '',
    '',
  ].join('\n');
  writeFileSync(join(outDir, 'summary.md'), summary);
  console.log(summary);
}

void main();
