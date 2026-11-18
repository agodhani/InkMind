import { describe, expect, it } from 'vitest';
import { parsePathTotal, pathRegressions } from '../../scripts/check';
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
