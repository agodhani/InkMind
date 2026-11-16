import { describe, expect, it } from 'vitest';
import type { BoundingBox } from '../types';
import type { DigitalBlock } from '../model/page';
import { unionBounds } from '../model/page';
import { getStrokeBoundingBox } from '../types/brush';
import { analyseInk } from '../ink/shapeHints';
import { buildScene } from '../sim/scenes';
import { InkWriter } from '../sim/ink';
import { Rng } from '../sim/rng';
import { drawLine, drawRect, writeText } from '../sim/shapes';
import { buildStrokeGroups, figuresOf, rawToDigitalBlock, reconcileFigureBlocks } from './regions';

describe.each([
  ['plot-multi', 101, 'normal'], ['plot-multi', 102, 'messy'],
  ['unit-circle', 122, 'normal'], ['unit-circle', 123, 'messy'],
] as const)('%s scene %s', (kind, seed, messiness) => {
  const scene = buildScene(kind, seed, messiness);
  const groups = buildStrokeGroups(scene.strokes);
  const fig = figuresOf(groups)[0];
  const positions: BoundingBox[] = kind === 'plot-multi'
    ? [{ left: 350, top: 532, right: 425, bottom: 550 }, { left: 95, top: 80, right: 150, bottom: 96 }, { left: 690, top: 98, right: 756, bottom: 114 }]
    : [{ left: 547, top: 320, right: 563, bottom: 336 }, { left: 320, top: 65, right: 336, bottom: 81 }, { left: 360, top: 185, right: 420, bottom: 201 }];
  const words = kind === 'plot-multi' ? ['elapsed', 'amplitude', 'reference'] : ['x', 'y', 'coordinate'];
  const reader = (): DigitalBlock => ({ id: 'reader', kind: 'diagram', text: '', confidence: 0.9, bbox: scene.figures[0].bbox, strokeIds: scene.strokes.map((s) => s.id) });
  const rawWord = (bbox: BoundingBox, text: string) => rawToDigitalBlock({ kind: 'paragraph', text, confidence: 0.9, bbox, groupIndices: fig.groupIndices }, groups, { left: 0, top: 0, right: scene.width, bottom: scene.height }, { width: scene.width, height: scene.height }, scene.strokes);

  it('owns all scene strokes including legend, axis and coordinate writing without model blocks', () => {
    const out = reconcileFigureBlocks([], groups, scene.strokes);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('diagram');
    expect(new Set(out[0].strokeIds)).toEqual(new Set(scene.strokes.map((s) => s.id)));
  });

  it('preserves positioned words even when their referenced groups also contain drawing strokes', () => {
    const text = positions.map((bbox, i) => rawWord(bbox, words[i]));
    text.forEach((b, i) => expect(b.bbox).toEqual(positions[i]));
    const out = reconcileFigureBlocks([reader(), ...text.reverse()], groups, scene.strokes);
    expect(out).toHaveLength(1);
    expect(out[0].figure!.labels).toEqual(expect.arrayContaining(words));
  });

  it('retains positioned model node words as figure labels even when no geometry node matches', () => {
    const model = reader();
    model.figure = { kind: 'plot', shapes: [], labels: [], edges: [], nodes: positions.map((bbox, i) => ({ id: `word-${i}`, label: words[i], bbox })) };
    expect(reconcileFigureBlocks([model], groups, scene.strokes)[0].figure!.labels).toEqual(expect.arrayContaining(words));
  });

  it('does not absorb an unanchored prose box beyond the label region', () => {
    const prose = rawWord({ left: 100, top: 700, right: 450, bottom: 720 }, 'unrelated discussion');
    const out = reconcileFigureBlocks([reader(), prose], groups, scene.strokes);
    expect(out.find((b) => b.kind === 'diagram')!.figure!.labels).not.toContain('unrelated discussion');
    expect(out.find((b) => b.kind === 'paragraph')!.text).toBe('unrelated discussion');
  });

  it('ignores empty words and zero-area boxes rather than claiming the drawing as a label', () => {
    const out = reconcileFigureBlocks([reader(), rawWord(positions[0], ''), rawWord({ left: 0, top: 0, right: 0, bottom: 0 }, 'invalid location')], groups, scene.strokes);
    expect(out.find((b) => b.kind === 'diagram')!.figure!.labels).not.toContain('invalid location');
  });

  it('claims a separately grouped axis caption but excludes nearby prose beyond the text-height margin', () => {
    const rng = new Rng(seed);
    const w = new InkWriter(rng, 'extra');
    const bounds = fig.plotLabelBounds![0];
    const caption = writeText({ rng, w }, 'rate', bounds.left + 100, bounds.bottom - 8, { size: 14 });
    const prose = writeText({ rng, w }, 'unrelated discussion', bounds.left + 100, bounds.bottom + 55, { size: 14 });
    const extras = [caption, prose].map((strokes, i) => ({ index: groups.length + i, writtenOrder: groups.length + i, strokeIds: strokes.map((s) => s.id), bbox: strokes.map((s) => getStrokeBoundingBox(s)!).reduce(unionBounds) }));
    const all = [...scene.strokes, ...caption, ...prose];
    const analysis = analyseInk(all, [...groups, ...extras]);
    const plot = analysis.figures.find((f) => f.kind === 'plot')!;
    expect(plot.groupIndices).toContain(extras[0].index);
    expect(plot.groupIndices).not.toContain(extras[1].index);
  });

  if (kind === 'plot-multi') it('claims an adjacent legend box and its words beyond the axis margin', () => {
    const rng = new Rng(seed);
    const w = new InkWriter(rng, 'legend');
    const pen = { rng, w };
    const bounds = fig.plotLabelBounds![0];
    const left = bounds.right - 12, top = bounds.top + 100;
    drawRect(pen, { x: left, y: top, w: 120, h: 56 });
    drawLine(pen, { x: left + 8, y: top + 24 }, { x: left + 32, y: top + 24 });
    const drawing = [...w.strokes];
    const word = writeText(pen, 'alpha', left + 45, top + 30, { size: 14 });
    const extras = [drawing, word].map((strokes, i) => ({ index: groups.length + i, writtenOrder: groups.length + i, strokeIds: strokes.map((s) => s.id), bbox: strokes.map((s) => getStrokeBoundingBox(s)!).reduce(unionBounds) }));
    expect(extras[1].bbox.left).toBeGreaterThan(bounds.right);
    const all = [...scene.strokes, ...w.strokes];
    const analysis = analyseInk(all, [...groups, ...extras]);
    const plot = analysis.figures.find((f) => f.kind === 'plot')!;
    expect(plot.groupIndices).toEqual(expect.arrayContaining(extras.map((g) => g.index)));
    const located = [...groups, ...extras].map((g) => ({ ...g, figure: plot.groupIndices.includes(g.index) ? plot : undefined }));
    const text: DigitalBlock = { id: 'legend-word', kind: 'paragraph', text: 'alpha', confidence: 0.9, bbox: extras[1].bbox, strokeIds: extras[1].strokeIds };
    expect(reconcileFigureBlocks([text], located, all).find((b) => b.kind === 'diagram')!.figure!.labels).toContain('alpha');
    const boxed = reconcileFigureBlocks([{ ...text, strokeIds: [] }], located, all);
    expect(boxed).toHaveLength(1);
    expect(boxed[0].figure!.labels).toContain('alpha');
  });
});
