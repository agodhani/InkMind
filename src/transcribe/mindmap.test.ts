import { describe, expect, it } from 'vitest';
import { figureFromGeometry, type FigureHint } from '../ink/shapeHints';
import type { DigitalBlock, FigureInfo } from '../model/page';
import { buildScene } from '../sim/scenes';
import { normaliseFigure } from './figure';
import { buildStrokeGroups, figuresOf, rawToDigitalBlock, reconcileFigureBlocks } from './regions';

function positionLabels(fig: FigureHint): Map<string, string> {
  const hotel = fig.nodes.find((n) => n.shape === 'text' && n.bbox.left > 650 && n.bbox.left < 750)!;
  return new Map(fig.nodes.map((n) => {
    const b = n.bbox;
    const label = n.shape !== 'text' ? 'trip' : b.top < 150 ? 'flights'
      : b.left > 750 ? b.top < hotel.bbox.top - 10 ? 'book' : 'pay'
        : b.left > 650 ? 'hotel' : b.left > 550 ? 'food'
          : b.top < 400 ? 'budget' : b.left < 200 ? 'museum' : 'sights';
    return [n.id, label];
  }));
}

function edgeIds(figure: FigureInfo): string[] {
  const id = (label: string) => figure.nodes!.find((n) => n.label === label)!.id;
  return figure.edges.map((e) => `${id(e.from)}>${id(e.to)}`).sort();
}

describe.each([113, 114])('mind-map seed %s', (seed) => {
  const scene = buildScene('mind-map', seed, seed === 114 ? 'messy' : 'normal');
  const groups = buildStrokeGroups(scene.strokes);
  const fig = figuresOf(groups)[0];
  const words = positionLabels(fig);
  const nodeId = (word: string) => [...words].find(([, label]) => label === word)![0];
  const expected = scene.figures[0].edges!.map((e) => `${nodeId(e.from)}>${nodeId(e.to)}`).sort();
  const model = (figure: FigureInfo): DigitalBlock => ({ id: 'reader', kind: 'diagram', text: '', bbox: scene.figures[0].bbox, strokeIds: scene.strokes.map((s) => s.id), confidence: 0.9, figure });
  const reconcile = (blocks: DigitalBlock[]) => reconcileFigureBlocks(blocks, groups, scene.strokes).find((b) => b.kind === 'diagram')!.figure!;

  it('grounds all five hub spokes and three twigs in connector strokes', () => {
    expect(fig.kind).toBe('mindmap');
    expect(fig.nodes).toHaveLength(9);
    expect(fig.relations.map((r) => `${r.from}>${r.to}`).sort()).toEqual(expected);
    expect(fig.relations.every((r) => r.strokeIds?.length === 1)).toBe(true);
    const geo = figureFromGeometry(fig, () => undefined, groups);
    expect(new Set(geo.nodes!.flatMap((n) => n.strokeIds ?? [])).size).toBeGreaterThan(9);
  });

  it('keeps distinct geometric endpoints when every model name is identical', () => {
    const prior = normaliseFigure({ kind: 'mindmap', nodes: fig.nodes.map((n) => ({ label: 'same', bbox: n.labelBounds ?? n.bbox })), edges: Array.from({ length: 12 }, () => ({ from: 'n1', to: 'n2' })) })!;
    const out = reconcile([model(prior)]);
    expect(out.nodes).toHaveLength(9);
    expect(new Set(out.nodes!.map((n) => n.label)).size).toBe(9);
    expect(out.nodes!.every((n) => /^same(?: \(\d+\))?$/.test(n.label))).toBe(true);
    expect(edgeIds(out)).toEqual(expected);
  });

  it('uses node boxes rather than swapped hint ids or hallucinated edges', () => {
    const prior = normaliseFigure({ nodes: fig.nodes.map((n, i) => ({ id: fig.nodes[fig.nodes.length - 1 - i].id, label: words.get(n.id), bbox: n.labelBounds ?? n.bbox })), edges: Array.from({ length: 12 }, () => ({ from: 'budget', to: 'food' })) })!;
    const out = reconcile([model(prior)]);
    expect(out.nodes!.map((n) => n.label)).toEqual(fig.nodes.map((n) => words.get(n.id)));
    expect(edgeIds(out)).toEqual(expected);
  });

  it('attaches separately transcribed words to local node strokes, not whole drawing groups', () => {
    const prior = normaliseFigure({ names: Object.fromEntries(fig.nodes.map((n) => [n.id, 'same'])) })!;
    const text = fig.nodes.map((n): DigitalBlock => ({ id: `text-${n.id}`, kind: 'paragraph', text: words.get(n.id)!, bbox: n.bbox, strokeIds: n.strokeIds!, confidence: 0.9 }));
    const out = reconcile([model(prior), ...text]);
    expect(out.nodes!.map((n) => n.label)).toEqual(fig.nodes.map((n) => words.get(n.id)));
    expect(edgeIds(out)).toEqual(expected);
  });

  it('converts per-label groupIndices to stroke anchors before reconciliation', () => {
    const localGroups = fig.nodes.map((n, index) => ({ index, bbox: n.bbox, strokeIds: n.strokeIds!, writtenOrder: index }));
    const prior = normaliseFigure({ labels: fig.nodes.map((n, i) => ({ id: fig.nodes[fig.nodes.length - 1 - i].id, label: words.get(n.id), groupIndices: [i] })) })!;
    const block = rawToDigitalBlock({ kind: 'diagram', text: '', bbox: { left: 0, top: 0, right: scene.width, bottom: scene.height }, groupIndices: [], confidence: 0.9, figure: prior }, localGroups, { left: 0, top: 0, right: scene.width, bottom: scene.height }, { width: scene.width, height: scene.height }, scene.strokes);
    const out = reconcile([block]);
    expect(out.nodes!.map((n) => n.label)).toEqual(fig.nodes.map((n) => words.get(n.id)));
    expect(edgeIds(out)).toEqual(expected);
  });
});

describe('mind-map position parsing', () => {
  it('maps per-node image boxes into page coordinates', () => {
    const figure = normaliseFigure({ nodes: [{ id: 'n1', label: 'word', bbox: [10, 20, 30, 40] }] })!;
    const block = rawToDigitalBlock({ kind: 'diagram', text: '', bbox: { left: 0, top: 0, right: 100, bottom: 100 }, groupIndices: [], confidence: 0.9, figure }, [], { left: 100, top: 200, right: 300, bottom: 400 }, { width: 100, height: 100 }, []);
    expect(block.figure!.nodes![0].bbox).toEqual({ left: 120, top: 240, right: 160, bottom: 280 });
  });

  it('ignores malformed or empty position metadata', () => {
    const figure = normaliseFigure({ nodes: [{ id: 'n1', label: 'word', bbox: [10, 20], groupIndices: [-1, 'x'] }, { id: 'n2', label: 'other', bbox: { left: 10, top: 10, right: 5, bottom: 5 } }] })!;
    expect(figure.nodes!.every((n) => !n.bbox && !n.groupIndices)).toBe(true);
    expect(normaliseFigure({ nodes: [], labels: [] })).toBeUndefined();
  });
});
