import { describe, expect, it } from 'vitest';
import { stroke } from '../__tests__/helpers';
import type { DigitalBlock } from '../model/page';
import { buildStrokeGroups, computeDirtyRegions, mergeBlocks, protectEditedBlocks, rawToDigitalBlock } from './regions';

const block = (id: string, strokeIds: string[], bbox: DigitalBlock['bbox'], extra: Partial<DigitalBlock> = {}): DigitalBlock => ({
  id,
  kind: 'paragraph',
  text: `text ${id}`,
  bbox,
  strokeIds,
  confidence: 0.9,
  ...extra,
});

describe('computeDirtyRegions', () => {
  it('returns nothing when nothing changed', () => {
    const s = stroke(0, 0, 50, 0, 0, 'a');
    expect(computeDirtyRegions({ strokes: [s], blocks: [] }, new Set())).toEqual([]);
  });

  it('pulls in the existing block a new stroke touches, plus that block strokes', () => {
    const a = stroke(0, 0, 100, 0, 0, 'a');
    const b = stroke(110, 0, 200, 0, 1000, 'b');
    const far = stroke(0, 600, 100, 600, 2000, 'far');
    const existing = block('blk1', ['a'], { left: 0, top: -1, right: 101, bottom: 1 });
    const farBlock = block('blk2', ['far'], { left: 0, top: 599, right: 101, bottom: 601 });
    const regions = computeDirtyRegions({ strokes: [a, b, far], blocks: [existing, farBlock] }, new Set(['b']));
    expect(regions).toHaveLength(1);
    expect(regions[0].replacedBlockIds).toEqual(['blk1']);
    expect(regions[0].strokes.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('re-transcribes a block whose stroke was deleted even with no new ink', () => {
    const a = stroke(0, 0, 100, 0, 0, 'a');
    const existing = block('blk1', ['a', 'gone'], { left: 0, top: -1, right: 101, bottom: 1 });
    const regions = computeDirtyRegions({ strokes: [a], blocks: [existing] }, new Set(), new Set(['gone']));
    expect(regions).toHaveLength(1);
    expect(regions[0].replacedBlockIds).toEqual(['blk1']);
    expect(regions[0].strokes.map((s) => s.id)).toEqual(['a']);
  });

  it('merges two dirty clusters that overlap into one region', () => {
    const a = stroke(0, 0, 100, 0, 0, 'a');
    const b = stroke(20, 30, 120, 30, 100_000, 'b'); // far apart in time, close in space
    const regions = computeDirtyRegions({ strokes: [a, b], blocks: [] }, new Set(['a', 'b']));
    expect(regions).toHaveLength(1);
    expect(regions[0].strokes).toHaveLength(2);
  });
});

describe('buildStrokeGroups', () => {
  it('orders groups top-to-bottom and records written order', () => {
    const second = stroke(0, 100, 50, 100, 0, 'second-line-written-first');
    const first = stroke(0, 0, 50, 0, 10_000, 'first-line-written-second');
    const groups = buildStrokeGroups([second, first]);
    expect(groups.map((g) => g.strokeIds[0])).toEqual(['first-line-written-second', 'second-line-written-first']);
    expect(groups.map((g) => g.writtenOrder)).toEqual([1, 0]);
    expect(groups.map((g) => g.index)).toEqual([0, 1]);
  });
});

describe('rawToDigitalBlock', () => {
  it('uses stroke groups for bbox and stroke ids when given', () => {
    const groups = buildStrokeGroups([stroke(0, 0, 50, 0, 0, 'a'), stroke(0, 100, 50, 100, 5000, 'b')]);
    const blk = rawToDigitalBlock(
      { kind: 'paragraph', text: 'hi', bbox: { left: 0, top: 0, right: 0, bottom: 0 }, groupIndices: [1], confidence: 0.8 },
      groups,
      { left: -24, top: -24, right: 74, bottom: 124 },
      { width: 196, height: 296 },
      [],
    );
    expect(blk.strokeIds).toEqual(['b']);
    expect(blk.bbox.top).toBeCloseTo(99);
  });

  it('falls back to mapping image-pixel bbox into page space', () => {
    const s = stroke(10, 10, 40, 10, 0, 'a');
    const blk = rawToDigitalBlock(
      { kind: 'paragraph', text: 'hi', bbox: { left: 0, top: 0, right: 100, bottom: 50 }, groupIndices: [], confidence: 0.8 },
      [],
      { left: 0, top: 0, right: 200, bottom: 100 },
      { width: 400, height: 200 },
      [s],
    );
    expect(blk.bbox).toEqual({ left: 0, top: 0, right: 50, bottom: 25 });
    expect(blk.strokeIds).toEqual(['a']);
  });
});

describe('protectEditedBlocks', () => {
  it('keeps a corrected block whose strokes did not change and strips its strokes from incoming', () => {
    const edited = block('h', ['a', 'b'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'Backpropagation', userEdited: true });
    const other = block('p', ['c'], { left: 0, top: 40, right: 100, bottom: 60 });
    const reread = block('n1', ['a', 'b', 'c'], { left: 0, top: 0, right: 120, bottom: 60 }, { text: 'Back propagation and more' });
    const fresh = block('n2', ['d'], { left: 0, top: 80, right: 100, bottom: 100 });
    const r = protectEditedBlocks([edited, other], [reread, fresh], new Set(['d']));
    expect(r.replacedIds).toEqual(['p']);
    // n1 is mostly a re-read of the corrected strokes → dropped (its 'c' is re-grouped on the next pause)
    expect(r.incoming.map((b) => [b.id, b.strokeIds])).toEqual([['n2', ['d']]]);
    const merged = mergeBlocks([edited, other], r.replacedIds, r.incoming);
    expect(merged.find((b) => b.id === 'h')?.text).toBe('Backpropagation');
  });
  it('drops a re-read that is mostly the corrected strokes, keeps and trims a mostly-new block', () => {
    const edited = block('h', ['a', 'b'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'Backpropagation', userEdited: true });
    const mostlyOld = block('n1', ['a', 'b', 'c'], { left: 0, top: 0, right: 120, bottom: 40 }, { text: 'Back propagation and' });
    const mostlyNew = block('n2', ['a', 'c', 'd', 'e'], { left: 0, top: 0, right: 120, bottom: 60 }, { text: 'Backpropagation and more words' });
    const r = protectEditedBlocks([edited], [mostlyOld, mostlyNew], new Set(['c', 'd', 'e']));
    expect(r.incoming.map((b) => [b.id, b.strokeIds, b.text])).toEqual([['n2', ['c', 'd', 'e'], 'and more words']]);
  });
  it('lets a corrected block be re-read once its own strokes change', () => {
    const edited = block('h', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'fixed', userEdited: true });
    const r = protectEditedBlocks([edited], [block('n', ['a'], { left: 0, top: 0, right: 100, bottom: 20 })], new Set(['a']));
    expect(r.replacedIds).toEqual(['h']);
    expect(r.incoming).toHaveLength(1);
  });
});

describe('mergeBlocks', () => {
  it('keeps ids for unchanged text and preserves user edits', () => {
    const old1 = block('old1', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'same' });
    const old2 = block('old2', ['b'], { left: 0, top: 40, right: 100, bottom: 60 }, { text: 'my fix', userEdited: true });
    const kept = block('kept', ['z'], { left: 0, top: 500, right: 100, bottom: 520 });
    const new1 = block('n1', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'same' });
    const new2 = block('n2', ['b'], { left: 0, top: 40, right: 100, bottom: 60 }, { text: 'model guess' });
    const merged = mergeBlocks([old1, old2, kept], ['old1', 'old2'], [new1, new2]);
    expect(merged.map((b) => b.id)).toEqual(['old1', 'old2', 'kept']);
    expect(merged[1].text).toBe('my fix');
    expect(merged[1].userEdited).toBe(true);
  });

  it('puts footnote definitions last', () => {
    const def = block('d', [], { left: 0, top: 0, right: 10, bottom: 10 }, { kind: 'footnote_def', marker: '*' });
    const para = block('p', [], { left: 0, top: 100, right: 10, bottom: 110 });
    expect(mergeBlocks([], [], [def, para]).map((b) => b.id)).toEqual(['p', 'd']);
  });
});
