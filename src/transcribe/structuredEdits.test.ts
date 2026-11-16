import { describe, expect, it } from 'vitest';
import type { DigitalBlock, FigureInfo, InkStroke } from '../model/page';
import { buildScene } from '../sim/scenes';
import { expectedBlocks } from '../sim/expectedBlocks';
import { fromPoints } from '../__tests__/shapes';
import { figureEndpointLabel, renameFigureNodes, stepNode } from '../views/figureView';
import { nodeInkStrokes } from '../views/figureInk';
import { sequenceEdgeIndices } from './figure';
import { MockTranscriber } from './mock';
import { attachUnclaimedStrokes, buildStrokeGroups, mergeBlocks, protectEditedBlocks, rawToDigitalBlock, reconcileFigureBlocks } from './regions';
import type { TranscribeRequest } from './types';

function fixture() {
  const scene = buildScene('sequence-diagram', 2, 'normal');
  const block = expectedBlocks(scene, new Map(scene.strokes.map(s => [s.id, s.id])))[0];
  const initial = structuredClone(block.figure!);
  const figure = renameFigureNodes(initial, new Map([['user', 'reader']]));
  figure.sequence![0] = 'open dashboard';
  figure.edges[0].label = 'open dashboard';
  figure.sequenceEdges = sequenceEdgeIndices(initial);
  figure.sequenceBaseline = initial.sequence!.map((text, i) => ({ text, edge: figure.sequenceEdges![i] }));
  [figure.sequence![0], figure.sequence![1]] = [figure.sequence![1], figure.sequence![0]];
  [figure.sequenceEdges[0], figure.sequenceEdges[1]] = [figure.sequenceEdges[1], figure.sequenceEdges[0]];
  block.figure = figure;
  block.userEdited = true;
  const added = fromPoints([{ x: block.bbox.left + 90, y: block.bbox.top + 100 }, { x: block.bbox.left + 110, y: block.bbox.top + 110 }], 100000, 'added-ink');
  const strokes = [...scene.strokes, added];
  const groups = buildStrokeGroups(strokes);
  const req: TranscribeRequest = { strokes, groups, imageBounds: { left: 0, top: 0, right: scene.width, bottom: scene.height },
    imageSize: { width: scene.width, height: scene.height }, imageDataUrl: '', contextText: '', pageTitle: '', profile: { glossary: [], habits: [], examples: [] } };
  return { block, req, added };
}

function finish(block: DigitalBlock, incoming: DigitalBlock[], strokes: InkStroke[], changed: string[]) {
  const protectedResult = protectEditedBlocks([block], incoming, new Set(changed));
  return mergeBlocks([block], protectedResult.replacedIds, attachUnclaimedStrokes(protectedResult.incoming, strokes)).find(b => b.id === block.id)!;
}

function assertCorrections(result: DigitalBlock, old: DigitalBlock, added: InkStroke, strokes: InkStroke[]) {
  expect(result.userEdited).toBe(true);
  expect(result.figure!.nodes!.map(n => n.label)).toEqual(expect.arrayContaining(['reader', 'app', 'api', 'cache']));
  expect(result.figure!.sequence).toEqual(['get key', 'open dashboard', 'miss', 'fetch', 'json', 'render']);
  expect(result.figure!.edges.map(edge => ({ from: figureEndpointLabel(result.figure!, edge.from), to: figureEndpointLabel(result.figure!, edge.to), label: edge.label })))
    .toEqual(expect.arrayContaining([{ from: 'reader', to: 'app', label: 'open dashboard' }]));
  expect(result.strokeIds).toEqual(expect.arrayContaining([...old.strokeIds, added.id]));
  expect(result.strokeIds.length).toBeGreaterThan(old.strokeIds.length);
  const step = stepNode(result.figure!, 'open dashboard', 1);
  expect(nodeInkStrokes(result, step, strokes)).toEqual(expect.arrayContaining(old.figure!.edges[0].strokeIds!));
  expect(nodeInkStrokes(result, step, strokes).length).toBeLessThan(result.strokeIds.length);
}

