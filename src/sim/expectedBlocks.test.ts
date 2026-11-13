import { describe, expect, it } from 'vitest';
import { expectedBlocks } from './expectedBlocks';
import { buildScene, expectedNodeShapes, expectedTableCells } from './scenes';
import { diagramMetrics, relationMetrics } from './metrics';
import { aggregateSuite, suiteFailed, suiteMarkdown, type SuiteResult } from './suite';

function result(kind: SuiteResult['kind'] = 'flowchart-complex', seed = 1): SuiteResult {
  const scene = buildScene(kind, seed);
  const blocks = expectedBlocks(scene, new Map());
  return { kind, seed, messiness: 'normal', title: scene.title, diagrams: diagramMetrics(scene.figures, blocks), relations: relationMetrics(scene.figures, blocks), seconds: 1 };
}

describe('expected simulator blocks', () => {
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
      if (kind === 'table') expect(blocks[0].figure!.cells!.length).toBeGreaterThan(1);
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
