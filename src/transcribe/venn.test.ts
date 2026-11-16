import { describe, expect, it } from 'vitest';
import { buildScene, sceneReference } from '../sim/scenes';
import { containmentFromNodes, parseReferencePage, relationMetrics } from '../sim/metrics';
import { expectedBlocks } from '../sim/expectedBlocks';
import { normaliseFigure } from './figure';
import { buildStrokeGroups, rawToDigitalBlock, reconcileFigureBlocks, strokesBounds } from './regions';
import { MockTranscriber } from './mock';
import type { RawBlock, TranscribeRequest } from './types';

function fixture() {
  const scene = buildScene('venn', 2, 'normal');
  const groups = buildStrokeGroups(scene.strokes);
  const request: TranscribeRequest = { strokes: scene.strokes, groups, imageBounds: { left: 0, top: 0, right: scene.width, bottom: scene.height },
    imageSize: { width: scene.width, height: scene.height }, imageDataUrl: '', pageTitle: '', contextText: '', profile: { glossary: [], habits: [], examples: [] } };
  const reconcile = (raw: RawBlock[]) => reconcileFigureBlocks(raw.map(block => rawToDigitalBlock(block, groups, request.imageBounds, request.imageSize, scene.strokes)), groups, scene.strokes);
  return { scene, groups, request, reconcile };
}

