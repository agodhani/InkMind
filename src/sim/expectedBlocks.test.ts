import { describe, expect, it } from 'vitest';
import { expectedBlocks } from './expectedBlocks';
import { buildScene, expectedNodeShapes, expectedTableCells } from './scenes';
import { diagramMetrics, relationMetrics } from './metrics';
import { aggregateSuite, suiteFailed, suiteMarkdown, type SuiteResult } from './suite';
import { stepNode } from '../views/figureView';
import { nodeInkStrokes } from '../views/figureInk';

function result(kind: SuiteResult['kind'] = 'flowchart-complex', seed = 1): SuiteResult {
  const scene = buildScene(kind, seed);
  const blocks = expectedBlocks(scene, new Map());
  return { kind, seed, messiness: 'normal', title: scene.title, diagrams: diagramMetrics(scene.figures, blocks), relations: relationMetrics(scene.figures, blocks), seconds: 1 };
}

describe('expected simulator blocks', () => {
  it('represents Venn seed 2 sets, members and both overlap memberships with remapped ink', () => {
    const scene = buildScene('venn', 2, 'normal');
    const blocks = expectedBlocks(scene, new Map(scene.strokes.map(s => [s.id, `page-${s.id}`])));
    const nodes = blocks[0].figure!.nodes!;
    expect(nodes.filter(n => n.shape === 'circle').map(n => n.label)).toEqual(['cats', 'dogs']);
    expect(nodes.find(n => n.label === 'fur')).toMatchObject({ shape: 'text', parent: 'cats', parents: ['cats'] });
    expect(nodes.find(n => n.label === 'bark')).toMatchObject({ shape: 'text', parent: 'dogs', parents: ['dogs'] });
    expect(nodes.find(n => n.label === 'pets')).toMatchObject({ shape: 'text', parent: 'cats', parents: ['cats', 'dogs'] });
    const figures = scene.figures.map(f => ({ ...f, strokeIds: f.strokeIds.map(id => `page-${id}`) }));
    expect(relationMetrics(figures, blocks)).toMatchObject({ contains: 4, containsFound: 4, containsStructured: true });
    for (const node of nodes) {
      expect(node.strokeIds!.length).toBeGreaterThan(0);
      expect(node.strokeIds!.every(id => id.startsWith('page-'))).toBe(true);
      expect(node.strokeIds!.length).toBeLessThan(blocks[0].strokeIds.length);
    }
    expect(nodes.filter(n => n.shape === 'circle').every(n => !n.parent && !n.parents?.length)).toBe(true);
  });
  it('anchors sequence seed 2 actors and individual numbered message arrows with their labels', () => {
    const scene = buildScene('sequence-diagram', 2, 'normal');
    const map = new Map(scene.strokes.map(s => [s.id, `page-${s.id}`]));
    const block = expectedBlocks(scene, map)[0];
    const figure = block.figure!;
    const open = nodeInkStrokes(block, stepNode(figure, 'open page'), []);
    const json = nodeInkStrokes(block, stepNode(figure, 'json'), []);
    expect(open).toEqual(scene.figures[0].edges![0].strokeIds!.map(id => map.get(id)));
    expect(json).toEqual(scene.figures[0].edges![4].strokeIds!.map(id => map.get(id)));
    expect(open.length).toBeGreaterThan(3);
    expect(json.length).toBeGreaterThan(3);
    expect(open.some(id => json.includes(id))).toBe(false);
    for (const node of figure.nodes!) {
      expect(node.strokeIds!.length).toBeGreaterThan(0);
      expect(node.strokeIds!.length).toBeLessThan(block.strokeIds.length);
      expect(node.strokeIds!.every(id => id.startsWith('page-'))).toBe(true);
      expect(node.strokeIds!.some(id => open.includes(id) || json.includes(id))).toBe(false);
    }
  });
  it.each(['flowchart', 'flowchart-complex'] as const)('anchors each %s node shape and text without its neighbours', kind => {
    const scene = buildScene(kind, 2, 'normal');
    const block = expectedBlocks(scene, new Map())[0];
    const nodes = block.figure!.nodes!;
    for (const node of nodes) {
      const ids = nodeInkStrokes(block, node, []);
      expect(ids.length).toBeGreaterThan(scene.figures[0].labelStrokeIds![node.label].length);
      expect(ids.length).toBeLessThan(block.strokeIds.length);
      expect(ids).toEqual(expect.arrayContaining(scene.figures[0].labelStrokeIds![node.label]));
      for (const other of nodes.filter(n => n !== node)) expect(ids.some(id => other.strokeIds!.includes(id))).toBe(false);
    }
  });
  it.each(['flowchart-complex', 'nested-boxes', 'table', 'mind-map'] as const)('reproduces %s figures and relations with remapped ink', kind => {
    for (const seed of [1, 2, 5, 73]) {
      const scene = buildScene(kind, seed);
      const map = new Map(scene.strokes.map(s => [s.id, `page-${s.id}`]));
      const blocks = expectedBlocks(scene, map);
      const figures = scene.figures.map(f => ({ ...f, strokeIds: f.strokeIds.map(id => map.get(id)!) }));
      const d = diagramMetrics(figures, blocks), r = relationMetrics(figures, blocks);
      expect(d.detected).toBe(d.figures);
      expect(d.labelsFound).toBe(d.labels);
      expect(r.edgesFound).toBe(r.edges);
      expect(r.predictedMatched).toBe(r.predicted);
      expect(r.containsFound).toBe(r.contains);
      expect(r.sequencesExact).toBe(r.sequences);
      expect(r.figureCountExact).toBe(true);
      expect(blocks.every(b => b.strokeIds.every(id => id.startsWith('page-')))).toBe(true);
      if (kind === 'table') {
        expect(blocks[0].figure!.cells!.length).toBeGreaterThan(1);
        expect(blocks[0].figure!.sequence).toBeUndefined();
      }
      if (kind === 'nested-boxes') expect(blocks[0].figure!.nodes!.some(n => n.parent)).toBe(true);
    }
  });
  it('includes notes text and leaves an empty scene empty', () => {
    const scene = buildScene('notes-complex', 1);
    expect(expectedBlocks(scene, new Map()).find(b => b.kind === 'paragraph')!.text).toBe(scene.text);
    expect(expectedBlocks({ ...scene, figures: [], strokes: [], text: '' }, new Map())).toEqual([]);
  });
  it('preserves blank table headers and actual template node shapes', () => {
    expect(expectedTableCells(['train', 'val', 'loss', '0.12', '0.31', 'acc', '98', '91'])).toEqual([['', 'train', 'val'], ['loss', '0.12', '0.31'], ['acc', '98', '91']]);
    expect(expectedTableCells([])).toBeUndefined();
    const shapeNames = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const scene = buildScene('nested-boxes', seed);
      for (const shape of expectedNodeShapes(scene.figures[0]).values()) shapeNames.add(shape);
    }
    expect(shapeNames.has('circle')).toBe(true);
    expect(shapeNames.has('box')).toBe(true);
    const flow = buildScene('flowchart', 1);
    expect([...expectedNodeShapes(flow.figures[0]).values()]).toContain('rounded');
  });
});

