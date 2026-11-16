import { describe, expect, it } from 'vitest';
import { figureFromGeometry, fullyContains, type FigureHint } from '../ink/shapeHints';
import { unionBounds, type DigitalBlock, type FigureInfo } from '../model/page';
import { containmentFromNodes, relationMetrics } from '../sim/metrics';
import { buildScene } from '../sim/scenes';
import { getStrokeBoundingBox } from '../types/brush';
import { buildStrokeGroups, figuresOf, mergeWithGeometry, reconcileFigureBlocks } from './regions';

const pairs = (figure: Pick<FigureInfo, 'nodes'>) => containmentFromNodes(figure.nodes ?? []).map((p) => `${p.outer}>${p.inner}`).sort();

function wordsAt(fig: FigureHint, seed: number): Map<string, string> {
  return new Map(fig.nodes.map((n) => {
    const b = n.bbox;
    const word = seed === 93 ? n.shape === 'text' ? 'A∩B' : b.left < 100 ? 'A' : 'B'
      : seed === 94 ? n.shape !== 'text' ? b.left < 100 ? 'cats' : 'dogs' : b.left < 250 ? 'fur' : b.left < 450 ? 'pets' : 'bark'
        : seed === 91 ? b.left < 100 ? 'outer' : b.left < 150 ? 'inner' : 'core'
          : b.left < 100 ? 'system' : b.left < 150 ? 'frontend' : b.left < 200 ? 'ui' : n.shape === 'ellipse' ? 'db' : b.left > 420 ? 'api' : 'backend';
    return [n.id, word];
  }));
}

describe.each([91, 92, 93, 94])('position-grounded nesting, seed %s', (seed) => {
  const scene = buildScene(seed < 93 ? 'nested-boxes' : 'venn', seed, seed % 2 === 0 ? 'messy' : 'normal');
  const groups = buildStrokeGroups(scene.strokes);
  const fig = figuresOf(groups)[0];
  const words = wordsAt(fig, seed);
  const expected = scene.figures[0].contains!.map((c) => `${c.outer}>${c.inner}`).sort();
  const model = (figure: FigureInfo): DigitalBlock => ({ id: 'model', kind: 'diagram', text: '', bbox: scene.figures[0].bbox, strokeIds: scene.strokes.map((s) => s.id), confidence: 0.9, figure });
  const prior = (shapeBoxes = false): FigureInfo => ({ kind: 'shape', shapes: [], labels: [], edges: [], nodes: fig.nodes.map((n, i) => ({ id: `wrong-${fig.nodes.length - i}`, label: words.get(n.id)!, bbox: shapeBoxes ? n.bbox : n.labelBounds ?? n.bbox, parent: `wrong-${(i + 1) % fig.nodes.length + 1}` })) });
  const reconcile = (blocks: DigitalBlock[]) => reconcileFigureBlocks(blocks, groups, scene.strokes).find((b) => b.kind === 'diagram')!;

  it('derives direct containment from geometry, with all parents for an intersection label', () => {
    const geo = figureFromGeometry(fig, () => undefined, groups, (n) => words.get(n.id));
    expect(pairs(geo)).toEqual(expected);
    if (seed >= 93) {
      expect(fig.nodes.filter((n) => n.shape === 'circle').every((n) => !n.parent && !n.parents?.length)).toBe(true);
      const intersection = geo.nodes!.find((n) => n.label === (seed === 93 ? 'A∩B' : 'pets'))!;
      expect(intersection.parents).toHaveLength(2);
    }
  });

  it.each([false, true])('attaches positioned model words, not swapped ids or model nesting (shape boxes: %s)', (shapeBoxes) => {
    const out = reconcile([model(prior(shapeBoxes))]);
    expect(pairs(out.figure!)).toEqual(expected);
    const score = relationMetrics(scene.figures, [out]);
    expect(score.containsFound).toBe(expected.length);
    expect(score.containsStructured).toBe(true);
  });

  it('attaches separately read text to local label strokes within the shared group', () => {
    const text = fig.nodes.map((n): DigitalBlock => ({ id: `text-${n.id}`, kind: 'paragraph', text: words.get(n.id)!, bbox: n.labelBounds ?? n.bbox, strokeIds: n.strokeIds!, confidence: 0.9 }));
    const out = reconcile(text);
    expect(pairs(out.figure!)).toEqual(expected);
  });

  if (seed === 92) it('geometrically parents a separately positioned ellipse label despite a wrong model parent', () => {
    const db = scene.strokes.map((s) => getStrokeBoundingBox(s)!).filter((b) => b.left > 570 && b.top > 120 && b.bottom < 150 && b.right - b.left < 30);
    const p = prior();
    p.nodes = p.nodes!.filter((n) => n.label !== 'db');
    p.nodes!.push({ id: 'n5', label: 'db', bbox: db.reduce(unionBounds), parent: 'wrong-parent' });
    const out = reconcile([model(p)]);
    expect(pairs(out.figure!)).toEqual(scene.figures[0].contains!.map((c) => `${c.outer}>${c.inner}`).sort());
    expect(relationMetrics(scene.figures, [out]).containsFound).toBe(5);
  });
});

it('does not import nesting between overlapping Venn circles when no region text was recognized', () => {
  const scene = buildScene('venn', 93);
  const groups = buildStrokeGroups(scene.strokes);
  const original = figuresOf(groups)[0];
  const fig = { ...original, nodes: original.nodes.filter((n) => n.shape !== 'text'), order: [], orderBasis: '' };
  const geo = figureFromGeometry(fig, () => undefined, groups);
  const prior: FigureInfo = { kind: 'shape', shapes: [], labels: [], edges: [], nodes: fig.nodes.map((n, i) => ({ id: n.id, label: i ? 'B' : 'A', parent: fig.nodes[1 - i].id })) };
  expect(pairs(mergeWithGeometry(prior, fig, [], geo))).toEqual([]);
});

describe('full shape containment', () => {
  const circle = { shape: 'circle', bbox: { left: 0, top: 0, right: 100, bottom: 100 } };
  it('rejects partial overlap and a label whose centre alone is inside', () => {
    expect(fullyContains(circle, { shape: 'circle', bbox: { left: 30, top: 0, right: 130, bottom: 100 } })).toBe(false);
    expect(fullyContains(circle, { shape: 'text', bbox: { left: 4, top: 4, right: 30, bottom: 30 } })).toBe(false);
    expect(fullyContains(circle, { shape: 'text', bbox: { left: 40, top: 40, right: 60, bottom: 60 } })).toBe(true);
    expect(fullyContains(circle, { shape: 'circle', bbox: { left: 10, top: 10, right: 90, bottom: 90 } })).toBe(true);
  });
  it('uses polygon outlines rather than their bounding boxes', () => {
    const triangle = { ...circle, shape: 'triangle', corners: [{ x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
    expect(fullyContains(triangle, { shape: 'text', bbox: { left: 2, top: 2, right: 10, bottom: 10 } })).toBe(false);
    expect(fullyContains(triangle, { shape: 'text', bbox: { left: 40, top: 50, right: 60, bottom: 60 } })).toBe(true);
  });
  it('rejects empty ellipses and leaves empty ink without nesting', () => {
    expect(fullyContains({ shape: 'ellipse', bbox: { left: 0, top: 0, right: 0, bottom: 0 } }, circle)).toBe(false);
    expect(figuresOf(buildStrokeGroups([]))).toEqual([]);
    expect(reconcileFigureBlocks([], [], [])).toEqual([]);
  });
});
