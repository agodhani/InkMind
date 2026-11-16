import { describe, expect, it } from 'vitest';
import { figureFromGeometry } from '../ink/shapeHints';
import type { DigitalBlock } from '../model/page';
import { buildScene } from '../sim/scenes';
import { buildStrokeGroups, figuresOf, reconcileFigureBlocks } from './regions';

describe.each([83, 84])('crossing graph seed %s', (seed) => {
  const scene = buildScene('graph-crossing', seed, seed === 84 ? 'messy' : 'normal');
  const groups = buildStrokeGroups(scene.strokes);
  const fig = figuresOf(groups)[0];
  const labels = scene.figures[0].nodes!;
  const words = new Map(fig.nodes.filter((n) => n.shape === 'circle' || n.shape === 'ellipse').map((n) => {
    const x = (n.bbox.left + n.bbox.right) / 2, y = (n.bbox.top + n.bbox.bottom) / 2;
    const index = seed === 83 ? y < 200 ? 0 : x > 400 ? 1 : y > 400 ? 2 : 3 : y < 300 ? x < 300 ? 0 : 1 : x < 300 ? 2 : 3;
    return [n.id, labels[index]];
  }));
  const edgeKey = (from: string, to: string) => scene.figures[0].directed === false ? [from, to].sort().join('>') : `${from}>${to}`;
  const expected = scene.figures[0].edges!.map((e) => edgeKey(e.from, e.to)).sort();

  it('treats the perimeter and crossing strokes as node-to-node connectors, not a diamond', () => {
    expect(figuresOf(groups)).toHaveLength(1);
    expect(fig.nodes).toHaveLength(4);
    expect(fig.nodes.every((n) => n.shape === 'circle' || n.shape === 'ellipse')).toBe(true);
    expect(fig.relations.map((e) => edgeKey(words.get(e.from)!, words.get(e.to)!)).sort()).toEqual(expected);
    if (seed === 84) expect(fig.relations.every((e) => e.kind === 'arrow')).toBe(true);
  });

  it('keeps geometric edges despite an unanchored model diamond with no edges', () => {
    const model: DigitalBlock = { id: 'model', kind: 'diagram', text: '', bbox: scene.figures[0].bbox, strokeIds: scene.strokes.map((s) => s.id), confidence: 0.9, figure: { kind: 'graph', shapes: ['diamond'], labels: [], edges: [], nodes: [...fig.nodes.map((n) => ({ id: `word-${n.id}`, label: words.get(n.id)!, bbox: n.labelBounds ?? n.bbox })), { id: 'diamond', label: 'diamond', shape: 'diamond' }] } };
    const out = reconcileFigureBlocks([model], groups, scene.strokes)[0];
    expect(out.figure!.edges.map((e) => edgeKey(e.from, e.to)).sort()).toEqual(expected);
    expect(new Set(out.strokeIds)).toEqual(new Set(scene.strokes.map((s) => s.id)));
  });

  it('retains geometry when the model provides neither names nor edges', () => {
    expect(reconcileFigureBlocks([], groups, scene.strokes)[0].figure!.edges).toHaveLength(expected.length);
    expect(figureFromGeometry(fig, () => undefined).edges).toHaveLength(expected.length);
  });
});
