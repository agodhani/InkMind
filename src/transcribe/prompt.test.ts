import { describe, expect, it } from 'vitest';
import { extractJson } from './prompt';
import { normaliseBlocks } from './openaiCompat';

describe('extractJson', () => {
  it('parses plain, fenced, and prose-wrapped JSON', () => {
    expect(extractJson('{"blocks":[]}')).toEqual({ blocks: [] });
    expect(extractJson('```json\n{"blocks":[]}\n```')).toEqual({ blocks: [] });
    expect(extractJson('Sure! {"blocks":[{"kind":"paragraph"}]} hope that helps')).toEqual({ blocks: [{ kind: 'paragraph' }] });
  });
});

describe('normaliseBlocks', () => {
  it('coerces unknown kinds, drops empty text, keeps empty diagrams', () => {
    const blocks = normaliseBlocks({
      blocks: [
        { kind: 'weird', text: 'x', bbox: { left: 1, top: 2, right: 3, bottom: 4 }, groupIndices: [0, 'bad'], confidence: 2 },
        { kind: 'paragraph', text: '   ' },
        { kind: 'diagram', text: '', bbox: {} },
        null,
      ],
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'unknown', text: 'x', groupIndices: [0], confidence: 2 });
    expect(blocks[1]).toMatchObject({ kind: 'diagram', bbox: { left: 0, top: 0, right: 0, bottom: 0 }, confidence: 0.5 });
  });

  it('accepts bbox given as an [l,t,r,b] array (small local models do this)', () => {
    const [b] = normaliseBlocks({ blocks: [{ kind: 'paragraph', text: 'x', bbox: [38, 378, 1000, 511], confidence: 0.9, marker: '*' }] });
    expect(b.bbox).toEqual({ left: 38, top: 378, right: 1000, bottom: 511 });
    expect(b.marker).toBe('*');
  });
});
