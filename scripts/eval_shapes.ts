/**
 * Run the transcription eval over every synthetic shape dataset (those listed in src/sim/scenes.ts
 * DATASETS and present under eval/) and print one table: per dataset, per scene kind, and in total.
 *
 *   npm run eval:shapes                                   # ollama qwen2.5vl:3b, whole-page PNG
 *   npm run eval:shapes -- --model qwen2.5vl:7b --messiness messy
 *   npm run eval:shapes -- --dataset flowcharts-complex,state-machines --image strokes
 *
 * Accepts the same flags as scripts/eval.ts; `--dataset` takes a comma-separated list of dataset
 * names (default: all). Writes eval/shapes-suite/<run>.md as well.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATASETS, LEGACY_DATASETS } from '../src/sim/scenes';
import { AGG_HEADER, METRIC_NOTES, addAgg, aggRow, emptyAgg, parseArgs, runEval, type Agg } from './eval';

async function main() {
  const args = parseArgs();
  const wanted = process.argv.includes('--dataset') ? args.dataset.split(',').map((d) => d.replace(/^eval\//, '')) : Object.keys(DATASETS);
  const names = wanted.filter((n) => existsSync(join('eval', n, 'strokes.json')));
  const missing = wanted.filter((n) => !names.includes(n));
  if (missing.length) process.stderr.write(`skipping ${missing.join(', ')} (no eval/<name>/strokes.json; run npm run gen:shapes)\n`);
  const perDataset: [string, Agg][] = [];
  const byKind: Record<string, Agg> = {};
  const total = emptyAgg();
  let run = '';
  for (const name of names) {
    process.stderr.write(`\n== ${name} ==\n`);
    const r = await runEval({ ...args, dataset: join('eval', name) });
    run = r.run;
    perDataset.push([name, r.total]);
    addAgg(total, r.total);
    for (const [k, a] of Object.entries(r.byKind)) addAgg((byKind[k] ??= emptyAgg()), a);
  }
  const legacy = emptyAgg(), wave2 = emptyAgg();
  for (const [name, a] of perDataset) addAgg(LEGACY_DATASETS.includes(name) ? legacy : wave2, a);
  const md = [
    `# Synthetic shape suite — ${run}`,
    '',
    `${names.length} dataset(s): ${names.join(', ')}${args.messiness ? ` · messiness: ${args.messiness}` : ''} · ${new Date().toISOString()}`,
    '',
    '## By dataset',
    '',
    ...AGG_HEADER,
    ...perDataset.map(([n, a]) => aggRow(`\`${n}\``, a)),
    aggRow('*legacy five*', legacy),
    aggRow('*wave 2*', wave2),
    aggRow('**total**', total),
    '',
    '## By scene kind',
    '',
    ...AGG_HEADER,
    ...Object.entries(byKind).sort(([a], [b]) => a.localeCompare(b)).map(([k, a]) => aggRow(k, a)),
    '',
    METRIC_NOTES,
    '',
  ].join('\n');
  mkdirSync('eval/shapes-suite', { recursive: true });
  writeFileSync(join('eval/shapes-suite', `${run}.md`), md);
  console.log('\n' + md);
}

void main();
