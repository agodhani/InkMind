import { describe, expect, it, vi } from 'vitest';
import { checkRecommendation, evaluateResources } from '../../scripts/eval_resources';
import * as resources from './resources';
import * as projects from './projects';
import * as projectFiles from './projects.node';
import * as rankings from './rank';
import type { ResourceCheck } from '../../scripts/eval_resources';
import { mlMap } from './model';
import { matchNotes } from './match';
import { planPath } from './plan';
import { rankResources, rankProjects } from './rank';
import { mlCatalog } from './resources';
import { starterProjects } from './projects';

const empty = { graph: { concepts: [], edges: [] }, extractions: [] };
const plan = planPath(mlMap, ['tokenization'], matchNotes(mlMap, empty));
const ranking = { resources: rankResources(mlMap, plan, mlCatalog), projects: rankProjects(mlMap, plan, starterProjects) };
describe('resource evaluation validation', () => {
  it('reports all validation errors before attempting any ranking', async () => {
    const rank = vi.spyOn(rankings, 'rankResources');
    const rankProject = vi.spyOn(rankings, 'rankProjects');
    vi.spyOn(resources, 'validateCatalog').mockReturnValue(['Empty concepts: broken-resource', 'Invalid minutes: broken-resource']);
    vi.spyOn(projects, 'validateProjects').mockReturnValue(['Unknown stage broken: rlhf-rlvr-toy']);
    vi.spyOn(projectFiles, 'checkProjectFiles').mockResolvedValue(['Missing file: missing.py']);
    try {
      await expect(evaluateResources()).rejects.toThrow([
        'Resource evaluation validation failed:',
        'catalog: Empty concepts: broken-resource',
        'catalog: Invalid minutes: broken-resource',
        'project: Unknown stage broken: rlhf-rlvr-toy',
        'project: rlhf-rlvr-toy: Missing file: missing.py',
      ].join('\n'));
      expect(rank).not.toHaveBeenCalled();
      expect(rankProject).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });
});
describe('resource answer key checks', () => {
  it.each<ResourceCheck>([
    { type: 'pathTopIncludesAny', k: 1, ids: ['build-tokenizer'] },
    { type: 'pathTopExcludes', ids: ['build-gpt'] },
    { type: 'stepTopIncludesAny', step: 'tokenization', k: 1, ids: ['build-tokenizer'] },
    { type: 'stepTop1', step: 'tokenization', id: 'build-tokenizer' },
    { type: 'pathCoverageAtLeast', k: 1, steps: 1 },
    { type: 'pathTopMaxMinutes', k: 1, minutes: 180, atLeast: 1 },
    { type: 'pathReasonsMatch', pattern: '^covers 1 of your 1 remaining steps' },
    { type: 'projectNotRanked', id: 'rlhf-rlvr-toy' },
  ])('passes a satisfied $type check', check => expect(checkRecommendation(check, plan, ranking).passed).toBe(true));
  it.each<ResourceCheck>([
    { type: 'pathTopIncludesAny', k: 1, ids: ['nonexistent'] },
    { type: 'pathTopExcludes', ids: ['build-tokenizer'] },
    { type: 'stepTopIncludesAny', step: 'unknown', k: 1, ids: ['build-tokenizer'] },
    { type: 'stepTop1', step: 'tokenization', id: 'wrong' },
    { type: 'pathCoverageAtLeast', k: 1, steps: 2 },
    { type: 'pathTopMaxMinutes', k: 1, minutes: 60, atLeast: 1 },
    { type: 'pathReasonsMatch', pattern: '^wrong' },
    { type: 'projectRanked', id: 'rlhf-rlvr-toy', coveredCount: 16 },
    { type: 'stepsDone', ids: ['tokenization'], reasonIncludes: 'passed the project' },
    { type: 'emptyRanking' },
  ])('records details for an unsatisfied $type check', check => {
    const result = checkRecommendation(check, plan, ranking);
    expect(result.passed).toBe(false); expect(result.detail.length).toBeGreaterThan(0);
  });
  it('handles project results, done steps and genuinely empty rankings', () => {
    const previous = planPath(mlMap, ['rlvr'], matchNotes(mlMap, empty));
    const project = starterProjects[0];
    const passed = planPath(mlMap, ['rlvr'], matchNotes(mlMap, empty, [], [{ projectId: project.id, concepts: project.concepts, passed: true }]), previous);
    const before = { resources: rankResources(mlMap, previous, mlCatalog), projects: rankProjects(mlMap, previous, starterProjects) };
    expect(checkRecommendation({ type: 'projectRanked', id: project.id, coveredCount: before.projects[0].covers.length }, previous, before).passed).toBe(true);
    expect(checkRecommendation({ type: 'projectNotRanked', id: project.id }, previous, before).passed).toBe(false);
    const after = { resources: rankResources(mlMap, passed, mlCatalog), projects: rankProjects(mlMap, passed, starterProjects) };
    expect(checkRecommendation({ type: 'stepsDone', ids: ['rlvr'], reasonIncludes: 'passed the project' }, passed, after).passed).toBe(true);
    expect(checkRecommendation({ type: 'emptyRanking' }, passed, after).passed).toBe(false);
    const known = planPath(mlMap, ['rlvr'], matchNotes(mlMap, empty, ['rlvr']));
    const knownRanking = { resources: rankResources(mlMap, known, mlCatalog), projects: rankProjects(mlMap, known, starterProjects) };
    expect(checkRecommendation({ type: 'emptyRanking' }, known, knownRanking).passed).toBe(true);
  });
  it('rejects unknown check types rather than silently passing', () => {
    expect(() => checkRecommendation({ type: 'typo' } as never, plan, ranking)).toThrow('Unknown resource check');
  });
});
