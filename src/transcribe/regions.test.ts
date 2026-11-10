import { describe, expect, it } from 'vitest';
import { stroke } from '../__tests__/helpers';
import type { DigitalBlock, InkStroke } from '../model/page';
import { newId, unionBounds } from '../model/page';
import { arrowTwoStrokes, line, rect, rectLines, resetSynthetic, textLine } from '../__tests__/shapes';
import { buildStrokeGroups, computeDirtyRegions, mergeBlocks, mergeWithGeometry, protectEditedBlocks, rawToDigitalBlock, reconcileFigureBlocks } from './regions';
import type { StrokeGroupMeta } from './types';

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
  it('only strips the corrected text as a whole word, never inside a new word', () => {
    const edited = block('h', ['a'], { left: 0, top: 0, right: 40, bottom: 20 }, { text: 'cat', userEdited: true });
    const mixed = block('n', ['a', 'b', 'c', 'd'], { left: 0, top: 0, right: 120, bottom: 20 }, { text: 'catalog' });
    const repeated = block('m', ['a', 'e', 'f', 'g'], { left: 0, top: 0, right: 120, bottom: 20 }, { text: 'Cat, dog' });
    const r = protectEditedBlocks([edited], [mixed, repeated], new Set(['b', 'c', 'd', 'e', 'f', 'g']));
    expect(r.incoming.map((b) => b.text)).toEqual(['catalog', ', dog']);
    const zh = protectEditedBlocks(
      [block('z', ['a'], { left: 0, top: 0, right: 40, bottom: 20 }, { text: '你好', userEdited: true })],
      [block('w', ['a', 'b', 'c', 'd'], { left: 0, top: 0, right: 120, bottom: 20 }, { text: '你好世界' })],
      new Set(['b', 'c', 'd']),
    );
    expect(zh.incoming.map((b) => b.text)).toEqual(['世界']);
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

  it('gives each replaced id to at most one incoming block', () => {
    const old1 = block('old1', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'same' });
    const new1 = block('n1', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'same' });
    const new2 = block('n2', ['b'], { left: 0, top: 40, right: 100, bottom: 60 }, { text: 'same' });
    const ids = mergeBlocks([old1], ['old1'], [new1, new2]).map((b) => b.id);
    expect(ids).toEqual(['old1', 'n2']);
  });

  it('puts footnote definitions last', () => {
    const def = block('d', [], { left: 0, top: 0, right: 10, bottom: 10 }, { kind: 'footnote_def', marker: '*' });
    const para = block('p', [], { left: 0, top: 100, right: 10, bottom: 110 });
    expect(mergeBlocks([], [], [def, para]).map((b) => b.id)).toEqual(['p', 'd']);
  });
});

describe('shape hints on stroke groups', () => {
  it('attaches geometry hints and a shared figure to the groups of a drawing', () => {
    resetSynthetic();
    const strokes = [rect(0, 0, 120, 80, 0), ...arrowTwoStrokes(125, 40, 235, 40, 6000), rect(240, 0, 360, 80, 12000), ...textLine(0, 160, 14, 18, 30000)];
    const groups = buildStrokeGroups(strokes);
    const drawn = groups.filter((g) => g.figure);
    expect(drawn.length).toBeGreaterThanOrEqual(2);
    expect(new Set(drawn.map((g) => g.figure!.id)).size).toBe(1);
    expect(drawn[0].figure!.kind).toBe('flowchart');
    expect(drawn.some((g) => /rectangle|square/.test(g.hint ?? ''))).toBe(true);
    const text = groups.find((g) => g.strokeIds.includes(strokes[strokes.length - 1].id))!;
    expect(text.figure).toBeUndefined();
    expect(text.hint).toMatch(/looks like text/);
  });
});

