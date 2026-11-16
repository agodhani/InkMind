import { describe, expect, it } from 'vitest';
import { rect, arrowTwoStrokes, textLine, resetSynthetic } from '../__tests__/shapes';
import { buildStrokeGroups, rawToDigitalBlock, reconcileFigureBlocks, strokesBounds } from './regions';
import { MockTranscriber } from './mock';
import type { RawBlock, TranscribeRequest } from './types';
import { buildScene } from '../sim/scenes';

describe('reconciled node ink anchors', () => {
  it('grounds model-like node words in each geometry shape and its label ink', () => {
    resetSynthetic();
    const a = rect(0, 0, 120, 80, 0), aText = textLine(25, 45, 4, 12, 1000);
    const arrow = arrowTwoStrokes(125, 40, 235, 40, 6000);
    const b = rect(240, 0, 360, 80, 12000), bText = textLine(265, 45, 4, 12, 13000);
    const strokes = [a, ...aText, ...arrow, b, ...bText];
    const groups = buildStrokeGroups(strokes);
    const bbox = strokesBounds(strokes)!;
    const raw: RawBlock = { kind: 'diagram', text: 'Start then finish', bbox, groupIndices: groups.map(g => g.index), confidence: 0.9,
      figure: { kind: 'flowchart', shapes: ['rectangle'], labels: ['Start', 'Finish'], nodes: [{ id: 'n1', label: 'Start' }, { id: 'n2', label: 'Finish' }], edges: [{ from: 'n1', to: 'n2' }], sequence: ['Start', 'Finish'] } };
    const digital = rawToDigitalBlock(raw, groups, bbox, { width: bbox.right - bbox.left, height: bbox.bottom - bbox.top }, strokes);
    const figure = reconcileFigureBlocks([digital], groups, strokes)[0].figure!;
    expect(figure.nodes).toHaveLength(2);
    expect(figure.nodes![0].strokeIds).toEqual(expect.arrayContaining([a.id, ...aText.map(s => s.id)]));
    expect(figure.nodes![1].strokeIds).toEqual(expect.arrayContaining([b.id, ...bText.map(s => s.id)]));
    for (const node of figure.nodes!) {
      expect(node.strokeIds!.some(id => arrow.some(s => s.id === id))).toBe(false);
      expect(node.strokeIds!.length).toBeLessThan(strokes.length);
    }
  });
  it('keeps the Mock path grounded after raw conversion and reconciliation', async () => {
    const scene = buildScene('flowchart', 2, 'normal');
    const groups = buildStrokeGroups(scene.strokes);
    const imageBounds = { left: 0, top: 0, right: scene.width, bottom: scene.height };
    const imageSize = { width: scene.width, height: scene.height };
    const request: TranscribeRequest = { strokes: scene.strokes, groups, imageBounds, imageSize, imageDataUrl: '', contextText: '', pageTitle: '', profile: { glossary: [], habits: [], examples: [] } };
    const result = await new MockTranscriber().transcribe(request);
    const incoming = result.blocks.map(raw => rawToDigitalBlock(raw, groups, imageBounds, imageSize, scene.strokes));
    const figure = reconcileFigureBlocks(incoming, groups, scene.strokes).find(b => b.kind === 'diagram')!.figure!;
    expect(figure.nodes!.length).toBeGreaterThan(1);
    for (const node of figure.nodes!) {
      expect(node.strokeIds!.length).toBeGreaterThan(0);
      expect(node.strokeIds!.length).toBeLessThan(scene.strokes.length);
      expect(node.strokeIds!.every(id => scene.strokes.some(s => s.id === id))).toBe(true);
    }
    expect(new Set(figure.nodes!.map(n => n.strokeIds!.join(','))).size).toBe(figure.nodes!.length);
  });
});