describe('structured corrections through retranscription', () => {
  it('keeps sequence node/step corrections, order and arrow anchors through the real Mock pipeline, twice', async () => {
    const { block, req, added } = fixture();
    const saved = structuredClone(block);
    const response = await new MockTranscriber().transcribe(req);
    const incoming = reconcileFigureBlocks(response.blocks.map(raw => rawToDigitalBlock(raw, req.groups, req.imageBounds, req.imageSize, req.strokes)), req.groups, req.strokes);
    const result = finish(block, incoming, req.strokes, [added.id]);
    assertCorrections(result, block, added, req.strokes);
    const again = finish(result, incoming, req.strokes, [added.id]);
    expect(again.figure!.sequence).toEqual(result.figure!.sequence);
    expect(block).toEqual(saved);
  });

  it('keeps corrections through a model-like response with renumbered nodes and placeholder labels', () => {
    const { block, req, added } = fixture();
    const placeholder: FigureInfo = { ...structuredClone(block.figure!),
      nodes: block.figure!.nodes!.map((node, i) => ({ ...node, id: `model-${i}`, label: `[Handwriting ${i}]` })),
      edges: block.figure!.edges.map((edge, i) => ({ ...edge, from: 'model-0', to: 'model-1', label: `wrong ${i}` })),
      sequence: block.figure!.edges.map((_, i) => `wrong ${i}`), sequenceEdges: [0, 1, 2, 3, 4, 5], sequenceBaseline: undefined };
    const raw = { kind: 'diagram' as const, text: 'model reread', bbox: block.bbox, groupIndices: req.groups.map(g => g.index), confidence: 0.9, figure: placeholder };
    const incoming = reconcileFigureBlocks([rawToDigitalBlock(raw, req.groups, req.imageBounds, req.imageSize, req.strokes)], req.groups, req.strokes);
    assertCorrections(finish(block, incoming, req.strokes, [added.id]), block, added, req.strokes);
  });

  it('retains an edited endpoint independently of incoming topology and appends genuinely new anchored nodes', () => {
    const { block, req, added } = fixture();
    block.figure!.edges[0].to = 'cache';
    const incoming = structuredClone(block);
    incoming.strokeIds.push(added.id);
    incoming.figure!.nodes = incoming.figure!.nodes!.filter(n => n.label !== 'reader');
    incoming.figure!.nodes.push({ id: 'new', label: 'New node', strokeIds: [added.id] });
    incoming.figure!.edges[0] = { ...incoming.figure!.edges[0], from: 'wrong', to: 'api', label: 'wrong' };
    const result = finish(block, [incoming], req.strokes, [added.id]);
    expect(result.figure!.nodes!.map(n => n.label)).toEqual(expect.arrayContaining(['reader', 'New node']));
    expect(figureEndpointLabel(result.figure!, result.figure!.edges[0].from)).toBe('reader');
    expect(result.figure!.edges[0]).toMatchObject({ to: 'cache', label: 'open dashboard' });
  });

  it.each([
    [['[header]', '[qty]'], ['[row]', 'wrong'], ['[pear]', 'wrong']],
    [['[header]', 'qty'], ['[row]', 'wrong'], ['pear', 'wrong']],
    [],
  ].map(cells => ({ cells })))('preserves edited table headers, row keys, blank and nonblank cells against reread %j', ({ cells }) => {
    const { block, req, added } = fixture();
    block.figure = { kind: 'table', shapes: ['rectangle'], labels: [], edges: [], cells: [['Corrected header', 'qty'], ['Corrected row', '12'], ['pear', '']] };
    const incoming = { ...block, strokeIds: [...block.strokeIds, added.id], figure: { ...block.figure, cells } };
    expect(finish(block, [incoming], req.strokes, [added.id]).figure!.cells).toEqual(block.figure.cells);
  });

  it('retains anchored corrections when the model returns an empty figure for existing ink', () => {
    const { block, req, added } = fixture();
    const incoming = { ...block, strokeIds: [...block.strokeIds, added.id], figure: { kind: 'sequence' as const, shapes: [], labels: [], edges: [], sequence: [] } };
    assertCorrections(finish(block, [incoming], req.strokes, [added.id]), block, added, req.strokes);
  });
});
