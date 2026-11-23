import { describe, expect, it } from 'vitest';
import { parsePathTotal, pathRegressions, parseResourcesTotal, resourcesRegressions } from '../../scripts/check';
import { emptyResourcesCounts } from '../../scripts/eval_resources';
import { emptyPathCounts } from './score';

const base = { ...emptyPathCounts(), cases: 9, expectedSteps: 10, predictedSteps: 10, stepHits: 8, knownExpected: 5, knownHits: 4,
  partialExpected: 5, partialHits: 4, doneExpected: 5, doneHits: 5, reasonsOk: 4, reasonsTotal: 5, deterministic: 9, replans: 3, replanStable: 3 };
describe('path regression gate', () => {
  it('parses counts', () => expect(parsePathTotal(`ignored\npath-total ${JSON.stringify(base)}\n`)).toEqual(base));
  it.each(['', 'path-total {}', 'path-total not-json', `path-total ${JSON.stringify({ ...base, cases: -1 })}`])('rejects malformed totals', out => expect(() => parsePathTotal(out)).toThrow());
  it('accepts equal, improved and empty rates', () => {
    expect(pathRegressions(base, base)).toEqual([]);
    expect(pathRegressions({ ...base, stepHits: 9 }, base)).toEqual([]);
    expect(pathRegressions(emptyPathCounts(), emptyPathCounts())).toEqual([]);
    expect(pathRegressions({ ...base, stepHits: 16, expectedSteps: 20, predictedSteps: 20 }, base)).toEqual([]);
  });
  it.each(['knownHits', 'partialHits', 'doneHits', 'reasonsOk', 'cases', 'deterministic', 'replanStable'] as const)('rejects falling %s', key => expect(pathRegressions({ ...base, [key]: base[key] - 1 }, base).length).toBeGreaterThan(0));
  it('rejects falling precision and recall separately', () => {
    expect(pathRegressions({ ...base, predictedSteps: 11 }, base)[0]).toContain('precision');
    expect(pathRegressions({ ...base, expectedSteps: 11 }, base)[0]).toContain('recall');
  });
  it('rejects any ordering violations even if baseline has them', () => expect(pathRegressions({ ...base, orderingViolations: 1 }, { ...base, orderingViolations: 1 })).toHaveLength(1));
  it('rejects any mustSkip violations even if the baseline has them', () => expect(pathRegressions({ ...base, mustSkipViolations: 1 }, { ...base, mustSkipViolations: 1 })).toHaveLength(1));
  it.each([
    ['deterministic', 'cases'], ['replanStable', 'replans'], ['doneHits', 'doneExpected'],
  ] as const)('rejects incomplete %s when added coverage hides a failure', (success, expected) => {
    const now = { ...base, [success]: base[success] + 1, [expected]: base[expected] + 2 };
    expect(pathRegressions(now, base).some(message => message.includes(`${success} ${now[success]}/${now[expected]} must be complete`))).toBe(true);
    expect(pathRegressions(now, now).some(message => message.includes('must be complete'))).toBe(true);
    expect(pathRegressions({ ...now, [success]: now[expected] }, base)).toEqual([]);
  });
});

const resourcesBase = { catalogResources: 39, catalogErrors: 0, projectErrors: 0, pathConcepts: 41, pathConceptsCovered: 41,
  cases: 6, checks: 28, checksOk: 26, deterministic: 6 };
describe('resources regression gate', () => {
  it('parses counts and the last total line', () => expect(parseResourcesTotal(`ignored\nresources-total {}\nresources-total ${JSON.stringify(resourcesBase)}\n`)).toEqual(resourcesBase));
  it.each(['', 'resources-total {}', 'resources-total null', 'resources-total not-json', `resources-total ${JSON.stringify({ ...resourcesBase, checks: -1 })}`,
    `resources-total ${JSON.stringify({ ...resourcesBase, checksOk: 1.5 })}`])('rejects malformed counts', out => expect(() => parseResourcesTotal(out)).toThrow());
  it('accepts equal, improved, proportional and empty rates', () => {
    expect(resourcesRegressions(resourcesBase, resourcesBase)).toEqual([]);
    expect(resourcesRegressions({ ...resourcesBase, checksOk: 28 }, resourcesBase)).toEqual([]);
    expect(resourcesRegressions({ ...resourcesBase, checks: 56, checksOk: 52 }, resourcesBase)).toEqual([]);
    expect(resourcesRegressions(emptyResourcesCounts(), emptyResourcesCounts())).toEqual([]);
  });
  it.each(['catalogErrors', 'projectErrors'] as const)('rejects %s even against itself for baseline updates', key => {
    const invalid = { ...resourcesBase, [key]: 1 };
    expect(resourcesRegressions(invalid, invalid)).toContain(`${key} 1`);
  });
  it.each(['cases', 'catalogResources', 'checksOk', 'pathConceptsCovered'] as const)('rejects falling %s', key => {
    expect(resourcesRegressions({ ...resourcesBase, [key]: resourcesBase[key] - 1 }, resourcesBase).length).toBeGreaterThan(0);
  });
  it('rejects falling rates when denominators grow', () => {
    expect(resourcesRegressions({ ...resourcesBase, checks: 29 }, resourcesBase)[0]).toContain('checksOk');
    expect(resourcesRegressions({ ...resourcesBase, pathConcepts: 42 }, resourcesBase)[0]).toContain('pathConceptsCovered');
  });
  it.each([5, 7])('requires determinism exactly equal to cases, got %s', deterministic => {
    expect(resourcesRegressions({ ...resourcesBase, deterministic }, resourcesBase)).toContain(`deterministic ${deterministic}/6 must be complete`);
  });
  it('does not hide incomplete determinism by growing case counts', () => {
    const now = { ...resourcesBase, cases: 8, deterministic: 7 };
    expect(resourcesRegressions(now, now)).toContain('deterministic 7/8 must be complete');
  });
});
