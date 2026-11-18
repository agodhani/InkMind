import { isDeepStrictEqual } from 'node:util';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { DigitalBlock, Page } from '../src/model/page';
import { deterministicExtractor } from '../src/kb/extractor';
import type { Extractor } from '../src/kb/extractor';
import { modelExtractor, ollamaKbModel, openRouterKbModel, parseModelExtraction } from '../src/kb/modelExtractor';
import { MemoryKnowledgeStore, removePage, syncPage } from '../src/kb/store';
import { emptyCounts, ratio, scoreGraph } from '../src/kb/score';
import type { AnswerKey, KbCounts } from '../src/kb/score';

interface NotebookPage { id: string; title?: string; blocks: (Partial<DigitalBlock> & Pick<DigitalBlock, 'id' | 'kind' | 'text'>)[] }
interface Notebook {
  name: string; description: string; glossary: string[];
  steps: ({ op: 'put'; page: NotebookPage } | { op: 'delete'; pageId: string })[];
  expected: AnswerKey;
}
interface Timing { notebook: string; page: string; step: number; seconds: number; batches: number }

export function loadPage(input: NotebookPage): Page {
  return { id: input.id, title: input.title ?? '', createdAt: 0, updatedAt: 0, strokes: [], blocks: input.blocks.map((b, i) => ({ bbox: { left: 0, top: i * 40, right: 600, bottom: i * 40 + 30 }, confidence: 1, strokeIds: [], ...b })) };
}

function safeName(value: string): string {
  if (!/^[\w.-]+$/.test(value) || value === '.' || value === '..') throw new Error(`Unsafe path name: ${value}`);
  return value;
}

function row(name: string, c: KbCounts): string {
  const pct = (a: number, b: number) => `${(ratio(a, b) * 100).toFixed(1)}%`;
  return `| ${name} | ${pct(c.conceptCorrect, c.predictedConcepts)} / ${pct(c.conceptHits, c.expectedConcepts)} | ${pct(c.edgeCorrect, c.predictedEdges)} / ${pct(c.edgeHits, c.expectedEdges)} | ${c.duplicates} (${c.predictedConcepts ? (c.duplicates / c.predictedConcepts * 100).toFixed(1) : '0.0'}%) | ${c.falseMerges} | ${c.provenanceOk}/${c.provenanceTotal} | ${c.idempotent}/${c.notebooks} |`;
}

async function main() {
  const args = process.argv.slice(2), options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--run', '--replay', '--extractor', '--provider', '--model', '--ollama-url'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid option: ${args[i]}`);
    options.set(args[i], args[i + 1]);
  }
  const provider = options.get('--provider') ?? 'deterministic';
  if (options.has('--extractor') && options.get('--extractor') !== 'deterministic') throw new Error('Unknown extractor');
  const run = safeName(options.get('--run') ?? new Date().toISOString().replace(/[:.]/g, '-'));
  const replay = options.has('--replay') ? safeName(options.get('--replay')!) : undefined;
  const root = resolve('eval/kb'), output = join(root, 'results', run);
  if (run === replay) throw new Error('Replay output run must differ from source');
  if (provider === 'replay' && !replay) throw new Error('--provider replay requires --replay <run>');
  if (replay && provider !== 'replay' && provider !== 'deterministic') throw new Error('Use --provider replay for saved model responses');
  const live = provider === 'ollama' ? ollamaKbModel({ model: options.get('--model'), url: options.get('--ollama-url') })
    : provider === 'openrouter' ? openRouterKbModel(process.env.OPENROUTER_API_KEY ?? '', options.get('--model')) : undefined;
  if (!live && provider !== 'replay' && provider !== 'deterministic') throw new Error(`Unknown provider: ${provider}`);
  const compare = !!live || provider === 'replay';
  const files = async (dir: string) => (await readdir(join(root, dir))).filter(f => f.endsWith('.json')).sort().map(f => join(dir, f));
  const notebooks = [...await files('notebooks'), ...(compare ? await files('prose') : [])];
  if (!notebooks.length) throw new Error('No KB notebooks found');
  await mkdir(output, { recursive: true });
  const timing: Timing[] = [];
  const deterministic = await evaluate(root, output, notebooks, deterministicExtractor, replay && !compare ? replay : undefined, compare ? 'deterministic-raw' : 'raw');
  const model = compare ? await evaluate(root, output, notebooks,
    live ? modelExtractor(live) : { name: 'deterministic+model', extract: async () => { throw new Error('Replay cannot call a model'); }, parse: parseModelExtraction },
    replay, 'raw', live ? timing : undefined) : undefined;
  const markdown = `# Knowledge-base evaluation\n\n${render('Deterministic only', deterministic)}${model ? `\n${render(`Deterministic + model (${live?.name ?? `replay: ${replay}`})`, model)}` : ''}`
    + (timing.length ? `\n## Live model latency\n\n${timing.map(t => `- ${t.notebook}/${t.page} (step ${t.step}, ${t.batches} batch(es)): ${t.seconds.toFixed(2)} s`).join('\n')}\n` : '');
  await writeFile(join(output, 'summary.md'), markdown);
  await writeFile(join(output, 'summary.json'), JSON.stringify({ extractor: deterministicExtractor.name, ...deterministic, ...(model ? { model: { provider: live?.name ?? 'replay', ...model }, timing } : {}) }, null, 2) + '\n');
  console.log(markdown);
  console.log(`kb-total ${JSON.stringify(deterministic.total)}`);
  if (model) console.log(`kb-model-total ${JSON.stringify(model.total)}`);
}

