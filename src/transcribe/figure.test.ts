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
});
