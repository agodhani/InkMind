import { describe, expect, it } from 'vitest';
import { isConceptLabel, splitParenAlias, termKey } from './normalize';

describe('term normalisation', () => {
  it.each([
    ['**Policies**:', 'policy'], ['1. [[Policy]]', 'policy'], ["Agent’s policies", 'agent policy'],
    ['LLMs', 'llm'], ['GPUs', 'gpu'], ['Classes boxes watches wishes', 'class box watch wish'],
    ['Q_function / policy-gradient·loss', 'q function policy gradient loss'], ['Ｐｏｌｉｃｙ', 'policy'],
    ['series species physics mathematics news minimax', 'series species physics mathematics news minimax'],
    ['status analysis chaos', 'status analysis chaos'],
  ])('%s → %s', (input, expected) => expect(termKey(input)).toBe(expected));
  it('splits short parenthetical aliases only', () => {
    expect(splitParenAlias('Proximal Policy Optimization (PPO)')).toEqual({ term: 'Proximal Policy Optimization', aliases: ['PPO'] });
    expect(splitParenAlias('Policy (one two three four five)').aliases).toEqual([]);
  });
  it.each(['', '123', '∑', 'x', 'yes', 'false', 'start', 'end', 'stop', 'boxes', 'circle', 'n12', 'group 42', 'one two three four five six seven eight nine'])('rejects non-concept %s', s => expect(isConceptLabel(s)).toBe(false));
  it('keeps near misses distinct', () => {
    const terms = ['policy', 'policy gradient', 'RLHF', 'RLVR', 'Q function', 'value function'];
    expect(new Set(terms.map(termKey)).size).toBe(terms.length);
  });
});
