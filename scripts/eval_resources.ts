import { isDeepStrictEqual } from 'node:util';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build, shuffled } from './eval_path';
import { mlMap } from '../src/path/model';
import { matchNotes } from '../src/path/match';
import { planPath } from '../src/path/plan';
import type { PathPlan } from '../src/path/plan';
import { mlCatalog, uncoveredConcepts, validateCatalog } from '../src/path/resources';
import { starterProjects, validateProjects } from '../src/path/projects';
import { checkProjectFiles } from '../src/path/projects.node.ts';
import { rankProjects, rankResources } from '../src/path/rank';
import type { ResourcePreferences } from '../src/path/rank';

export function emptyResourcesCounts() {
  return { catalogResources: 0, catalogErrors: 0, projectErrors: 0, pathConcepts: 0, pathConceptsCovered: 0,
    cases: 0, checks: 0, checksOk: 0, deterministic: 0 };
}
export type ResourcesCounts = ReturnType<typeof emptyResourcesCounts>;
export type ResourceCheck =
  | { type: 'pathTopIncludesAny'; k: number; ids: string[] }
  | { type: 'pathTopExcludes'; k?: number; ids: string[] }
  | { type: 'stepTopIncludesAny'; step: string; k: number; ids: string[] }
  | { type: 'stepTop1'; step: string; id: string }
  | { type: 'pathCoverageAtLeast'; k: number; steps: number }
  | { type: 'pathTopMaxMinutes'; k: number; minutes: number; atLeast: number }
  | { type: 'pathReasonsMatch'; pattern: string }
  | { type: 'projectRanked'; id: string; coveredCount: number }
  | { type: 'projectNotRanked'; id: string }
  | { type: 'stepsDone'; ids: string[]; reasonIncludes: string }
  | { type: 'emptyRanking' };
