import { describe, expect, it } from 'vitest';
import { buildProfile, glossaryFromCorrections, type Correction } from './handwritingProfile';

const corr = (modelText: string, userText: string, createdAt = 0): Correction => ({
  id: `c${createdAt}`,
  pageId: 'p',
  blockId: 'b',
  imageDataUrl: 'data:image/png;base64,AAAA',
  modelText,
  userText,
  createdAt,
});

describe('glossaryFromCorrections', () => {
  it('collects the words the model missed, most frequent first', () => {
    const g = glossaryFromCorrections([corr('PP0 clips the ratio', 'PPO clips the ratio'), corr('RLHF uses PP0', 'RLHF uses PPO'), corr('the', 'the')]);
    expect(g[0]).toBe('PPO');
    expect(g).not.toContain('the');
    expect(g).not.toContain('RLHF'); // model already had it right
  });
});

describe('buildProfile', () => {
  it('limits examples and merges user glossary', () => {
    const corrections = Array.from({ length: 20 }, (_, i) => corr('x', `word${i}`, i));
    const p = buildProfile(corrections, { habits: ['writes * footnotes'], glossary: ['RLVR'] }, 4);
    expect(p.examples).toHaveLength(4);
    expect(p.glossary[0]).toBe('RLVR');
    expect(p.habits).toEqual(['writes * footnotes']);
  });
});
