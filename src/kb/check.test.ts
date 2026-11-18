import { describe, expect, it } from 'vitest';
import { kbRegressions, parseKbTotal } from '../../scripts/check';
import { emptyCounts } from './score';

const baseline = { ...emptyCounts(), notebooks: 2, expectedConcepts: 10, predictedConcepts: 10, conceptHits: 8, conceptCorrect: 8, expectedEdges: 5, predictedEdges: 5, edgeHits: 4, edgeCorrect: 4, provenanceOk: 10, provenanceTotal: 12, idempotent: 2 };
describe('KB regression gate', () => {
  it('parses the final count line', () => expect(parseKbTotal(`ignored\nkb-total ${JSON.stringify(baseline)}\n`)).toEqual(baseline));
  it.each(['', 'kb-total {}', 'kb-total not-json'])('rejects missing/malformed totals', out => expect(() => parseKbTotal(out)).toThrow());
  it('accepts equal or improved scores', () => {
    expect(kbRegressions(baseline, baseline)).toEqual([]);
    expect(kbRegressions({ ...baseline, conceptHits: 9, falseMerges: 0 }, baseline)).toEqual([]);
  });
  it.each(['conceptHits', 'conceptCorrect', 'edgeHits', 'edgeCorrect', 'provenanceOk', 'idempotent', 'notebooks'] as const)('rejects lower %s', key => {
    expect(kbRegressions({ ...baseline, [key]: baseline[key] - 1 }, baseline)).toHaveLength(1);
  });
  it.each(['duplicates', 'falseMerges'] as const)('rejects higher %s', key => expect(kbRegressions({ ...baseline, [key]: 1 }, baseline)).toHaveLength(1));
  it('compares ratios rather than counts and handles empty denominators', () => {
    expect(kbRegressions({ ...baseline, conceptHits: 16, expectedConcepts: 20 }, baseline)).toEqual([]);
    expect(kbRegressions(emptyCounts(), emptyCounts())).toEqual([]);
  });
});