async function evaluate(root: string, output: string, files: string[], extractor: Extractor, replay: string | undefined, rawPath: string, timing?: Timing[]) {
  const total = emptyCounts(), results: { name: string; counts: KbCounts; details: string[] }[] = [];
  for (const file of files) {
    const notebook = JSON.parse(await readFile(join(root, file), 'utf8')) as Notebook;
    const name = safeName(basename(file, '.json')), store = new MemoryKnowledgeStore(), pages = new Map<string, Page>();
    const rawDir = join(output, rawPath, name);
    await mkdir(rawDir, { recursive: true });
    let step = 0;
    const put = async (page: Page) => {
      const index = step++, filename = `${index}-${safeName(page.id)}.json`;
      await syncPage(store, page, { glossary: notebook.glossary, extract: async (page, ctx) => {
        const started = performance.now();
        const raw = replay ? await readFile(join(root, 'results', replay, 'raw', name, filename), 'utf8') : (await extractor.extract(page, ctx)).raw;
        const seconds = (performance.now() - started) / 1000;
        await writeFile(join(rawDir, filename), raw);
        if (timing) {
          const { batches } = JSON.parse(raw) as { batches: unknown[] };
          if (batches.length) {
            timing.push({ notebook: name, page: page.id, step: index, seconds, batches: batches.length });
            console.error(`${name}/${filename}: ${seconds.toFixed(2)} s (${batches.length} model batches)`);
          }
        }
        const parsed = extractor.parse(raw);
        if (parsed.pageId !== page.id) throw new Error(`Page mismatch in ${name}/${filename}`);
        return parsed;
      } });
    };
    for (const action of notebook.steps) {
      if (action.op === 'put') { const p = loadPage(action.page); pages.set(p.id, p); await put(p); }
      else if (action.op === 'delete') { pages.delete(action.pageId); await removePage(store, action.pageId); step++; }
      else throw new Error(`Invalid operation in ${file}`);
    }
    const before = await store.loadGraph();
    for (const p of pages.values()) await put(p);
    const graph = await store.loadGraph();
    const scored = scoreGraph(graph, notebook.expected, [...pages.values()], isDeepStrictEqual(before, graph));
    results.push({ name: notebook.name, ...scored });
    for (const key of Object.keys(total) as (keyof KbCounts)[]) total[key] += scored.counts[key];
  }
  return { results, total };
}

function render(label: string, { results, total }: Awaited<ReturnType<typeof evaluate>>): string {
  const table = ['| Notebook | Concept P / R | Edge P / R | Duplicates | False merges | Provenance | Idempotent |', '|---|---|---|---|---|---|---|', ...results.map(r => row(r.name, r.counts)), row('**total**', total)].join('\n');
  const details = results.map(r => `### ${r.name}\n${r.details.length ? r.details.map(d => `- ${d}`).join('\n') : '- No misses, extras, or provenance mismatches.'}`).join('\n\n');
  return `## ${label}\n\n${table}\n\n${details}\n`;
}

if (process.argv[1]?.endsWith('eval_kb.ts')) main().catch(error => { console.error(error); process.exitCode = 1; });
