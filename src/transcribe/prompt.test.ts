import { describe, expect, it } from 'vitest';
import { ModelOutputError, extractJson } from './prompt';
import { looksDegenerate, normaliseBlocks, pickSaner } from './openaiCompat';

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

describe('looksDegenerate / pickSaner', () => {
  const para = (n: number) => ({ kind: 'paragraph' as const, text: Array.from({ length: n }, (_, i) => `w${i}`).join(' '), bbox: { left: 0, top: 0, right: 1, bottom: 1 }, groupIndices: [], confidence: 1 });
  const region = (groups: number, strokes: number) => ({ groups: Array.from({ length: groups }, (_, index) => ({ index, strokeIds: [], bbox: { left: 0, top: 0, right: 1, bottom: 1 }, writtenOrder: index })), strokes: Array.from({ length: strokes }, () => ({}) as never) });
  it('flags replies with far more words than the ink could hold', () => {
    expect(looksDegenerate([para(140)], region(60, 631))).toBe(false); // page 1 for real: ~2.3 words per line-group
    expect(looksDegenerate([para(545)], region(60, 631))).toBe(true); // the runaway dots-3 reply
    expect(looksDegenerate([para(30)], region(1, 48))).toBe(false); // three lines merged into one group: stroke bound saves it
    expect(looksDegenerate([para(20)], region(1, 6))).toBe(false); // tiny regions get a floor of 4 groups
    expect(looksDegenerate([], region(10, 10))).toBe(false);
  });
  it('never replaces content with an empty retry and prefers the sane reply', () => {
    const r = region(60, 631);
    const bad = { blocks: [para(545)], model: 'm', durationMs: 1 };
    const empty = { blocks: [], model: 'm', durationMs: 1 };
    const good = { blocks: [para(140)], model: 'm', durationMs: 1 };
    const worse = { blocks: [para(700)], model: 'm', durationMs: 1 };
    expect(pickSaner(bad, empty, r)).toBe(bad);
    expect(pickSaner(bad, good, r)).toBe(good);
    expect(pickSaner(bad, worse, r)).toBe(bad);
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

  it('drops looped repeats of a line that point at the same region, keeps genuine repeats elsewhere', () => {
    const line = '- uses worktrees to run agents in parallel';
    const blocks = normaliseBlocks({
      blocks: [
        { kind: 'list', text: line, bbox: { left: 0, top: 0, right: 300, bottom: 30 }, groupIndices: [2] },
        { kind: 'paragraph', text: 'now you have crewmates', bbox: { left: 0, top: 40, right: 300, bottom: 70 }, groupIndices: [3] },
        { kind: 'list', text: line, bbox: { left: 0, top: 0, right: 300, bottom: 30 }, groupIndices: [2] }, // same group → loop
        { kind: 'list', text: line }, // no location at all → loop
        { kind: 'list', text: line, bbox: { left: 0, top: 500, right: 300, bottom: 530 }, groupIndices: [9] }, // written again lower down → keep
        { kind: 'paragraph', text: 'yes', bbox: { left: 0, top: 0, right: 30, bottom: 30 } },
        { kind: 'paragraph', text: 'yes', bbox: { left: 0, top: 0, right: 30, bottom: 30 } }, // short labels are never deduped
      ],
    });
    expect(blocks.map((b) => [b.text, b.bbox.top])).toEqual([
      [line, 0],
      ['now you have crewmates', 40],
      [line, 500],
      ['yes', 0],
      ['yes', 0],
    ]);
  });

  it('accepts bbox given as an [l,t,r,b] array (small local models do this)', () => {
    const [b] = normaliseBlocks({ blocks: [{ kind: 'paragraph', text: 'x', bbox: [38, 378, 1000, 511], confidence: 0.9, marker: '*' }] });
    expect(b.bbox).toEqual({ left: 38, top: 378, right: 1000, bottom: 511 });
    expect(b.marker).toBe('*');
  });
});
