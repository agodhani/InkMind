import { describe, expect, it } from 'vitest';
import { matchPairs } from './matching';

describe('weighted one-to-one assignment', () => {
  it('finds the global optimum rather than consuming the first local match', () => {
    expect(matchPairs([[10, 9], [8, -1]])).toEqual(new Map([[1, 0], [0, 1]]));
  });
  it('leaves absent or incompatible candidates unmatched', () => {
    expect(matchPairs([]).size).toBe(0);
    expect(matchPairs([[], []]).size).toBe(0);
    expect(matchPairs([[-1, 0], [-1, -1]]).size).toBe(0);
    expect(matchPairs([[2], [1]])).toEqual(new Map([[0, 0]]));
  });
});
