import { describe, expect, it } from 'vitest';
import { ModelOutputError, extractJson } from './prompt';
import { normaliseBlocks } from './openaiCompat';

describe('extractJson', () => {
  it('parses plain, fenced, and prose-wrapped JSON', () => {
    expect(extractJson('{"blocks":[]}')).toEqual({ blocks: [] });
    expect(extractJson('```json\n{"blocks":[]}\n```')).toEqual({ blocks: [] });
    expect(extractJson('Sure! {"blocks":[{"kind":"paragraph"}]} hope that helps')).toEqual({ blocks: [{ kind: 'paragraph' }] });
  });
});

describe('extractJson salvage', () => {
  it('recovers complete blocks from a truncated reply', () => {
    const truncated = '{"blocks": [{"kind":"paragraph","text":"a } b","bbox":{"left":1,"top":2,"right":3,"bottom":4}}, {"kind":"list","text":"- x"}, {"kind":"para';
    expect(extractJson(truncated)).toEqual({
      blocks: [
        { kind: 'paragraph', text: 'a } b', bbox: { left: 1, top: 2, right: 3, bottom: 4 } },
        { kind: 'list', text: '- x' },
      ],
    });
  });
  it('throws a ModelOutputError carrying the raw text when nothing is salvageable', () => {
    expect(() => extractJson('nope')).toThrow(ModelOutputError);
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

  it('lifts fields nested inside bbox and reads [l,t,r,b] packed into bbox.left', () => {
    const [b] = normaliseBlocks({
      blocks: [{ kind: 'paragraph', text: 'x', bbox: { left: [787, 53, 1082, 148], top: [787, 53, 1082, 148], groupIndices: [0, 1], confidence: 0.8, marker: '', level: 0 } }],
    });
    expect(b.bbox).toEqual({ left: 787, top: 53, right: 1082, bottom: 148 });
    expect(b.groupIndices).toEqual([0, 1]);
    expect(b.confidence).toBe(0.8);
    expect(b.marker).toBeUndefined();
  });

  it('drops verbatim repeats of multi-word lines (model loops) but keeps short repeated labels', () => {
    const blocks = normaliseBlocks({
      blocks: [
        { kind: 'list', text: '- uses worktrees to run agents in parallel' },
        { kind: 'paragraph', text: 'now you have crewmates' },
        { kind: 'list', text: '- uses worktrees to run agents in parallel' },
        { kind: 'paragraph', text: 'yes' },
        { kind: 'paragraph', text: 'yes' },
      ],
    });
    expect(blocks.map((b) => b.text)).toEqual(['- uses worktrees to run agents in parallel', 'now you have crewmates', 'yes', 'yes']);
  });

  it('accepts bbox given as an [l,t,r,b] array (small local models do this)', () => {
    const [b] = normaliseBlocks({ blocks: [{ kind: 'paragraph', text: 'x', bbox: [38, 378, 1000, 511], confidence: 0.9, marker: '*' }] });
    expect(b.bbox).toEqual({ left: 38, top: 378, right: 1000, bottom: 511 });
    expect(b.marker).toBe('*');
  });
});
