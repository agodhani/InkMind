import { describe, expect, it } from 'vitest';
import { analyseGroup, classifyStroke } from '../ink/shapeHints';
import type { DigitalBlock } from '../model/page';
import { buildScene } from '../sim/scenes';
import { buildStrokeGroups, figuresOf, reconcileFigureBlocks } from './regions';

describe.each([51, 52, 53, 54])('complex flowchart seed %s', (seed) => {
  const scene = buildScene('flowchart-complex', seed, seed % 2 ? 'normal' : 'messy');
  const groups = buildStrokeGroups(scene.strokes);
  const fig = figuresOf(groups)[0];
  const outlines = groups.flatMap((g) => analyseGroup(g, scene.strokes.filter((s) => g.strokeIds.includes(s.id))).closed);
  const strokeOrder = (n: typeof fig.nodes[number]) => {
    const shape = outlines.find((c) => c.bbox.left === n.bbox.left && c.bbox.top === n.bbox.top && c.bbox.right === n.bbox.right && c.bbox.bottom === n.bbox.bottom)!;
    return Math.min(...shape.strokeIds.map((id) => scene.strokes.findIndex((s) => s.id === id)));
  };
  const nodes = [...fig.nodes].sort((a, b) => strokeOrder(a) - strokeOrder(b));
  const words = new Map(nodes.map((n, i) => [n.id, scene.figures[0].nodes![i]]));
  const expected = scene.figures[0].edges!.map((e) => `${e.from}>${e.to}`).sort();

  it('finds exactly the expected directed edges, including labelled branches and back rails', () => {
    expect(fig.nodes).toHaveLength(scene.figures[0].nodes!.length);
    expect(fig.relations.map((e) => `${words.get(e.from)}>${words.get(e.to)}`).sort()).toEqual(expected);
    expect(fig.relations.every((e) => e.kind === 'arrow')).toBe(true);
    if (seed % 2) {
      const back = fig.relations.find((e) => e.back)!;
      expect(back).toBeDefined();
      expect(back.strokeIds!.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('routes position-attached words over geometry without any model edges', () => {
    const model: DigitalBlock = { id: 'model', kind: 'diagram', text: '', bbox: scene.figures[0].bbox, strokeIds: scene.strokes.map((s) => s.id), confidence: 0.9, figure: { kind: 'flowchart', shapes: [], labels: [], edges: [], nodes: [...nodes].reverse().map((n) => ({ id: `word-${n.id}`, label: words.get(n.id)!, bbox: n.labelBounds ?? n.bbox })) } };
    const out = reconcileFigureBlocks([model], groups, scene.strokes)[0];
    expect(out.figure!.edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual(expected);
    expect(new Set(out.strokeIds)).toEqual(new Set(scene.strokes.map((s) => s.id)));
  });

  if (seed % 2) it('does not bridge an absent rail through nearby text or an X intersection', () => {
    const back = fig.relations.find((e) => e.back)!;
    const rail = scene.strokes.filter((s) => back.strokeIds!.includes(s.id)).sort((a, b) => classifyStroke(b).diag - classifyStroke(a).diag)[0];
    const disconnected = figuresOf(buildStrokeGroups(scene.strokes.filter((s) => s !== rail)));
    expect(disconnected.flatMap((f) => f.relations)).toHaveLength(expected.length - 1);
  });
});
