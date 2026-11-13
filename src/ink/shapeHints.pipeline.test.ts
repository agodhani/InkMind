import { describe, expect, it } from 'vitest';
import { analyseInk, figureFromGeometry, type FigureHint } from './shapeHints';
import { buildStrokeGroups, figuresOf, reconcileFigureBlocks } from '../transcribe/regions';
import { buildScene } from '../sim/scenes';
import { DEFAULT_INK_STYLE, InkWriter, MESS_PROFILES, inkStyleFor, type Messiness } from '../sim/ink';
import { Rng } from '../sim/rng';
import { drawArrow, drawEllipse, drawRect, writeText, type Pen } from '../sim/shapes';
import { arrowStroke, line, rectLines, resetSynthetic, textLine } from '../__tests__/shapes';

function pen(messiness: Messiness): Pen {
  const rng = new Rng('geometry-pipeline');
  return { rng, w: new InkWriter(rng.fork('ink'), 'p', inkStyleFor(messiness, DEFAULT_INK_STYLE)), mess: MESS_PROFILES[messiness] };
}

describe('geometry pipeline regressions', () => {
  it('records the union of shape and label group strokes without duplicates', () => {
    const fig: FigureHint = { id: 0, kind: 'shape', shapes: ['rectangle'], groupIndices: [0, 1, 2], labelGroups: [1], labelInside: { 1: 0 }, labelHostGroups: [], edges: [], relations: [], order: [], orderBasis: '', summary: '', nodes: [
      { id: 'n1', shape: 'rectangle', groupIndex: 0, labelGroup: 1, bbox: { left: 0, top: 0, right: 100, bottom: 100 } },
      { id: 'n2', shape: 'rectangle', groupIndex: 2, labelGroup: 2, parent: 'n1', bbox: { left: 20, top: 20, right: 80, bottom: 80 } },
    ] };
    const groups = [{ index: 0, strokeIds: ['shape', 'shared'] }, { index: 1, strokeIds: ['label', 'shared'] }, { index: 2, strokeIds: ['inner'] }, { index: 3, strokeIds: ['arrow'] }];
    const figure = figureFromGeometry(fig, () => undefined, groups);
    expect(figure.nodes!.map((n) => n.strokeIds)).toEqual([['shape', 'shared', 'label'], ['inner']]);
    expect(figureFromGeometry(fig, () => undefined, []).nodes!.map((n) => n.strokeIds)).toEqual([[], []]);
    expect(figureFromGeometry({ ...fig, nodes: [] }, () => undefined, groups).nodes).toEqual([]);
  });
  it('keeps node ink membership through geometry reconciliation and JSON persistence', () => {
    const scene = buildScene('nested-boxes', 201, 'neat');
    const groups = buildStrokeGroups(scene.strokes), hint = figuresOf(groups)[0];
    const figure = reconcileFigureBlocks([], groups, scene.strokes)[0].figure!;
    for (const node of hint.nodes) {
      const expected = [...new Set(groups.filter((g) => g.index === node.groupIndex || g.index === node.labelGroup).flatMap((g) => g.strokeIds))];
      expect(figure.nodes!.find((n) => n.id === node.id)!.strokeIds).toEqual(expected);
      expect(expected.length).toBeGreaterThan(0);
    }
    expect(JSON.parse(JSON.stringify(figure)).nodes).toEqual(figure.nodes);
  });
  it.each(['neat', 'messy'] as const)('recovers nested multi-stroke rectangles instead of a table (%s)', (messiness) => {
    const scene = buildScene('nested-boxes', 201, messiness);
    const fig = figuresOf(buildStrokeGroups(scene.strokes))[0];
    expect(fig.kind).not.toBe('table');
    expect(fig.nodes).toHaveLength(scene.figures[0].nodes!.length);
    expect(fig.nodes.filter((n) => n.parent)).toHaveLength(scene.figures[0].contains!.length);
  });

  it.each(['neat', 'messy'] as const)('recognises overshot and two-stroke Venn circles (%s)', (messiness) => {
    const scene = buildScene('venn', 201, messiness);
    const fig = figuresOf(buildStrokeGroups(scene.strokes))[0];
    expect(fig.nodes).toHaveLength(scene.figures[0].nodes!.length);
    expect(fig.nodes.every((n) => n.shape === 'circle' || n.shape === 'ellipse')).toBe(true);
    expect(fig.nodes.every((n) => !n.parent)).toBe(true);
  });

  it.each(['neat', 'messy'] as const)('sets parents for contained ellipses (%s)', (messiness) => {
    const p = pen(messiness);
    drawEllipse(p, 300, 240, 220, 180);
    drawEllipse(p, 300, 240, 110, 80);
    const fig = figuresOf(buildStrokeGroups(p.w.strokes))[0];
    expect(fig.nodes).toHaveLength(2);
    expect(fig.nodes[1].parent).toBe(fig.nodes[0].id);
  });

  it.each(['neat', 'messy'] as const)('recovers dashed actors and all messages without duplicate lifelines (%s)', (messiness) => {
    const scene = buildScene('sequence-diagram', 201, messiness);
    const fig = figuresOf(buildStrokeGroups(scene.strokes))[0];
    expect(fig.kind).toBe('sequence');
    expect(fig.nodes.filter((n) => n.shape === 'lifeline')).toHaveLength(scene.figures[0].nodes!.length);
    expect(fig.relations).toHaveLength(scene.figures[0].edges!.length);
  });

  it.each(['neat', 'messy'] as const)('keeps pipeline nodes, arrow direction and order (%s)', (messiness) => {
    const p = pen(messiness);
    for (const x of [100, 400, 700]) {
      drawRect(p, { x, y: 100, w: 140, h: 70 }, 1);
      writeText(p, 'word', x + 30, 145, { size: 14 });
    }
    drawArrow(p, { x: 243, y: 135 }, { x: 397, y: 135 });
    drawArrow(p, { x: 543, y: 135 }, { x: 697, y: 135 });
    const fig = figuresOf(buildStrokeGroups(p.w.strokes))[0];
    expect(fig.nodes).toHaveLength(3);
    expect(fig.relations.map((r) => [r.from, r.to])).toEqual([['n1', 'n2'], ['n2', 'n3']]);
    expect(fig.order).toEqual(['n1', 'n2', 'n3']);
  });

  it('recognises a shaft with two separately drawn head wings', () => {
    resetSynthetic();
    const strokes = [line(100, 100, 250, 100), line(235, 91, 250, 100, 400), line(235, 109, 250, 100, 600)];
    const groups = buildStrokeGroups(strokes);
    const analysis = analyseInk(strokes, groups);
    expect(analysis.groups.flatMap((g) => g.arrows)).toHaveLength(1);
    expect(analysis.groups.flatMap((g) => g.arrows)[0].head.x).toBeCloseTo(250, 0);
  });

  it('does not fuse two independently structured figures through a page-level arrow or nearby notes', () => {
    resetSynthetic();
    const strokes = [
      ...rectLines(100, 100, 400, 300), ...rectLines(130, 140, 370, 270, 2000),
      ...rectLines(600, 100, 900, 300, 12000), ...rectLines(630, 140, 870, 270, 14000),
      arrowStroke(410, 200, 590, 200, 22000), ...textLine(80, 390, 20, 18, 30000),
    ];
    const groups = buildStrokeGroups(strokes);
    const figs = figuresOf(groups);
    expect(figs).toHaveLength(2);
    expect(figs.every((f) => f.nodes.length === 2)).toBe(true);
    const textIds = strokes.slice(-20).map((s) => s.id);
    const blocks = reconcileFigureBlocks([], groups, strokes);
    expect(blocks.every((b) => b.strokeIds.every((id) => !textIds.includes(id)))).toBe(true);
  });

  it('keeps handwritten text out of the cube classifier', () => {
    const p = pen('neat');
    writeText(p, 'overview first then detail', 70, 110, { size: 30 });
    expect(figuresOf(buildStrokeGroups(p.w.strokes))).toHaveLength(0);
  });

  it('uses message labels, not actor names, for sequence order and leaves unknown labels unresolved', () => {
    const scene = buildScene('sequence-diagram', 201, 'neat');
    const fig = figuresOf(buildStrokeGroups(scene.strokes))[0];
    fig.messageGroups = [10, 20, 30];
    const labels: Record<number, string> = { 10: '1. open', 20: '2. fetch', 30: '3. reply' };
    expect(figureFromGeometry(fig, (g) => labels[g]).sequence).toEqual(['open', 'fetch', 'reply']);
    expect(figureFromGeometry(fig, () => undefined).sequence).toBeUndefined();
  });

  it('handles empty ink', () => {
    expect(buildStrokeGroups([])).toEqual([]);
    expect(analyseInk([], []).figures).toEqual([]);
  });
});
