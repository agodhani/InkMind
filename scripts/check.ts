/**
 * The project's own gate, run locally instead of a hosted CI: lint, unit tests, build, then the
 * offline geometry eval over the synthetic shape suite, compared with eval/check-baseline.json.
 *
 *   npm run check                      # everything; exits non-zero on the first failure
 *   npm run check -- --update-baseline # accept the current geometry scores as the new floor
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

function cleanup() {
  rmSync(join('eval/shapes-suite', `${RUN}.md`), { force: true });
  for (const d of readdirSync('eval', { withFileTypes: true })) if (d.isDirectory()) rmSync(join('eval', d.name, 'results', RUN), { recursive: true, force: true });
}

function main() {
  const update = process.argv.includes('--update-baseline');
  step('lint', 'npm', ['run', '-s', 'lint']);
  step('unit tests', 'npm', ['test', '--', '--run']);
  step('build', 'npm', ['run', '-s', 'build']);
  const out = step('geometry eval (synthetic shape suite, no model)', 'npm', ['run', '-s', 'eval:shapes', '--', '--provider', 'geometry', '--run', RUN]);
  cleanup();
  const now = parseTotal(out);
  if (!update && !existsSync(BASELINE)) {
    process.stdout.write(`\n✗ ${BASELINE} is missing; restore it, or create one with: npm run check -- --update-baseline\n`);
    process.exit(1);
  }
  if (update) {
    writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n');
    process.stdout.write(`baseline written: ${JSON.stringify(now)}\n`);
    return;
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Scores;
  const worse: string[] = [];
  if (now.pages < base.pages) worse.push(`pages ${base.pages} → ${now.pages}`);
  if (now.figuresFound / now.figures < base.figuresFound / base.figures) worse.push(`figures found ${base.figuresFound}/${base.figures} → ${now.figuresFound}/${now.figures}`);
  if (now.leakedStrokes * base.figureStrokes > base.leakedStrokes * now.figureStrokes) worse.push(`text leak ${base.leakedStrokes}/${base.figureStrokes} → ${now.leakedStrokes}/${now.figureStrokes} strokes`);
  if (now.figureCountOk / now.pages < base.figureCountOk / base.pages) worse.push(`figure count ok ${base.figureCountOk}/${base.pages} → ${now.figureCountOk}/${now.pages}`);
  if (worse.length) {
    process.stdout.write(`\n✗ geometry eval regressed vs ${BASELINE}:\n  ${worse.join('\n  ')}\n  (intended? npm run check -- --update-baseline)\n`);
    process.exit(1);
  }
  process.stdout.write(`\n✓ all checks passed · geometry: figures ${now.figuresFound}/${now.figures}, leak ${now.leakedStrokes}/${now.figureStrokes} strokes, count ok ${now.figureCountOk}/${now.pages}\n`);
}

if (process.argv[1]?.endsWith('check.ts')) main();