describe('reconcileFigureBlocks', () => {
  const scene = () => {
    resetSynthetic();
    const box1 = rect(0, 0, 120, 80, 0);
    const arrow = arrowTwoStrokes(125, 40, 235, 40, 6000);
    const box2 = rect(240, 0, 360, 80, 12000);
    const label = textLine(30, 50, 3, 16, 20000);
    const note = textLine(0, 160, 14, 18, 30000);
    const strokes = [box1, ...arrow, box2, ...label, ...note];
    const groups = buildStrokeGroups(strokes);
    const groupOf = (s: InkStroke) => groups.find((g) => g.strokeIds.includes(s.id))!;
    const block = (kind: DigitalBlock['kind'], text: string, gs: ReturnType<typeof groupOf>[], extra: Partial<DigitalBlock> = {}): DigitalBlock => ({
      id: newId('blk'),
      kind,
      text,
      bbox: gs.map((g) => g.bbox).reduce(unionBounds),
      strokeIds: gs.flatMap((g) => g.strokeIds),
      confidence: 0.7,
      ...extra,
    });
    return { strokes, groups, groupOf, block, box1, arrow, box2, label, note };
  };

  it('puts the figure groups the geometry found in one diagram block', () => {
    const { groups, groupOf, box1, arrow, box2, label, note } = scene();
    const figGroups = new Set([box1, ...arrow, box2, ...label].map((s) => groupOf(s).index));
    expect(figGroups.size).toBeGreaterThanOrEqual(2);
    expect(figGroups.has(groupOf(note[0]).index)).toBe(false);
    expect(groups.filter((g) => g.figure).map((g) => g.index).sort()).toEqual([...figGroups].sort());
  });

  it('merges a drawing the model split into paragraphs into one diagram block and keeps the note beside it as text', () => {
    const { strokes, groups, groupOf, block, box1, arrow, box2, label, note } = scene();
    const incoming = [
      block('paragraph', 'II', [groupOf(box1)]),
      block('paragraph', '-->', [...new Set(arrow.map(groupOf))]),
      block('paragraph', 'Il', [groupOf(box2)]),
      block('paragraph', 'go', [groupOf(label[0])]),
      block('paragraph', 'some notes written beside it', [groupOf(note[0])]),
    ];
    const out = reconcileFigureBlocks(incoming, groups, strokes);
    expect(out).toHaveLength(2);
    const diagram = out.find((b) => b.kind === 'diagram')!;
    const text = out.find((b) => b.kind === 'paragraph')!;
    expect(text.text).toBe('some notes written beside it');
    expect(diagram.strokeIds.sort()).toEqual([box1, ...arrow, box2, ...label].map((s) => s.id).sort());
    expect(diagram.figure!.kind).toBe('flowchart');
    expect(diagram.figure!.labels).toEqual(['go']);
    expect(diagram.figure!.edges).toEqual([{ from: 'go', to: 'rectangle 2', kind: 'arrow', inferred: true }]);
    expect(diagram.text).toMatch(/^Shape: .*Labels: go/);
  });

  it('keeps the model diagram block and its figure, adding labels it read as separate text', () => {
    const { strokes, groups, groupOf, block, box1, arrow, box2, label, note } = scene();
    const incoming = [
      block('diagram', 'Shape: two boxes joined by an arrow. Labels: go. Relations: go → B.', [groupOf(box1), ...new Set(arrow.map(groupOf)), groupOf(box2)], {
        figure: { kind: 'flowchart', shapes: ['two rectangles', 'arrow'], labels: ['go'], edges: [{ from: 'go', to: 'B' }] },
      }),
      block('paragraph', 'go', [groupOf(label[0])]),
      block('paragraph', 'some notes written beside it', [groupOf(note[0])]),
    ];
    const out = reconcileFigureBlocks(incoming, groups, strokes);
    expect(out.map((b) => b.kind).sort()).toEqual(['diagram', 'paragraph']);
    const diagram = out.find((b) => b.kind === 'diagram')!;
    expect(diagram.id).toBe(incoming[0].id);
    expect(diagram.text).toMatch(/^Shape: two boxes/);
    expect(diagram.figure).toMatchObject({ kind: 'flowchart', shapes: ['two rectangles', 'arrow'], labels: ['go'], edges: [{ from: 'go', to: 'B' }] });
    // Geometry knows the second box but not its word: no placeholder edge is added next to the model's.
    expect(diagram.figure!.edges).toHaveLength(1);
    expect(diagram.figure!.nodes?.map((n) => n.label)).toEqual(['go', 'rectangle 2']);
    expect(diagram.strokeIds).toContain(label[0].id);
  });

  it('creates the diagram block when the model skipped the drawing entirely', () => {
    const { strokes, groups, groupOf, block, note } = scene();
    const out = reconcileFigureBlocks([block('paragraph', 'some notes written beside it', [groupOf(note[0])])], groups, strokes);
    expect(out.map((b) => b.kind)).toEqual(['diagram', 'paragraph']);
    expect(out[0].text).toMatch(/^Shape: /);
    expect(out[0].figure!.shapes.length).toBeGreaterThan(0);
  });

  it('splits a text block that the model lumped with part of the drawing', () => {
    const { strokes, groups, groupOf, block, box2, note } = scene();
    const lumped = block('paragraph', 'some notes written beside it', [groupOf(note[0]), groupOf(box2)]);
    // note has 14 strokes, box2 has 1: mostly text, so it stays text minus the drawing stroke.
    const out = reconcileFigureBlocks([lumped], groups, strokes);
    const text = out.find((b) => b.kind === 'paragraph')!;
    expect(text.text).toBe('some notes written beside it');
    expect(text.strokeIds).not.toContain(box2.id);
    expect(out.find((b) => b.kind === 'diagram')!.strokeIds).toContain(box2.id);
  });

  it('keeps a label the model read on the group that also holds its box', () => {
    resetSynthetic();
    const box1 = rect(0, 0, 120, 80, 0);
    const l1 = textLine(25, 50, 5, 16, 1000);
    const arrow = arrowTwoStrokes(125, 40, 235, 40, 9000);
    const box2 = rect(240, 0, 360, 80, 12000);
    const l2 = textLine(265, 50, 3, 16, 13000);
    const strokes = [box1, ...l1, ...arrow, box2, ...l2];
    const groups = buildStrokeGroups(strokes);
    const groupOf = (s: InkStroke) => groups.find((g) => g.strokeIds.includes(s.id))!;
    expect(groupOf(box1)).toBe(groupOf(l1[0]));
    const block = (text: string, g: StrokeGroupMeta): DigitalBlock => ({ id: text, kind: 'paragraph', text, bbox: g.bbox, strokeIds: g.strokeIds, confidence: 0.9 });
    const out = reconcileFigureBlocks([block('start', groupOf(box1)), block('end', groupOf(box2))], groups, strokes);
    const diagram = out.find((b) => b.kind === 'diagram');
    expect(diagram?.figure?.labels).toEqual(['start', 'end']);
    expect(diagram?.figure?.edges).toEqual([{ from: 'start', to: 'end', kind: 'arrow', inferred: true }]);
  });

  it('keeps every digit of a numeric label', () => {
    const { strokes, groups, groupOf, block, label } = scene();
    const out = reconcileFigureBlocks([block('paragraph', '0', [groupOf(label[0])]), block('list', '- 1', [groupOf(label[0])]), block('heading', '  # Start', [groupOf(label[0])])], groups, strokes);
    expect(out.find((b) => b.kind === 'diagram')?.figure?.labels).toEqual(['0', '1', 'Start']);
  });

  it('drops an empty diagram block the model put on text beside the figure', () => {
    const { strokes, groups, groupOf, block, box1, note } = scene();
    const out = reconcileFigureBlocks([block('diagram', 'Shape: box.', [groupOf(box1)]), block('diagram', '', [groupOf(note[0])])], groups, strokes);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('diagram');
    expect(out[0].strokeIds).not.toContain(note[0].id);
  });

  it('fills in an edge the arrow clearly draws but the model left out, marked as inferred, and keeps the model edges', () => {
    const { groups, strokes, groupOf, block, box1, arrow, box2, label } = scene();
    const second = textLine(270, 50, 3, 16, 40000);
    const all = [...strokes, ...second];
    const groups2 = buildStrokeGroups(all);
    const g = (s: InkStroke) => groups2.find((x) => x.strokeIds.includes(s.id))!;
    void groups;
    void groupOf;
    const diagram = block('diagram', 'Shape: two boxes.', [g(box1), g(arrow[0]), g(box2)], {
      figure: { kind: 'flowchart', shapes: ['box', 'box'], labels: ['go', 'stop'], edges: [{ from: 'stop', to: 'elsewhere' }] },
    });
    const out = reconcileFigureBlocks([diagram, block('paragraph', 'go', [g(label[0])]), block('paragraph', 'stop', [g(second[0])])], groups2, all);
    const fig = out.find((b) => b.kind === 'diagram')!.figure!;
    expect(fig.edges).toEqual([{ from: 'stop', to: 'elsewhere' }, { from: 'go', to: 'stop', kind: 'arrow', inferred: true }]);
    expect(fig.nodes?.map((n) => n.label)).toEqual(['go', 'stop']);
    expect(fig.sequence).toEqual(['go', 'stop']);
  });

  it('folds two diagram blocks the model returned for one figure into one, keeping both their labels and edges', () => {
    const { groups, strokes, groupOf, block, box1, arrow, box2, label } = scene();
    const d1 = block('diagram', 'Shape: a box.', [groupOf(box1), groupOf(label[0])], { figure: { kind: 'flowchart', shapes: ['box'], labels: ['go'], edges: [] } });
    const d2 = block('diagram', '', [groupOf(arrow[0]), groupOf(box2)], { figure: { kind: 'other', shapes: ['box', 'arrow'], labels: ['B'], edges: [{ from: 'go', to: 'B' }] } });
    const out = reconcileFigureBlocks([d1, d2], groups, strokes);
    const diagrams = out.filter((b) => b.kind === 'diagram');
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].text).toBe('Shape: a box.');
    expect(diagrams[0].figure).toMatchObject({ kind: 'flowchart', shapes: ['box', 'arrow'], labels: ['go', 'B'], edges: [{ from: 'go', to: 'B' }] });
  });

  it('completes a model edge with the label and kind the geometry read for it', () => {
    const geo = { nodes: [{ id: 'n1', label: 'a' }, { id: 'n2', label: 'b' }], edges: [{ from: 'a', to: 'b', kind: 'arrow' as const, label: 'yes' }], sequence: ['a', 'b'], unnamed: [] };
    const hint = { id: 0, groupIndices: [0], kind: 'flowchart' as const, shapes: [], labelGroups: [], labelInside: {}, labelHostGroups: [], edges: [], nodes: [], relations: [], order: [], orderBasis: '', summary: '' };
    const fig = mergeWithGeometry({ kind: 'flowchart', shapes: [], labels: ['a', 'b'], edges: [{ from: 'A', to: 'b' }] }, hint, ['a', 'b'], geo);
    expect(fig.edges).toEqual([{ from: 'A', to: 'b', label: 'yes', kind: 'arrow' }]);
    expect(fig.sequence).toEqual(['a', 'b']);
    expect(fig.nodes).toEqual(geo.nodes);
  });

  it('does not add geometry edges to unnamed shapes next to the model edges, but uses them when the model gave none', () => {
    const geo = { nodes: [{ id: 'n1', label: 'a' }, { id: 'n2', label: 'rectangle 2' }], edges: [{ from: 'a', to: 'rectangle 2', kind: 'arrow' as const }], unnamed: ['rectangle 2'] };
    const hint = { id: 0, groupIndices: [0], kind: 'flowchart' as const, shapes: ['rectangle'], labelGroups: [], labelInside: {}, labelHostGroups: [], edges: [], nodes: [], relations: [], order: [], orderBasis: '', summary: '' };
    expect(mergeWithGeometry({ kind: 'flowchart', shapes: [], labels: ['a'], edges: [{ from: 'a', to: 'c' }] }, hint, ['a'], geo).edges).toEqual([{ from: 'a', to: 'c' }]);
    expect(mergeWithGeometry(undefined, hint, ['a'], geo).edges).toEqual([{ from: 'a', to: 'rectangle 2', kind: 'arrow', inferred: true }]);
    expect(mergeWithGeometry({ kind: 'table', shapes: [], labels: [], edges: [] }, hint, [], { ...geo, cells: [['x', ''], ['', '']] }).cells).toEqual([['x', ''], ['', '']]);
  });

  it('gives a stroke-less model diagram to the figure it overlaps and names geometry nodes with the model words by hint id', () => {
    const { groups, strokes, block, groupOf, box1 } = scene();
    const figBox = groups.filter((g) => g.figure).map((g) => g.bbox).reduce(unionBounds);
    const orphan: DigitalBlock = { ...block('diagram', 'Shape: two boxes.', [groupOf(box1)]), strokeIds: [], bbox: figBox, figure: { kind: 'flowchart', shapes: [], labels: ['go', 'stop'], edges: [], nodes: [{ id: 'n1', label: 'go' }, { id: 'n2', label: 'stop' }] } };
    const out = reconcileFigureBlocks([orphan], groups, strokes);
    const diagrams = out.filter((b) => b.kind === 'diagram');
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].strokeIds.length).toBeGreaterThan(0);
    expect(diagrams[0].figure).toMatchObject({ labels: ['go', 'stop'], edges: [{ from: 'go', to: 'stop', kind: 'arrow', inferred: true }], sequence: ['go', 'stop'] });
  });

  it('turns a model "table" text block on a drawn grid into the figure cells', () => {
    const grid = [...rectLines(0, 0, 300, 150, 0), line(0, 50, 300, 50, 6000), line(0, 100, 300, 100, 12000), line(150, 0, 150, 150, 18000)];
    const words = [...textLine(40, 30, 3, 14, 30000), ...textLine(190, 30, 3, 14, 40000), ...textLine(40, 80, 3, 14, 50000)];
    const strokes = [...grid, ...words];
    const groups = buildStrokeGroups(strokes);
    expect(groups.find((g) => g.figure)!.figure!.kind).toBe('table');
    const wordGroups = groups.filter((g) => g.strokeIds.some((id) => words.some((w) => w.id === id)));
    const tableBlock: DigitalBlock = { id: 'tb', kind: 'table', text: 'name qty\nnut', bbox: wordGroups.map((g) => g.bbox).reduce(unionBounds), strokeIds: wordGroups.flatMap((g) => g.strokeIds), confidence: 0.8 };
    const out = reconcileFigureBlocks([tableBlock], groups, strokes);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('diagram');
    expect(out[0].figure!.cells).toEqual([['name', 'qty'], ['nut', '']]);
    expect(out[0].figure!.labels).toEqual(expect.arrayContaining(['name', 'qty', 'nut']));
  });

  it('is a no-op without figures', () => {
    const strokes = [stroke(0, 0, 50, 0, 0, 'a')];
    const groups = buildStrokeGroups(strokes);
    const blocks: DigitalBlock[] = [{ id: 'x', kind: 'paragraph', text: 'hi', bbox: groups[0].bbox, strokeIds: ['a'], confidence: 1 }];
    expect(reconcileFigureBlocks(blocks, groups, strokes)).toBe(blocks);
  });
});
