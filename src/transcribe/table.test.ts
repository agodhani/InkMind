import { describe, expect, it } from 'vitest';
import type { DigitalBlock, FigureInfo } from '../model/page';
import { buildScene, expectedTableCells } from '../sim/scenes';
import { getStrokeBoundingBox } from '../types/brush';
import { buildStrokeGroups, figuresOf, rawToDigitalBlock, reconcileFigureBlocks } from './regions';

describe.each([111, 112])('table scene %s', (seed) => {
  const scene = buildScene('table', seed, seed === 112 ? 'messy' : 'normal');
  const groups = buildStrokeGroups(scene.strokes);
  const fig = figuresOf(groups)[0];
  const expected = expectedTableCells(scene.figures[0].labels)!;
  const positions = expected.flatMap((row, r) => row.flatMap((text, c) => {
    if (!text) return [];
    const cell = { left: 60 + c * 170, right: 60 + (c + 1) * 170, top: 60 + r * 44.8, bottom: 60 + (r + 1) * 44.8 };
    const strokeIds = scene.strokes.filter((s) => {
      const b = getStrokeBoundingBox(s)!;
      return b.right - b.left < 80 && b.bottom - b.top < 35 && b.left >= cell.left && b.right <= cell.right && b.top >= cell.top && b.bottom <= cell.bottom;
    }).map((s) => s.id);
    const bbox = { left: (cell.left + cell.right) / 2 - 40, right: (cell.left + cell.right) / 2 + 40, top: cell.top + 7, bottom: cell.bottom - 7 };
    return [{ text, bbox, strokeIds }];
  }));
  const reader = (figure: FigureInfo): DigitalBlock => ({ id: 'reader', kind: 'diagram', text: '', confidence: 0.9, bbox: scene.figures[0].bbox, strokeIds: scene.strokes.map((s) => s.id), figure });
  const reconcile = (incoming: DigitalBlock[]) => reconcileFigureBlocks(incoming, groups, scene.strokes);
  const textBlocks = (): DigitalBlock[] => positions.map((p, i): DigitalBlock => ({ ...p, id: `cell-${i}`, kind: 'paragraph', confidence: 0.9 })).reverse();

  it('recognizes the entire grid and claims all cell strokes even without model blocks', () => {
    expect(figuresOf(groups)).toHaveLength(1);
    expect(fig.kind).toBe('table');
    expect(fig.cellBounds!.map((row) => row.length)).toEqual(expected.map((row) => row.length));
    const result = reconcile([]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('diagram');
    expect(new Set(result[0].strokeIds)).toEqual(new Set(scene.strokes.map((s) => s.id)));
    expect(result[0].figure!.cells).toEqual(expected.map((row) => row.map(() => '')));
  });

  it('maps separately transcribed cells by position, not incoming order, without leaking text strokes', () => {
    const result = reconcile(textBlocks());
    expect(result).toHaveLength(1);
    expect(result[0].figure!.cells).toEqual(expected);
    expect(new Set(result[0].strokeIds)).toEqual(new Set(scene.strokes.map((s) => s.id)));
  });

  it('uses positioned model words to correct a supplied cell grid in the wrong order', () => {
    const prior: FigureInfo = { kind: 'table', shapes: [], labels: [], edges: [], cells: expected.map((row) => [...row].reverse()).reverse(), nodes: positions.map((p, i) => ({ id: `cell-${i}`, label: p.text, bbox: p.bbox })).reverse() };
    expect(reconcile([reader(prior)])[0].figure!.cells).toEqual(expected);
  });

  it('uses per-node stroke anchors when model cell boxes are absent', () => {
    const prior: FigureInfo = { kind: 'table', shapes: [], labels: [], edges: [], nodes: positions.map((p, i) => ({ id: `cell-${i}`, label: p.text, strokeIds: p.strokeIds })).reverse() };
    expect(prior.nodes!.every((n) => n.strokeIds!.length)).toBe(true);
    expect(reconcile([reader(prior)])[0].figure!.cells).toEqual(expected);
  });

  it('preserves a per-cell raw bbox when group references cover a whole column', () => {
    const blocks = positions.map((p) => rawToDigitalBlock({ kind: 'paragraph', text: p.text, bbox: p.bbox, groupIndices: groups.filter((g) => p.strokeIds.some((id) => g.strokeIds.includes(id))).map((g) => g.index), confidence: 0.9 }, groups, { left: 0, top: 0, right: scene.width, bottom: scene.height }, { width: scene.width, height: scene.height }, scene.strokes));
    expect(blocks.map((b) => b.bbox)).toEqual(positions.map((p) => p.bbox));
    expect(reconcile(blocks.reverse())[0].figure!.cells).toEqual(expected);
  });

  it('retains a correctly dimensioned unpositioned cell grid as the fallback', () => {
    expect(reconcile([reader({ kind: 'table', shapes: [], labels: [], edges: [], cells: expected })])[0].figure!.cells).toEqual(expected);
  });

  it('does not spill a malformed or oversized model grid beyond geometry cells', () => {
    const out = reconcile([reader({ kind: 'table', shapes: [], labels: [], edges: [], cells: [['wrong', 'shape', 'with', 'extra', 'columns']] })])[0];
    expect(out.figure!.cells).toEqual(expected.map((row) => row.map(() => '')));
  });

  it('does not place an unlocated word in every cell when its stroke references are invalid', () => {
    const out = reconcile([reader({ kind: 'table', shapes: [], labels: [], edges: [], nodes: [{ id: 'missing', label: 'unlocated', strokeIds: ['missing-stroke'] }] })])[0];
    expect(out.figure!.cells).toEqual(expected.map((row) => row.map(() => '')));
  });
});
