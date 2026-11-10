import { describe, expect, it } from 'vitest';
import { edgeList, figureCaption, normaliseFigure, normaliseFigureKind, stringList } from './figure';

describe('normaliseFigure', () => {
  it('does not split edge names on "to" inside a word', () => {
    expect(normaliseFigure({ kind: 'flowchart', edges: 'motor -> stop' })?.edges).toEqual([{ from: 'motor', to: 'stop' }]);
    expect(normaliseFigure({ kind: 'flowchart', edges: 'start to stop' })?.edges).toEqual([{ from: 'start', to: 'stop' }]);
  });

  it('drops stroke-group ids echoed as labels or edge endpoints', () => {
    const fig = normaliseFigure({ kind: 'plot', labels: ['group 0', 'loss', 'Figure A'], edges: [{ from: 'group 0', to: 'group 1', label: 'loss' }, { from: 'x', to: 'y' }] });
    expect(fig?.labels).toEqual(['loss']);
    expect(fig?.edges).toEqual([{ from: 'x', to: 'y' }]);
  });

  it('drops edge labels that are only arrow glyphs or punctuation', () => {
    const fig = normaliseFigure({ kind: 'flowchart', edges: [{ from: 'a', to: 'b', label: '→' }, { from: 'b', to: 'c', label: ' -> ' }, { from: 'c', to: 'd', label: 'x2' }] });
    expect(fig?.edges).toEqual([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd', label: 'x2' }]);
  });

  it('accepts the documented shape', () => {
    const fig = normaliseFigure({ kind: 'flowchart', shapes: ['rectangle', 'rectangle', 'arrow'], labels: ['start', 'end'], edges: [{ from: 'start', to: 'end', label: 'ok' }] });
    expect(fig).toEqual({ kind: 'flowchart', shapes: ['rectangle', 'arrow'], labels: ['start', 'end'], edges: [{ from: 'start', to: 'end', label: 'ok' }] });
  });
  it('is lenient about messy small-model output', () => {
    const fig = normaliseFigure({
      type: 'Flow chart',
      shapes: 'box, box; arrow',
      labels: [{ text: ' A ' }, { name: 'B' }, 'A', 42],
      relations: ['A -> B', 'B → C (loop)', { source: 'C', target: 'A', text: 'back' }, ['A', 'C']],
    });
    expect(fig).toEqual({
      kind: 'flowchart',
      shapes: ['box', 'arrow'],
      labels: ['A', 'B', '42'],
      edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C', label: 'loop' }, { from: 'C', to: 'A', label: 'back' }, { from: 'A', to: 'C' }],
    });
  });
  it('accepts a JSON string, a bare kind string, an array and adjacency-object edges', () => {
    expect(normaliseFigure('{"kind":"plot","labels":["x","y"]}')!.labels).toEqual(['x', 'y']);
    expect(normaliseFigure('cube')!.kind).toBe('cube');
    expect(normaliseFigure(['circle'])!.shapes).toEqual(['circle']);
    expect(normaliseFigure({ edges: { A: ['B', 'C'], B: 'C' } })!.edges).toHaveLength(3);
  });
  it('returns undefined for nothing usable and uses the fallback kind', () => {
    expect(normaliseFigure(null)).toBeUndefined();
    expect(normaliseFigure({})).toBeUndefined();
    expect(normaliseFigure('')).toBeUndefined();
    expect(normaliseFigure({ labels: ['a'] }, 'shape')!.kind).toBe('shape');
    expect(normaliseFigure({ kind: 'weird thing', labels: ['a'] })!.kind).toBe('other');
  });
  it('maps kind synonyms', () => {
    expect(normaliseFigureKind('bar chart')).toBe('plot');
    expect(normaliseFigureKind('x-y graph of loss')).toBe('plot');
    expect(normaliseFigureKind('3D box')).toBe('cube');
    expect(normaliseFigureKind('mind-map')).toBe('mindmap');
    expect(normaliseFigureKind('drawing')).toBe('sketch');
    expect(normaliseFigureKind('network graph')).toBe('graph');
    expect(normaliseFigureKind(undefined, 'shape')).toBe('shape');
  });
  it('caps and trims lists', () => {
    expect(stringList(Array.from({ length: 50 }, (_, i) => `l${i}`))).toHaveLength(24);
    expect(stringList('"quoted"')).toEqual(['quoted']);
    expect(edgeList('a -> b -> c')).toEqual([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }]);
    expect(edgeList('nonsense')).toEqual([]);
  });
  it('builds a Shape/Labels/Relations caption', () => {
    expect(figureCaption({ kind: 'flowchart', shapes: ['two boxes'], labels: ['A', 'B'], edges: [{ from: 'A', to: 'B', label: 'go' }] })).toBe('Shape: two boxes. Labels: A, B. Relations: A → B (go).');
    expect(figureCaption({ kind: 'cube', shapes: [], labels: [], edges: [] })).toBe('Shape: cube.');
  });

  it('reads nodes with shapes and nesting, a step sequence, edge kinds and table cells', () => {
    const fig = normaliseFigure({
      kind: 'flowchart',
      nodes: [{ id: 'n1', label: 'system', shape: 'rectangle', children: [{ id: 'n2', label: 'in', shape: 'box' }] }, { label: 'out', parent: 'system' }],
      edges: [{ from: 'in', to: 'out', kind: 'arrow' }, { from: 'out', to: 'out' }, 'in — out', { from: 'out', to: 'in', type: 'line', inferred: true }],
      sequence: ['in', 'out'],
    })!;
    expect(fig.labels).toEqual(['system', 'in', 'out']);
    expect(fig.nodes).toEqual([
      { id: 'n1', label: 'system', shape: 'rectangle' },
      { id: 'n2', label: 'in', shape: 'box', parent: 'n1' },
      { id: 'out', label: 'out', parent: 'n1' },
    ]);
    expect(fig.edges).toEqual([
      { from: 'in', to: 'out', kind: 'arrow' },
      { from: 'out', to: 'out', kind: 'self-loop' },
      { from: 'in', to: 'out', kind: 'line' },
      { from: 'out', to: 'in', kind: 'line', inferred: true },
    ]);
    expect(fig.sequence).toEqual(['in', 'out']);
    expect(normaliseFigure({ kind: 'table', cells: [['h1', 'h2'], ['a']] })!.cells).toEqual([['h1', 'h2'], ['a', '']]);
    expect(normaliseFigure({ cells: 'h1 | h2\n---|---\na | b' })).toMatchObject({ kind: 'table', cells: [['h1', 'h2'], ['a', 'b']] });
    expect(normaliseFigure({ kind: 'table', rows: [{ name: 'nut', qty: '12' }] })!.cells).toEqual([['name', 'qty'], ['nut', '12']]);
  });
  it('accepts a top-level containment map and string nodes, and never nests a node in itself', () => {
    const fig = normaliseFigure({ kind: 'sketch', nodes: ['outer', 'inner'], contains: { outer: ['inner', 'outer'] } })!;
    expect(fig.nodes).toEqual([{ id: 'outer', label: 'outer' }, { id: 'inner', label: 'inner', parent: 'outer' }]);
    expect(normaliseFigure({ kind: 'graph', nodes: [{ id: 'a', label: 'a', parent: 'b' }, { id: 'b', label: 'b', parent: 'a' }] })!.nodes!.filter((n) => n.parent)).toHaveLength(0);
  });
  it('captions steps, nesting, tables and edge kinds', () => {
    const caption = figureCaption({
      kind: 'flowchart',
      shapes: ['box'],
      labels: ['a', 'b'],
      edges: [{ from: 'a', to: 'b', label: 'yes' }, { from: 'b', to: 'b', kind: 'self-loop' }, { from: 'a', to: 'b', kind: 'line' }],
      sequence: ['a', 'b'],
      nodes: [{ id: 'n1', label: 'a' }, { id: 'n2', label: 'b', parent: 'n1' }],
    });
    expect(caption).toBe('Shape: box. Labels: a, b. Steps: a → b. Nested: b inside a. Relations: a → b (yes), b ↺, a — b.');
    expect(figureCaption({ kind: 'table', shapes: [], labels: [], edges: [], cells: [['x', 'y'], ['1', '2']] })).toBe('Shape: table. Table: 2 rows × 2 columns.');
  });
  it('resolves hint ids the model used in edges, labels and sequence through its own node list', () => {
    const fig = normaliseFigure({
      kind: 'flowchart',
      nodes: [{ id: 'n1', label: 'start', parent: 'n1' }, { id: 'n2', label: 'end' }],
      labels: ['n1', 'n2'],
      edges: [{ from: 'n1', to: 'n2', label: 'n1 → n2' }, { from: 'n2', to: 'n9' }],
      sequence: ['n1', 'n2'],
    })!;
    expect(fig.labels).toEqual(['start', 'end']);
    expect(fig.nodes).toEqual([{ id: 'n1', label: 'start' }, { id: 'n2', label: 'end' }]);
    expect(fig.edges).toEqual([{ from: 'start', to: 'end' }]);
    expect(fig.sequence).toEqual(['start', 'end']);
    const seq = normaliseFigure({ kind: 'sequence', nodes: [{ id: 'n1', label: 'client', parent: 'n2' }, { id: 'n2', label: 'server', parent: 'n1' }], sequence: ['n1 → n2', 'n2 → n1'], cells: [['client', 'server']] })!;
    expect(seq.nodes!.every((n) => n.parent === undefined)).toBe(true);
    expect(seq.sequence).toEqual(['client', 'server']);
    expect(seq.cells).toBeUndefined();
  });
  it('keeps "to" inside a step name, empty table rows, and same-word nodes with different ids', () => {
    expect(normaliseFigure({ kind: 'flowchart', sequence: ['ready to ship', 'done → shipped'] })!.sequence).toEqual(['ready to ship', 'done', 'shipped']);
    expect(normaliseFigure({ kind: 'table', cells: [['a', 'b'], ['', ''], ['c', 'd']] })!.cells).toEqual([['a', 'b'], ['', ''], ['c', 'd']]);
    expect(normaliseFigure({ kind: 'graph', nodes: [{ id: 'n1', label: 'x' }, { id: 'n2', label: 'x' }, { label: 'x' }] })!.nodes).toHaveLength(2);
    expect(normaliseFigure({ kind: 'graph', nodes: [{ id: 'n1', label: 'x', group: 'unknown' }, { id: 'n2', label: 'y', group: 'group 4' }] })!.nodes).toEqual([{ id: 'n1', label: 'x' }, { id: 'n2', label: 'y', group: 4 }]);
  });
});