describe('suite aggregates and failures', () => {
  it('groups normal/messy counts and sums scores per kind', () => {
    const a = result(), b = { ...result(), messiness: 'messy' as const }, c = result('table');
    const groups = aggregateSuite([a, b, c]);
    expect(groups[0]).toMatchObject({ kind: a.kind, normal: 1, messy: 1, failures: 0, summary: { scenes: 2, seconds: 2 } });
    expect(groups[1].results).toEqual([c]);
    expect(aggregateSuite([])).toEqual([]);
    const md = suiteMarkdown([a, b]);
    expect(md).toContain('| kind | normal | messy |');
    expect(md).toContain(`| ${a.kind} | 1 | 1 |`);
    expect(md).toContain('| seed | status |');
    expect(md).toContain('**total**');
  });
  it('fails timeouts, count mismatches and every incomplete nonzero metric', () => {
    const good = result();
    expect(suiteFailed(good)).toBe(false);
    expect(suiteFailed({ ...good, timedOut: true })).toBe(true);
    expect(suiteFailed({ ...good, relations: { ...good.relations, figureCountExact: false } })).toBe(true);
    for (const [found, total] of [['detected', 'figures'], ['labelsFound', 'labels']] as const) expect(suiteFailed({ ...good, diagrams: { ...good.diagrams, [found]: 0, [total]: 1 } })).toBe(true);
    for (const [found, total] of [['edgesFound', 'edges'], ['predictedMatched', 'predicted'], ['sequencesExact', 'sequences'], ['containsFound', 'contains']] as const) {
      expect(suiteFailed({ ...good, relations: { ...good.relations, [found]: 0, [total]: 1 } })).toBe(true);
      expect(suiteFailed({ ...good, relations: { ...good.relations, [found]: 0, [total]: 0 } })).toBe(false);
    }
    expect(aggregateSuite([good, { ...good, timedOut: true }])[0].failures).toBe(1);
  });
});