interface ResourceCase {
  name: string; pathCase: string; replan?: boolean; projectsPassed?: string[];
  prefs: ResourcePreferences; checks: ResourceCheck[];
}
type Ranking = { resources: ReturnType<typeof rankResources>; projects: ReturnType<typeof rankProjects> };
export function checkRecommendation(check: ResourceCheck, plan: PathPlan, ranking: Ranking): { passed: boolean; detail: string } {
  const { resources, projects } = ranking;
  let passed: boolean, detail: string;
  switch (check.type) {
    case 'pathTopIncludesAny':
    case 'pathTopExcludes': {
      const ids = resources.path.slice(0, check.k).map(r => r.resourceId);
      passed = check.type === 'pathTopIncludesAny' ? check.ids.some(id => ids.includes(id)) : check.ids.every(id => !ids.includes(id));
      detail = `path top ${check.k ?? 'all'}: ${ids.join(', ') || '(none)'}`;
      break;
    }
    case 'stepTopIncludesAny':
    case 'stepTop1': {
      const ids = (resources.steps[check.step] ?? []).slice(0, check.type === 'stepTop1' ? 1 : check.k).map(r => r.resourceId);
      passed = check.type === 'stepTop1' ? ids[0] === check.id : check.ids.some(id => ids.includes(id));
      detail = `${check.step}: ${ids.join(', ') || '(none)'}`;
      break;
    }
    case 'pathCoverageAtLeast': {
      const count = new Set(resources.path.slice(0, check.k).flatMap(r => r.covers)).size;
      passed = count >= check.steps; detail = `coverage ${count}, required >=${check.steps}`; break;
    }
    case 'pathTopMaxMinutes': {
      const count = resources.path.slice(0, check.k).filter(r => mlCatalog.resources.some(item => item.id === r.resourceId && item.minutes <= check.minutes)).length;
      passed = count >= check.atLeast; detail = `${count} of top ${check.k} take <=${check.minutes} minutes; required >=${check.atLeast}`; break;
    }
    case 'pathReasonsMatch': {
      const invalid = resources.path.filter(r => !new RegExp(check.pattern).test(r.reason));
      passed = invalid.length === 0; detail = invalid.map(r => r.reason).join('; ') || 'all path reasons match'; break;
    }
    case 'projectRanked': {
      const project = projects.find(p => p.projectId === check.id);
      passed = project?.covers.length === check.coveredCount;
      detail = `${check.id}: ${project ? project.covers.length + ' covered' : 'not ranked'}, expected ${check.coveredCount}`; break;
    }
    case 'projectNotRanked':
      passed = !projects.some(p => p.projectId === check.id); detail = `${check.id}: ${passed ? 'not ranked' : 'ranked'}`; break;
    case 'stepsDone': {
      const invalid = check.ids.filter(id => !plan.steps.some(s => s.conceptId === id && s.status === 'done' && s.reason.includes(check.reasonIncludes)));
      passed = invalid.length === 0; detail = invalid.length ? `not done or missing reason: ${invalid.join(', ')}` : 'all requested steps done with matching reasons'; break;
    }
    case 'emptyRanking':
      passed = resources.path.length === 0 && Object.values(resources.steps).every(list => list.length === 0) && projects.length === 0;
      detail = `path=${resources.path.length}, per-step=${Object.values(resources.steps).flat().length}, projects=${projects.length}`; break;
    default: throw new Error(`Unknown resource check: ${JSON.stringify(check)}`);
  }
  return { passed, detail };
}
async function readPathCase(name: string): Promise<Parameters<typeof build>[0]> {
  if (!/^[\w-]+$/.test(name)) throw new Error(`Invalid path case: ${name}`);
  return JSON.parse(await readFile(join('eval/path/cases', name + '.json'), 'utf8'));
}
export async function evaluateResources() {
  const catalogErrors = validateCatalog(mlMap, mlCatalog);
  const projectErrors = [...validateProjects(mlMap, starterProjects), ...(await Promise.all(starterProjects.map(async project =>
    (await checkProjectFiles([project])).map(error => `${project.id}: ${error}`)))).flat()];
  if (catalogErrors.length || projectErrors.length) {
    throw new Error(['Resource evaluation validation failed:',
      ...catalogErrors.map(error => `catalog: ${error}`), ...projectErrors.map(error => `project: ${error}`)].join('\n'));
  }
  const userCase = await readPathCase('backprop-minimax-to-rlhf-rlvr');
  const userPlan = planPath(mlMap, userCase.goals, matchNotes(mlMap, await build(userCase), userCase.declared));
  const freeCatalog = { ...mlCatalog, resources: mlCatalog.resources.filter(r => r.free) };
  const total: ResourcesCounts = { ...emptyResourcesCounts(), catalogResources: mlCatalog.resources.length, catalogErrors: catalogErrors.length,
    projectErrors: projectErrors.length, pathConcepts: userPlan.steps.length,
    pathConceptsCovered: userPlan.steps.length - uncoveredConcepts(mlMap, freeCatalog, userPlan.steps.map(s => s.conceptId)).length };
  const results = [];
  for (const file of (await readdir('eval/resources/cases')).filter(f => f.endsWith('.json')).sort()) {
    const c = JSON.parse(await readFile(join('eval/resources/cases', file), 'utf8')) as ResourceCase;
    const pathCase = await readPathCase(c.pathCase);
    const initial = await build(pathCase), notes = c.replan ? await build(pathCase, pathCase.replan) : initial;
    if (c.replan && !pathCase.replan) throw new Error(`No replan additions: ${c.pathCase}`);
    const projectResults = (c.projectsPassed ?? []).map(id => {
      const project = starterProjects.find(p => p.id === id);
      if (!project) throw new Error(`Unknown passed project: ${id}`);
      return { projectId: id, concepts: project.concepts, passed: true };
    });
    function makePlan(shuffle = false) {
      const first = planPath(mlMap, pathCase.goals, matchNotes(mlMap, shuffle ? shuffled(initial) : initial, pathCase.declared));
      if (!c.replan && !projectResults.length) return first;
      return planPath(mlMap, pathCase.goals, matchNotes(mlMap, shuffle ? shuffled(notes) : notes,
        [...(pathCase.declared ?? []), ...(c.replan ? pathCase.replan?.declared ?? [] : [])], projectResults), first);
    }
    const plan = makePlan();
    const rank = (p: PathPlan): Ranking => ({ resources: rankResources(mlMap, p, mlCatalog, c.prefs), projects: rankProjects(mlMap, p, starterProjects) });
    const ranking = rank(plan);
    const deterministic = isDeepStrictEqual(ranking, rank(makePlan())) && isDeepStrictEqual(ranking, rank(makePlan(true)));
    const checks = c.checks.map(check => ({ check, ...checkRecommendation(check, plan, ranking) }));
    results.push({ name: c.name, checks, deterministic, ranking });
    total.cases++; total.checks += checks.length; total.checksOk += checks.filter(check => check.passed).length; total.deterministic += Number(deterministic);
  }
  return { total, catalogErrors, projectErrors, uncovered: uncoveredConcepts(mlMap, mlCatalog), results };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--run')) throw new Error('Usage: eval:resources [--run name]');
  const run = args[1] ?? new Date().toISOString().replace(/[:.]/g, '-');
  if (!/^[\w.-]+$/.test(run) || run === '.' || run === '..') throw new Error('Invalid run name');
  const result = await evaluateResources();
  const markdown = '# Resource ranking evaluation\n\n'
    + result.results.map(r => `## ${r.name}\n${r.checks.map((c, i) => `- ${c.passed ? 'PASS' : 'FAIL'} ${i + 1}. ${JSON.stringify(c.check)} — ${c.detail}`).join('\n')}\n- Deterministic: ${r.deterministic}\n`).join('\n')
    + '\n## Validation\n' + [...result.catalogErrors, ...result.projectErrors].map(e => '- ' + e).join('\n')
    + '\n\n## Map concepts with no resource\n' + result.uncovered.map(id => '- ' + id).join('\n')
    + '\n\nresources-total ' + JSON.stringify(result.total) + '\n';
  const output = join('eval/resources/results', run);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'summary.md'), markdown);
  await writeFile(join(output, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(markdown);
}
if (process.argv[1]?.endsWith('eval_resources.ts')) main().catch(error => { console.error(error); process.exitCode = 1; });
