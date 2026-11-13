import { describe, expect, it } from 'vitest';
import { stroke } from '../__tests__/helpers';
import type { DigitalBlock, FigureInfo, InkStroke } from '../model/page';
import { newId, unionBounds } from '../model/page';
import { arrowTwoStrokes, line, rect, rectLines, resetSynthetic, textLine } from '../__tests__/shapes';
import { buildStrokeGroups, computeDirtyRegions, mergeBlocks, mergeFigures, mergeWithGeometry, protectEditedBlocks, rawToDigitalBlock, reconcileFigureBlocks } from './regions';
import type { StrokeGroupMeta } from './types';
import { normaliseFigure } from './figure';
import type { FigureHint } from '../ink/shapeHints';

describe('geometry-first structure', () => {
  const hint: FigureHint = { id: 0, groupIndices: [], kind: 'flowchart', shapes: ['rectangle'], labelGroups: [], labelInside: {}, labelHostGroups: [], nodes: [], relations: [], edges: [], order: [], orderBasis: '', summary: '' };
  const geo = {
    nodes: [{ id: 'n1', label: 'rectangle 1', shape: 'rectangle', group: 1 }, { id: 'n2', label: 'rectangle 2', shape: 'rectangle', group: 2, parent: 'n1' }, { id: 'n3', label: 'rectangle 3', shape: 'rectangle', group: 3 }],
    edges: [{ from: 'rectangle 1', to: 'rectangle 2', kind: 'arrow' as const }, { from: 'rectangle 2', to: 'rectangle 3', kind: 'line' as const }],
    sequence: ['rectangle 1', 'rectangle 2', 'rectangle 3'], unnamed: ['rectangle 1', 'rectangle 2', 'rectangle 3'],
  };
  it('assigns exact unused labels in node reading order without changing arrow order', () => {
    const out = mergeWithGeometry(undefined, { ...hint, order: ['n3', 'n1', 'n2'], orderBasis: 'arrow order' }, ['first', 'second', 'third'], { ...geo, sequence: ['rectangle 3', 'rectangle 1', 'rectangle 2'] });
    expect(out.nodes!.map((n) => n.label)).toEqual(['first', 'second', 'third']);
    expect(out.edges[0]).toMatchObject({ from: 'first', to: 'second', kind: 'arrow' });
    expect(out.sequence).toEqual(['third', 'first', 'second']);
    expect(out.nodes![1].parent).toBe('n1');
  });
  it('uses the figure order when its basis is explicitly spatial', () => {
    const out = mergeWithGeometry(undefined, { ...hint, order: ['n3', 'n1', 'n2'], orderBasis: 'left→right' }, ['first', 'second', 'third'], geo);
    expect(out.nodes!.map((n) => n.label)).toEqual(['second', 'third', 'first']);
  });
  it('excludes words already named on nodes, edges, cells or sequences before exact matching', () => {
    const prior = normaliseFigure({ names: { n1: 'start' }, labels: ['start', 'yes', 'header', 'message', 'middle', 'end'], cells: [['header']], sequence: ['message'] })!;
    const out = mergeWithGeometry(prior, hint, prior.labels, { ...geo, edges: geo.edges.map((e, i) => i === 0 ? { ...e, label: 'yes' } : e) });
    expect(out.nodes!.map((n) => n.label)).toEqual(['start', 'middle', 'end']);
  });
  it.each([{ labels: [] }, { labels: ['one', 'two'] }, { labels: ['one', 'two', 'three', 'extra'] }, { labels: ['n1', 'n2', 'n3'] }])('leaves unmatched placeholders for $labels', ({ labels }) => {
    const out = mergeWithGeometry(undefined, hint, labels, geo);
    expect(out.nodes!.map((n) => n.label)).toEqual(geo.unnamed);
  });
  it('uses hint ids when several geometry nodes share a label group', () => {
    const prior = normaliseFigure({ nodes: [{ id: 'n1', group: 0, label: 'outer' }, { id: 'n2', group: 0, label: 'inner' }, { id: 'n3', group: 0, label: 'core' }] })!;
    const out = mergeWithGeometry(prior, hint, prior.labels, { ...geo, nodes: geo.nodes.map((n) => ({ ...n, group: 0 })) });
    expect(out.nodes!.map((n) => n.label)).toEqual(['outer', 'inner', 'core']);
    expect(out.nodes![1].parent).toBe('n1');
    expect(out.edges[0]).toMatchObject({ from: 'outer', to: 'inner', kind: 'arrow' });
  });
  it('keeps model words as labels when text-group naming or a smaller geometry grid wins', () => {
    const prior = normaliseFigure({ names: { n1: 'model word' }, cells: [['header', 'extra column'], ['last row']] })!;
    const out = mergeWithGeometry(prior, { ...hint, kind: 'table' }, prior.labels, { ...geo, nodes: [{ ...geo.nodes[0], label: 'group word' }], unnamed: [], cells: [['']] });
    expect(out.nodes![0].label).toBe('group word');
    expect(out.cells).toEqual([['header']]);
    expect(out.labels).toEqual(expect.arrayContaining(['model word', 'group word', 'header', 'extra column', 'last row']));
  });
  it('keeps geometry nodes, directions, kinds, missing edges, order and nesting', () => {
    const prior = normaliseFigure({ kind: 'flowchart', names: { n1: 'start', n2: 'work', n3: 'end', n9: 'extra' }, edges: [{ from: 'n2', to: 'n1', label: 'yes', kind: 'line' }, { from: 'n1', to: 'n3' }], sequence: ['n3', 'n1', 'n2'] })!;
    const out = mergeWithGeometry(prior, hint, prior.labels, geo);
    expect(out.nodes).toEqual([{ id: 'n1', label: 'start', shape: 'rectangle', group: 1 }, { id: 'n2', label: 'work', shape: 'rectangle', group: 2, parent: 'n1' }, { id: 'n3', label: 'end', shape: 'rectangle', group: 3 }, { id: 'n9', label: 'extra' }]);
    expect(out.edges).toEqual([{ from: 'start', to: 'work', kind: 'arrow', label: 'yes', inferred: true }, { from: 'work', to: 'end', kind: 'line', inferred: true }]);
    expect(out.sequence).toEqual(['start', 'work', 'end']);
  });
  it('uses text-group names before model node names and ignores model nesting when geometry has nesting', () => {
    const prior = normaliseFigure({ nodes: [{ id: 'n1', label: 'wrong', parent: 'n3' }, { id: 'n2', label: 'child' }, { id: 'n3', label: 'outside', parent: 'n1' }], edges: [] })!;
    const out = mergeWithGeometry(prior, hint, ['n1', 'n2'], { ...geo, nodes: geo.nodes.map((n) => n.id === 'n1' ? { ...n, label: 'read' } : n), edges: [], unnamed: ['rectangle 2', 'rectangle 3'] });
    expect(out.nodes![0].label).toBe('read');
    expect(out.nodes![0].parent).toBeUndefined();
    expect(out.nodes![1].parent).toBe('n1');
    expect(out.nodes![2].parent).toBeUndefined();
    expect(out.labels).toEqual(expect.arrayContaining(['read', 'child']));
  });
  it('accepts model edges only between distinct known nodes when geometry has no relations', () => {
    const prior = normaliseFigure({ names: { n1: 'start', n2: 'end' }, edges: [{ from: 'n1', to: 'n2' }, { from: 'n1', to: 'n1' }, { from: 'start', to: 'unknown' }] })!;
    expect(mergeWithGeometry(prior, hint, [], { nodes: geo.nodes.slice(0, 2), edges: [], unnamed: geo.unnamed }).edges).toEqual([{ from: 'start', to: 'end' }]);
  });
  it('resolves fallback sequence ids and preserves the drawn table dimensions', () => {
    const prior = normaliseFigure({ labels: ['n1, N3'], sequence: ['n1', 'N3'], cells: [['a', 'b', 'extra'], ['c'], ['extra']] })!;
    const out = mergeWithGeometry(prior, { ...hint, kind: 'table' }, prior.labels, { nodes: geo.nodes, edges: [], unnamed: geo.unnamed, cells: [['', ''], ['', '']] });
    expect(out.sequence).toEqual(['rectangle 1', 'rectangle 3']);
    expect(out.labels).not.toEqual(expect.arrayContaining(['n1', 'N3']));
    expect(out.cells).toEqual([['a', 'b'], ['c', '']]);
  });
});

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
  const editedFigure: FigureInfo = {
    kind: 'flowchart', shapes: ['rectangle'], labels: ['Start', 'Work', 'custom label'],
    nodes: [{ id: 'n1', label: 'Start', shape: 'rectangle', group: 1, strokeIds: ['old-start'] }, { id: 'n2', label: 'Work', shape: 'rectangle', group: 2, strokeIds: ['old-work'] }, { id: 'gone', label: 'Removed' }],
    edges: [{ from: 'Start', to: 'Work', label: 'approved', kind: 'line' }], sequence: ['Start', 'Work', 'Removed'],
  };
  const redrawnFigure: FigureInfo = {
    kind: 'flowchart', shapes: ['ellipse', 'diamond'], labels: ['wrong start', 'wrong work', 'New'],
    nodes: [{ id: 'n2', label: 'wrong work', shape: 'ellipse', group: 2, parent: 'n1', strokeIds: ['new-work'] }, { id: 'n1', label: 'wrong start', shape: 'diamond', group: 1, strokeIds: ['new-start'] }, { id: 'n3', label: 'New', shape: 'rectangle', strokeIds: ['new-node'] }],
    edges: [{ from: 'wrong work', to: 'wrong start', label: 'wrong', kind: 'arrow' }, { from: 'wrong start', to: 'New', label: 'new edge', kind: 'line' }], sequence: ['wrong work', 'wrong start', 'New'],
  };
  const editedDiagram = () => block('edited', ['a', 'b'], { left: 0, top: 0, right: 100, bottom: 100 }, { kind: 'diagram', text: 'corrected caption', figure: editedFigure, userEdited: true });
  const redrawnDiagram = (text: string) => block('redraw', ['a', 'b', 'new-work'], { left: 0, top: 0, right: 110, bottom: 100 }, { kind: 'diagram', text, figure: redrawnFigure });

  it.each(['corrected caption', 'model caption'])('keeps corrected figure words after a redraw with %s', (caption) => {
    const before = structuredClone(editedFigure), redraw = structuredClone(redrawnFigure);
    const existing = editedDiagram(), incoming = redrawnDiagram(caption);
    const protectedResult = protectEditedBlocks([existing], [incoming], new Set(['a']));
    const result = mergeBlocks([existing], protectedResult.replacedIds, protectedResult.incoming)[0];
    expect(result).toMatchObject({ id: 'edited', text: 'corrected caption', userEdited: true });
    expect(result.figure).toEqual({ ...redrawnFigure, labels: editedFigure.labels,
      nodes: redrawnFigure.nodes!.map((n) => ({ ...n, label: n.id === 'n1' ? 'Start' : n.id === 'n2' ? 'Work' : 'New' })),
      edges: [{ from: 'Work', to: 'Start', label: 'approved', kind: 'arrow' }, { from: 'Start', to: 'New', label: 'new edge', kind: 'line' }], sequence: ['Work', 'Start', 'New'],
    });
    expect(editedFigure).toEqual(before);
    expect(redrawnFigure).toEqual(redraw);
  });
  it('updates geometry when new ink extends a corrected diagram without changing its old strokes', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    const protectedResult = protectEditedBlocks([existing], [incoming], new Set(['new-work']));
    expect(protectedResult.replacedIds).toEqual(['edited']);
    const result = mergeBlocks([existing], protectedResult.replacedIds, protectedResult.incoming)[0];
    expect(result.figure!.nodes!.map((n) => [n.id, n.label, n.strokeIds])).toEqual([
      ['n2', 'Work', ['new-work']], ['n1', 'Start', ['new-start']], ['n3', 'New', ['new-node']],
    ]);
  });
  it('matches corrected words by group and old label when node ids change', () => {
    const incoming = redrawnDiagram('model caption');
    incoming.figure = { ...redrawnFigure, nodes: [{ id: 'different', label: 'wrong work', group: 2, strokeIds: ['redrawn'] }, { id: 'other', label: 'Start' }], sequence: ['wrong work', 'Start'] };
    const result = mergeBlocks([editedDiagram()], ['edited'], [incoming])[0].figure!;
    expect(result.nodes).toEqual([{ id: 'different', label: 'Work', group: 2, strokeIds: ['redrawn'] }, { id: 'other', label: 'Start', strokeIds: ['old-start'] }]);
    expect(result.sequence).toEqual(['Work', 'Start']);
  });
  it('preserves independently corrected step words on matched nodes in their new order', () => {
    const existing = editedDiagram();
    existing.figure = { ...editedFigure, nodes: editedFigure.nodes!.slice(0, 2), sequence: ['Begin here', 'Do work'] };
    const result = mergeBlocks([existing], ['edited'], [redrawnDiagram('model caption')])[0];
    expect(result.figure!.sequence).toEqual(['Do work', 'Begin here', 'New']);
  });
  it('keeps unmatched new nodes and geometry when no corrected node matches', () => {
    const incoming = redrawnDiagram('model caption');
    incoming.figure = { kind: 'shape', shapes: ['triangle'], labels: ['new word'], nodes: [{ id: 'new', label: 'new word', strokeIds: ['new-shape'] }], edges: [], sequence: ['new word'] };
    const result = mergeBlocks([editedDiagram()], ['edited'], [incoming])[0];
    expect(result.figure).toEqual({ ...incoming.figure, labels: editedFigure.labels });
    const noFigure = { ...incoming, figure: undefined };
    expect(mergeBlocks([editedDiagram()], ['edited'], [noFigure])[0].figure).toEqual(editedFigure);
  });
  it('unions persisted node strokes when merging figure descriptions without mutating inputs', () => {
    const a: FigureInfo = { kind: 'shape', shapes: [], labels: ['node'], nodes: [{ id: 'n1', label: 'node', strokeIds: ['shape', 'label'] }], edges: [] };
    const b: FigureInfo = { ...a, nodes: [{ id: 'n1', label: 'node', strokeIds: ['label', 'more'] }] };
    expect(mergeFigures(a, b).nodes![0].strokeIds).toEqual(['shape', 'label', 'more']);
    expect(a.nodes![0].strokeIds).toEqual(['shape', 'label']);
    expect(b.nodes![0].strokeIds).toEqual(['label', 'more']);
  });
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
    expect(diagram.figure).toMatchObject({ kind: 'flowchart', labels: ['go'], edges: [{ from: 'go', to: 'rectangle 2', kind: 'arrow', inferred: true }] });
    expect(diagram.figure!.shapes).toEqual(expect.arrayContaining(['two rectangles', 'arrow']));
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

  it('keeps drawn edges and discards model-only edges when geometry found relations', () => {
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
    expect(fig.edges).toEqual([{ from: 'go', to: 'stop', kind: 'arrow', inferred: true }]);
    expect(fig.nodes?.map((n) => n.label)).toEqual(['go', 'stop']);
    expect(fig.sequence).toEqual(['go', 'stop']);
  });

  it('folds diagram blocks while retaining geometry edges even when their nodes are unnamed', () => {
    const { groups, strokes, groupOf, block, box1, arrow, box2, label } = scene();
    const d1 = block('diagram', 'Shape: a box.', [groupOf(box1), groupOf(label[0])], { figure: { kind: 'flowchart', shapes: ['box'], labels: ['go'], edges: [] } });
    const d2 = block('diagram', '', [groupOf(arrow[0]), groupOf(box2)], { figure: { kind: 'other', shapes: ['box', 'arrow'], labels: ['B'], edges: [{ from: 'go', to: 'B' }] } });
    const out = reconcileFigureBlocks([d1, d2], groups, strokes);
    const diagrams = out.filter((b) => b.kind === 'diagram');
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].text).toBe('Shape: a box.');
    expect(diagrams[0].figure).toMatchObject({ kind: 'flowchart', labels: ['go', 'B'] });
    expect(diagrams[0].figure!.edges).toEqual([{ from: 'rectangle 1', to: 'rectangle 2', kind: 'arrow', inferred: true }]);
  });

  it('completes a model edge with the label and kind the geometry read for it', () => {
    const geo = { nodes: [{ id: 'n1', label: 'a' }, { id: 'n2', label: 'b' }], edges: [{ from: 'a', to: 'b', kind: 'arrow' as const, label: 'yes' }], sequence: ['a', 'b'], unnamed: [] };
    const hint = { id: 0, groupIndices: [0], kind: 'flowchart' as const, shapes: [], labelGroups: [], labelInside: {}, labelHostGroups: [], edges: [], nodes: [], relations: [], order: [], orderBasis: '', summary: '' };
    const fig = mergeWithGeometry({ kind: 'flowchart', shapes: [], labels: ['a', 'b'], edges: [{ from: 'A', to: 'b' }] }, hint, ['a', 'b'], geo);
    expect(fig.edges).toEqual([{ from: 'a', to: 'b', label: 'yes', kind: 'arrow', inferred: true }]);
    expect(fig.sequence).toEqual(['a', 'b']);
    expect(fig.nodes).toEqual(geo.nodes);
  });

  it('retains geometry edges to unnamed shapes instead of unsupported model edges', () => {
    const geo = { nodes: [{ id: 'n1', label: 'a' }, { id: 'n2', label: 'rectangle 2' }], edges: [{ from: 'a', to: 'rectangle 2', kind: 'arrow' as const }], unnamed: ['rectangle 2'] };
    const hint = { id: 0, groupIndices: [0], kind: 'flowchart' as const, shapes: ['rectangle'], labelGroups: [], labelInside: {}, labelHostGroups: [], edges: [], nodes: [], relations: [], order: [], orderBasis: '', summary: '' };
    expect(mergeWithGeometry({ kind: 'flowchart', shapes: [], labels: ['a'], edges: [{ from: 'a', to: 'c' }] }, hint, ['a'], geo).edges).toEqual([{ from: 'a', to: 'rectangle 2', kind: 'arrow', inferred: true }]);
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

  it('resolves ids without model nodes through geometry and prefers text read on label groups', () => {
    const { groups, strokes, block, groupOf, box1, label } = scene();
    const prior = normaliseFigure({ kind: 'flowchart', labels: ['N1'], sequence: ['n1', 'n2'], edges: [{ from: 'n2', to: 'N1', label: 'back' }] });
    const out = reconcileFigureBlocks([block('diagram', '', [groupOf(box1)], { figure: prior }), block('paragraph', 'go', [groupOf(label[0])])], groups, strokes);
    const figure = out.find((b) => b.kind === 'diagram')!.figure!;
    expect(figure.labels).toContain('go');
    expect(figure.labels).not.toContain('N1');
    expect(figure.sequence).toEqual(['go', 'rectangle 2']);
    expect(figure.edges).toEqual([{ from: 'go', to: 'rectangle 2', label: 'back', kind: 'arrow', inferred: true }]);
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
    expect(out[0].figure!.cells).toEqual([['name', 'qty'], ['nut', ''], ['', '']]);
    expect(out[0].figure!.labels).toEqual(expect.arrayContaining(['name', 'qty', 'nut']));
  });

  it('aligns model nodes to geometry nodes by label group, and lets geometry decide shapes and nesting', () => {
    const geo = { nodes: [{ id: 'n1', label: 'circle 1', shape: 'circle', group: 1 }, { id: 'n2', label: 'circle 2', shape: 'circle', group: 8 }], edges: [{ from: 'circle 2', to: 'circle 1', kind: 'line' as const }], unnamed: ['circle 1', 'circle 2'] };
    const hint = { id: 0, groupIndices: [0], kind: 'mindmap' as const, shapes: [], labelGroups: [], labelInside: {}, labelHostGroups: [], edges: [], nodes: [], relations: [], order: [], orderBasis: '', summary: '' };
    const prior = { kind: 'sketch' as const, shapes: [], labels: ['topic', 'a'], edges: [], nodes: [{ id: 'n1', label: 'topic', shape: 'box 2', group: 8, parent: 'n2' }, { id: 'n2', label: 'a', group: 1 }] };
    const fig = mergeWithGeometry(prior, hint, ['topic', 'a'], geo);
    expect(fig.edges).toEqual([{ from: 'topic', to: 'a', kind: 'line', inferred: true }]);
    expect(fig.nodes).toEqual([{ id: 'n1', label: 'a', shape: 'circle', group: 1 }, { id: 'n2', label: 'topic', shape: 'circle', group: 8, parent: 'n1' }]);
    // A wrong group number on the model side still lets the hint id name the node.
    const byId = mergeWithGeometry({ ...prior, nodes: [{ id: 'n1', label: 'top', group: 99 }, { id: 'n2', label: 'side', group: 98 }] }, hint, [], geo);
    expect(byId.edges[0]).toMatchObject({ from: 'side', to: 'top' });
  });

  it('keeps differently labelled edges when folding diagram blocks, and leaves a far-away stroke-less diagram alone', () => {
    const merged = mergeFigures({ kind: 'flowchart', shapes: [], labels: [], edges: [{ from: 'a', to: 'b', label: 'yes' }] }, { kind: 'flowchart', shapes: [], labels: [], edges: [{ from: 'a', to: 'b', label: 'no' }, { from: 'a', to: 'b', label: 'yes' }] });
    expect(merged.edges).toEqual([{ from: 'a', to: 'b', label: 'yes' }, { from: 'a', to: 'b', label: 'no' }]);
    expect(mergeFigures({ kind: 'flowchart', shapes: [], labels: [], edges: [{ from: 'a', to: 'b' }] }, { kind: 'flowchart', shapes: [], labels: [], edges: [{ from: 'a', to: 'b', label: 'yes' }] }).edges).toEqual([{ from: 'a', to: 'b', label: 'yes' }]);
    const { groups, strokes } = scene();
    const far: DigitalBlock = { id: 'far', kind: 'diagram', text: 'Shape: a sun.', bbox: { left: 2000, top: 2000, right: 2100, bottom: 2100 }, strokeIds: [], confidence: 0.5, figure: { kind: 'sketch', shapes: ['sun'], labels: [], edges: [] } };
    const out = reconcileFigureBlocks([far], groups, strokes);
    expect(out.filter((b) => b.kind === 'diagram')).toHaveLength(2);
    expect(out.find((b) => b.id === 'far')!.figure!.shapes).toEqual(['sun']);
  });

  it('is a no-op without figures', () => {
    const strokes = [stroke(0, 0, 50, 0, 0, 'a')];
    const groups = buildStrokeGroups(strokes);
    const blocks: DigitalBlock[] = [{ id: 'x', kind: 'paragraph', text: 'hi', bbox: groups[0].bbox, strokeIds: ['a'], confidence: 1 }];
    expect(reconcileFigureBlocks(blocks, groups, strokes)).toBe(blocks);
  });
});
