import { isDeepStrictEqual } from 'node:util';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPage } from './eval_kb';
import { MemoryKnowledgeStore, removePage, syncPage } from '../src/kb/store';
import { deterministicExtractor } from '../src/kb/extractor';
import type { KbGraph, PageExtraction } from '../src/kb/model';
import { mlMap, validateMap } from '../src/path/model';
import { matchNotes } from '../src/path/match';
import { planPath } from '../src/path/plan';
import { emptyPathCounts } from '../src/path/score';

type NotebookPage = Parameters<typeof loadPage>[0];
interface Additions { notebooks?: string[]; pages?: NotebookPage[]; declared?: string[] }
interface Case extends Additions {
  name: string; description: string; glossary?: string[]; goals: string[]; graphPatch?: { concepts: KbGraph['concepts'] };
  expected: { steps: string[]; known: string[]; partial: string[]; mustSkip: string[] };
  replan?: Additions & { expectedDone: string[] };
}
interface Notebook { glossary: string[]; steps: ({ op: 'put'; page: NotebookPage } | { op: 'delete'; pageId: string })[] }
async function readNotebook(name: string): Promise<Notebook> {
  if (!/^[\w-]+$/.test(name)) throw new Error(`Invalid notebook: ${name}`);
  return JSON.parse(await readFile(join('eval/kb/notebooks', `${name}.json`), 'utf8'));
}
async function build(c: Case, additions?: Additions) {
  const notebooks = await Promise.all([...(c.notebooks ?? []), ...(additions?.notebooks ?? [])].map(readNotebook));
  const glossary = [...new Set([...(c.glossary ?? []), ...notebooks.flatMap(n => n.glossary)])];
  const graph: KbGraph = { concepts: [], edges: [] }, extractions: PageExtraction[] = [];
  const sources = [...notebooks, { glossary, steps: [...(c.pages ?? []), ...(additions?.pages ?? [])].map(page => ({ op: 'put' as const, page })) }];
  for (const [index, notebook] of sources.entries()) {
    const store = new MemoryKnowledgeStore();
    for (const action of notebook.steps) {
      if (action.op === 'put') await syncPage(store, loadPage(action.page), { glossary, extractor: deterministicExtractor });
      else await removePage(store, action.pageId);
    }
    const part = await store.loadGraph(), prefix = `${index}:`;
    graph.concepts.push(...part.concepts.map(concept => ({ ...concept, id: prefix + concept.id,
      provenance: concept.provenance.map(p => ({ ...p, pageId: prefix + p.pageId })) })));
    graph.edges.push(...part.edges.map(e => ({ ...e, id: prefix + e.id, from: prefix + e.from, to: prefix + e.to })));
    extractions.push(...(await store.listExtractions()).map(e => ({ ...e, pageId: prefix + e.pageId })));
  }
  graph.concepts.push(...(c.graphPatch?.concepts ?? []));
  return { graph, extractions };
}
function shuffled(notes: { graph: KbGraph; extractions: PageExtraction[] }) {
  const n = structuredClone(notes);
  n.graph.concepts.reverse(); n.graph.edges.reverse(); n.graph.proposals?.reverse();
  n.graph.concepts.forEach(c => { c.aliases.reverse(); c.provenance.reverse(); });
  n.extractions.reverse(); n.extractions.forEach(e => { e.texts.reverse(); e.terms.reverse(); e.relations.reverse(); });
  return n;
}
export async function evaluatePaths() {
  const errors = validateMap(mlMap);
  if (errors.length) throw new Error(errors.join('\n'));
  const total = emptyPathCounts(), results = [];
  for (const file of (await readdir('eval/path/cases')).filter(f => f.endsWith('.json')).sort()) {
    const c = JSON.parse(await readFile(join('eval/path/cases', file), 'utf8')) as Case;
    const notes = await build(c), matches = matchNotes(mlMap, notes, c.declared);
    const plan = planPath(mlMap, c.goals, matches), counts = emptyPathCounts(), details: string[] = [];
    counts.cases = 1;
    const predicted = plan.steps.map(s => s.conceptId);
    const compare = (label: string, expected: string[], actual: string[], extras = false) => {
      const missing = expected.filter(id => !actual.includes(id));
      if (missing.length) details.push(`${label} missed: ${missing.join(', ')}`);
      const extra = actual.filter(id => !expected.includes(id));
      if (extras && extra.length) details.push(`${label} extra: ${extra.join(', ')}`);
      return expected.length - missing.length;
    };
    counts.expectedSteps = c.expected.steps.length; counts.predictedSteps = predicted.length;
    counts.stepHits = compare('steps', c.expected.steps, predicted, true);
    counts.knownExpected = c.expected.known.length;
    counts.knownHits = compare('known/skipped', c.expected.known, plan.skipped.map(s => s.conceptId));
    counts.partialExpected = c.expected.partial.length;
    counts.partialHits = compare('partial', c.expected.partial, matches.filter(m => m.state === 'partial').map(m => m.conceptId));
    counts.mustSkip = c.expected.mustSkip.length;
    const violations = c.expected.mustSkip.filter(id => predicted.includes(id));
    counts.mustSkipViolations = violations.length;
    if (violations.length) details.push(`mustSkip violations: ${violations.join(', ')}`);
    let deterministic = isDeepStrictEqual(plan, planPath(mlMap, c.goals, matchNotes(mlMap, notes, c.declared)))
      && isDeepStrictEqual(plan, planPath(mlMap, c.goals, matchNotes(mlMap, shuffled(notes), c.declared)));
    const plans = [plan];
    if (c.replan) {
      counts.replans = 1;
      const nextNotes = await build(c, c.replan), declared = [...(c.declared ?? []), ...(c.replan.declared ?? [])];
      const next = planPath(mlMap, c.goals, matchNotes(mlMap, nextNotes, declared), plan);
      plans.push(next);
      deterministic &&= isDeepStrictEqual(next, planPath(mlMap, c.goals, matchNotes(mlMap, shuffled(nextNotes), declared), plan));
      const remaining = next.steps.filter(s => s.status !== 'done').map(s => s.conceptId);
      const stable = isDeepStrictEqual(remaining, predicted.filter(id => remaining.includes(id)))
        && plan.steps.every(s => next.steps.some(n => n.conceptId === s.conceptId && (s.status !== 'done' || n.status === 'done')));
      counts.replanStable = Number(stable);
      if (!stable) details.push('replan order or done-state instability');
      counts.doneExpected = c.replan.expectedDone.length;
      counts.doneHits = compare('done', c.replan.expectedDone, next.steps.filter(s => s.status === 'done').map(s => s.conceptId));
    }
    counts.deterministic = Number(deterministic);
    if (!deterministic) details.push('non-deterministic plan');
    for (const p of plans) for (const [index, step] of p.steps.entries()) {
      const concept = mlMap.concepts.find(c => c.id === step.conceptId)!;
      const bad = concept.prerequisites.filter(id => p.steps.findIndex(s => s.conceptId === id) > index);
      counts.orderingViolations += bad.length;
      if (bad.length) details.push(`ordering: ${step.conceptId} before ${bad.join(', ')}`);
      counts.reasonsTotal++;
      const namesNeed = /goal/i.test(step.reason) || step.neededBy.some(id => step.reason.includes(mlMap.concepts.find(c => c.id === id)!.label));
      const notesStatus = /notes|you said|assumed:/i.test(step.reason);
      counts.reasonsOk += Number(namesNeed && notesStatus);
      if (!namesNeed || !notesStatus) details.push(`reason incomplete: ${step.conceptId}: ${step.reason}`);
    }
    for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += counts[key];
    results.push({ name: c.name, counts, details, plans });
  }
  return { total, results };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--run')) throw new Error('Usage: eval:path [--run name]');
  const run = args[1] ?? new Date().toISOString().replace(/[:.]/g, '-');
  if (!/^[\w.-]+$/.test(run) || run === '.' || run === '..') throw new Error('Invalid run name');
  const result = await evaluatePaths();
  const markdown = '# Learning path evaluation\n\n| Case | Steps hit/expected (predicted) | Known | Partial | Done | Misses |\n|---|---|---|---|---|---|\n'
    + result.results.map(r => `| ${r.name} | ${r.counts.stepHits}/${r.counts.expectedSteps} (${r.counts.predictedSteps}) | ${r.counts.knownHits}/${r.counts.knownExpected} | ${r.counts.partialHits}/${r.counts.partialExpected} | ${r.counts.doneHits}/${r.counts.doneExpected} | ${r.details.length} |`).join('\n')
    + '\n\n' + result.results.map(r => `## ${r.name}\n${r.details.length ? r.details.map(d => `- ${d}`).join('\n') : '- No misses.'}`).join('\n\n') + '\n';
  const output = join('eval/path/results', run);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'summary.md'), markdown);
  await writeFile(join(output, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(markdown); console.log(`path-total ${JSON.stringify(result.total)}`);
}
if (process.argv[1]?.endsWith('eval_path.ts')) main().catch(error => { console.error(error); process.exitCode = 1; });
