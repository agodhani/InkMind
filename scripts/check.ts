/**
 * The project's own gate, run locally instead of a hosted CI: lint, unit tests, build, then the
 * offline geometry and KB evals, compared with eval/check-baseline.json.
 *
 *   npm run check                      # everything; exits non-zero on the first failure
 *   npm run check -- --update-baseline # accept current scores as the new floor
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ratio } from '../src/kb/score';
import type { KbCounts } from '../src/kb/score';

const BASELINE = 'eval/check-baseline.json';
const RUN = 'check-gate';

const TOTAL_PREFIX = 'check-total ';

interface Scores {
  pages: number;
  figuresFound: number;
  figures: number;
  leakedStrokes: number;
  figureStrokes: number;
  figureCountOk: number;
}

function step(name: string, cmd: string, args: string[]): string {
  process.stdout.write(`\n▶ ${name}\n`);
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  if (r.status !== 0) {
    process.stdout.write((r.stdout ?? '') + (r.stderr ?? ''));
    process.stdout.write(`\n✗ ${name} failed\n`);
    cleanup();
    process.exit(r.status ?? 1);
  }
  process.stdout.write(`✓ ${name}\n`);
  return r.stdout ?? '';
}

export function parseTotal(out: string): Scores {
  const line = out.split('\n').filter((l) => l.startsWith(TOTAL_PREFIX)).pop();
  if (!line) throw new Error('geometry eval printed no check-total line');
  return JSON.parse(line.slice(TOTAL_PREFIX.length)) as Scores;
}

export function parseKbTotal(out: string): KbCounts {
  const line = out.split('\n').filter(l => l.startsWith('kb-total ')).pop();
  if (!line) throw new Error('KB eval printed no kb-total line');
  const value = JSON.parse(line.slice('kb-total '.length)) as KbCounts;
  const keys: (keyof KbCounts)[] = ['notebooks', 'expectedConcepts', 'predictedConcepts', 'conceptHits', 'conceptCorrect', 'expectedEdges', 'predictedEdges', 'edgeHits', 'edgeCorrect', 'duplicates', 'falseMerges', 'provenanceOk', 'provenanceTotal', 'idempotent'];
  if (keys.some(k => !Number.isInteger(value[k]) || value[k] < 0)) throw new Error('Invalid kb-total counts');
  return value;
}

export function kbRegressions(now: KbCounts, base: KbCounts): string[] {
  const worse: string[] = [];
  const rates: [string, keyof KbCounts, keyof KbCounts][] = [
    ['concept recall', 'conceptHits', 'expectedConcepts'], ['concept precision', 'conceptCorrect', 'predictedConcepts'],
    ['edge recall', 'edgeHits', 'expectedEdges'], ['edge precision', 'edgeCorrect', 'predictedEdges'],
    ['provenance', 'provenanceOk', 'provenanceTotal'],
  ];
  for (const [label, num, den] of rates) if (ratio(now[num], now[den]) < ratio(base[num], base[den])) worse.push(`${label} ${base[num]}/${base[den]} → ${now[num]}/${now[den]}`);
  for (const key of ['duplicates', 'falseMerges'] as const) if (now[key] > base[key]) worse.push(`${key} ${base[key]} → ${now[key]}`);
  for (const key of ['notebooks', 'idempotent'] as const) if (now[key] < base[key]) worse.push(`${key} ${base[key]} → ${now[key]}`);
  return worse;
}

function cleanup() {
  rmSync(join('eval/shapes-suite', `${RUN}.md`), { force: true });
  for (const d of readdirSync('eval', { withFileTypes: true })) if (d.isDirectory()) rmSync(join('eval', d.name, 'results', RUN), { recursive: true, force: true });
}

function main() {
  const update = process.argv.includes('--update-baseline');
  step('lint', 'npm', ['run', '-s', 'lint']);
  step('unit tests', 'npm', ['test', '--', '--run']);
  step('build', 'npm', ['run', '-s', 'build']);
  let now: Scores, kb: KbCounts;
  try {
    now = parseTotal(step('geometry eval (synthetic shape suite, no model)', 'npm', ['run', '-s', 'eval:shapes', '--', '--provider', 'geometry', '--run', RUN]));
    kb = parseKbTotal(step('KB eval (deterministic, no model)', 'npm', ['run', '-s', 'eval:kb', '--', '--run', RUN]));
  } finally { cleanup(); }
  if (!update && !existsSync(BASELINE)) {
    process.stdout.write(`\n✗ ${BASELINE} is missing; restore it, or create one with: npm run check -- --update-baseline\n`);
    process.exit(1);
  }
  if (update) {
    writeFileSync(BASELINE, JSON.stringify({ geometry: now, kb }, null, 2) + '\n');
    process.stdout.write(`baseline written: ${JSON.stringify({ geometry: now, kb })}\n`);
    return;
  }
  const saved = JSON.parse(readFileSync(BASELINE, 'utf8')) as Scores | { geometry: Scores; kb?: KbCounts };
  const base = 'geometry' in saved ? saved.geometry : saved;
  const kbBase = 'geometry' in saved ? saved.kb : undefined;
  if (!kbBase) {
    process.stdout.write(`\n✗ ${BASELINE} has no KB baseline; run: npm run check -- --update-baseline\n`);
    process.exit(1);
  }
  const worse: string[] = [];
  if (now.pages < base.pages) worse.push(`pages ${base.pages} → ${now.pages}`);
  if (now.figuresFound / now.figures < base.figuresFound / base.figures) worse.push(`figures found ${base.figuresFound}/${base.figures} → ${now.figuresFound}/${now.figures}`);
  if (now.leakedStrokes * base.figureStrokes > base.leakedStrokes * now.figureStrokes) worse.push(`text leak ${base.leakedStrokes}/${base.figureStrokes} → ${now.leakedStrokes}/${now.figureStrokes} strokes`);
  if (now.figureCountOk / now.pages < base.figureCountOk / base.pages) worse.push(`figure count ok ${base.figureCountOk}/${base.pages} → ${now.figureCountOk}/${now.pages}`);
  worse.push(...kbRegressions(kb, kbBase).map(s => `KB ${s}`));
  if (worse.length) {
    process.stdout.write(`\n✗ eval regressed vs ${BASELINE}:\n  ${worse.join('\n  ')}\n  (intended? npm run check -- --update-baseline)\n`);
    process.exit(1);
  }
  process.stdout.write(`\n✓ all checks passed · geometry: figures ${now.figuresFound}/${now.figures}, leak ${now.leakedStrokes}/${now.figureStrokes} strokes, count ok ${now.figureCountOk}/${now.pages} · KB: concepts P ${kb.conceptCorrect}/${kb.predictedConcepts} R ${kb.conceptHits}/${kb.expectedConcepts}, edges P ${kb.edgeCorrect}/${kb.predictedEdges} R ${kb.edgeHits}/${kb.expectedEdges}, duplicates ${kb.duplicates}, false merges ${kb.falseMerges}, provenance ${kb.provenanceOk}/${kb.provenanceTotal}, idempotent ${kb.idempotent}/${kb.notebooks}\n`);
}

if (process.argv[1]?.endsWith('check.ts')) main();