describe('Venn geometry memberships', () => {
  it.each([false, true])('names hint-id-matched model circles without duplicating sets or locating unanchored member words (explicit shapes: %s)', shapes => {
    const { scene, groups, reconcile } = fixture();
    const circles = groups.find(g => g.figure)!.figure!.nodes.filter(n => n.shape === 'circle' || n.shape === 'ellipse');
    expect(circles).toHaveLength(2);
    const figure = normaliseFigure({ nodes: [
      { id: circles[0].id, label: 'cats', ...(shapes ? { shape: 'circle' } : {}) },
      { id: circles[1].id, label: 'dogs', ...(shapes ? { shape: 'circle' } : {}) },
      { id: 'unlocated-fur', label: 'fur', shape: 'text' },
      { id: 'unlocated-pets', label: 'pets', shape: 'text' },
      { id: 'unlocated-bark', label: 'bark', shape: 'text' },
    ] })!;
    const blocks = reconcile([{ kind: 'diagram', text: '', confidence: 0.9, bbox: scene.figures[0].bbox, groupIndices: groups.map(g => g.index), figure }]);
    const nodes = blocks[0].figure!.nodes!;
    const sets = nodes.filter(n => n.shape === 'circle' || n.shape === 'ellipse');
    expect(sets).toHaveLength(2);
    expect(sets.map(n => n.label)).toEqual(['cats', 'dogs']);
    expect(sets.map(n => n.id)).toEqual(circles.map(n => n.id));
    expect(sets.every(n => n.strokeIds!.length > 0)).toBe(true);
    for (const word of ['fur', 'pets', 'bark']) {
      const member = nodes.find(n => n.label === word)!;
      expect(member.parent).toBeUndefined();
      expect(member.parents ?? []).toEqual([]);
      expect(member.strokeIds ?? []).toEqual([]);
    }
  });

  it.each(['labels', 'nodes', 'shared group', 'unmatched hint ids'])('does not guess membership from a full unpositioned word list (%s)', source => {
    const { scene, groups, reconcile } = fixture();
    const labels = ['cats', 'fur', 'pets', 'bark', 'dogs'];
    const figure = normaliseFigure({ kind: 'shape', labels, nodes: source !== 'labels' ? labels.map((label, i) => ({ id: source === 'unmatched hint ids' ? `unmatched-n${i + 1}` : `word-${i}`, label, ...(source === 'shared group' ? { groupIndices: groups.map(g => g.index) } : {}) })) : undefined })!;
    const blocks = reconcile([{ kind: 'diagram', text: 'Venn diagram', confidence: 0.9, bbox: scene.figures[0].bbox, groupIndices: groups.map(g => g.index), figure }]);
    const nodes = blocks[0].figure!.nodes!;
    expect(containmentFromNodes(nodes).some(pair => labels.includes(pair.outer) || labels.includes(pair.inner))).toBe(false);
    expect(relationMetrics(scene.figures, blocks)).toMatchObject({ contains: 4, containsFound: 0 });
    expect(nodes.filter(n => n.shape === 'circle').every(n => !labels.includes(n.label))).toBe(true);
  });

  it.each([false, true])('uses explicit model parents without assigning unpositioned words to geometry clusters (colliding ids: %s)', colliding => {
    const { scene, groups, reconcile } = fixture();
    const cats = colliding ? 'n1' : 'cats', dogs = colliding ? 'n2' : 'dogs';
    const figure = normaliseFigure({ nodes: [
      { id: cats, label: 'cats', shape: 'circle' }, { id: dogs, label: 'dogs', shape: 'circle' },
      { id: 'pets', label: 'pets', parents: [cats, dogs] },
      { id: 'bark', label: 'bark', parent: dogs }, { id: 'fur', label: 'fur', parent: cats },
    ] })!;
    const blocks = reconcile([{ kind: 'diagram', text: '', confidence: 0.9, bbox: scene.figures[0].bbox, groupIndices: groups.map(g => g.index), figure }]);
    expect(relationMetrics(scene.figures, blocks)).toMatchObject({ contains: 4, containsFound: 4 });
    const members = blocks[0].figure!.nodes!.filter(n => ['pets', 'bark', 'fur'].includes(n.label));
    expect(members).toHaveLength(3);
    expect(members.every(n => !n.strokeIds?.length && !n.bbox)).toBe(true);
  });

  it('prefers positioned word anchors over a differently ordered model label list', () => {
    const { scene, groups, reconcile } = fixture();
    const labels = scene.figures[0].labels;
    const figure = normaliseFigure({ labels, nodes: labels.map((label, i) => ({ id: `word-${i}`, label,
      bbox: strokesBounds(scene.strokes.filter(s => scene.figures[0].labelStrokeIds![label].includes(s.id))) })) })!;
    const blocks = reconcile([{ kind: 'diagram', text: '', bbox: scene.figures[0].bbox, confidence: 0.9, groupIndices: groups.map(g => g.index), figure }]);
    expect(relationMetrics(scene.figures, blocks)).toMatchObject({ contains: 4, containsFound: 4 });
  });

  it('scores the eval figures-fence Venn encoding with the same all-parent rule as the simulator', () => {
    for (const seed of [93, 94]) {
      const scene = buildScene('venn', seed, seed === 94 ? 'messy' : 'normal');
      const reference = parseReferencePage(sceneReference(scene));
      const expected = seed === 93 ? 2 : 4;
      expect(relationMetrics(reference.figures, expectedBlocks(scene, new Map()))).toMatchObject({ contains: expected, containsFound: expected });
    }
  });

  it('does not invent names or memberships from an incomplete unpositioned list', () => {
    const { scene, groups, reconcile } = fixture();
    const blocks = reconcile([{ kind: 'diagram', text: '', confidence: 0.9, bbox: scene.figures[0].bbox, groupIndices: groups.map(g => g.index),
      figure: { kind: 'shape', shapes: [], labels: ['unlocated word'], edges: [] } }]);
    expect(blocks[0].figure!.nodes!.some(n => n.label === 'unlocated word')).toBe(false);
    expect(containmentFromNodes(blocks[0].figure!.nodes!)).toHaveLength(4);
  });

  it('keeps geometric multi-membership on the Mock and geometry-only paths without nesting circles', async () => {
    const { scene, request, reconcile } = fixture();
    const response = await new MockTranscriber().transcribe(request);
    for (const blocks of [reconcile([]), reconcile(response.blocks)]) {
      const nodes = blocks[0].figure!.nodes!;
      expect(nodes.filter(n => n.shape === 'circle')).toHaveLength(2);
      expect(nodes.filter(n => n.shape === 'circle').every(n => !n.parent && !n.parents?.length)).toBe(true);
      expect(nodes.find(n => n.shape === 'text' && n.parents?.length === 2)).toBeDefined();
      expect(containmentFromNodes(nodes)).toHaveLength(4);
      const locatedLabel = (word: string) => {
        const ids = scene.figures[0].labelStrokeIds![word];
        const node = nodes.find(n => n.strokeIds?.some(id => ids.includes(id)));
        expect(node).toBeDefined();
        return node!.label;
      };
      const reference = scene.figures.map(f => ({ ...f, contains: f.contains!.map(pair => ({ outer: locatedLabel(pair.outer), inner: locatedLabel(pair.inner) })) }));
      expect(relationMetrics(reference, blocks)).toMatchObject({ contains: 4, containsFound: 4 });
    }
    expect(relationMetrics(scene.figures, expectedBlocks(scene, new Map()))).toMatchObject({ contains: 4, containsFound: 4 });
  });

  it('loads legacy single-parent figures and resolves label-based multi-parent references', () => {
    const nodes = [{ id: 'a', label: 'cats', shape: 'circle' }, { id: 'b', label: 'dogs', shape: 'circle' }, { id: 'c', label: 'pets', parents: ['cats', 'dogs', 'cats', 'missing', 'pets'] }];
    const figure = normaliseFigure({ nodes })!;
    expect(figure.nodes![2]).toMatchObject({ parent: 'a', parents: ['a', 'b'] });
    expect(containmentFromNodes(figure.nodes!)).toHaveLength(2);
    const legacy = normaliseFigure({ nodes: [{ id: 'set', label: 'set' }, { id: 'member', label: 'member', parent: 'set' }] })!;
    expect(containmentFromNodes(legacy.nodes!)).toEqual([{ outer: 'set', inner: 'member' }]);
    expect(normaliseFigure({ nodes: [] })?.nodes ?? []).toEqual([]);
  });
});
