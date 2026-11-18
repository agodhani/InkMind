import { expect, it } from 'vitest';
import { loadKbDemo, largeDemoPages } from '../sim/kbDemo';
import { extractPage } from './extract';
import { buildGraph } from './graph';
import { layoutGraph } from './mapView';
import type { KbGraph } from './model';
import { boxesOverlap, fitCamera, placeLabels, screenNodeBox } from '../views/mapGestures';

function combinedDemoGraph() {
  const demo = loadKbDemo(), seeded = new Map(demo.extractions.map(e => [e.pageId, e]));
  return buildGraph([...demo.pages, ...largeDemoPages(120)].map(p => seeded.get(p.id) ?? extractPage(p, { glossary: demo.glossary })));
}

function extendGraph(base: KbGraph): KbGraph {
  const graph = structuredClone(base);
  for (let i = 0; graph.concepts.length < Math.max(191, base.concepts.length + 1); i++) {
    const from = base.concepts[i % base.concepts.length];
    const concept = { ...from, id: `synthetic-model-${i}`, label: `Proposed topic ${i}`, origin: 'model' as const, status: 'proposed' as const };
    graph.concepts.push(concept);
    graph.edges.push({ ...base.edges[0], id: `synthetic-edge-${i}`, from: from.id, to: concept.id, origin: 'model', status: 'proposed' });
  }
  for (let i = 0; graph.edges.length < 307; i++) {
    graph.edges.push({ ...base.edges[0], id: `extra-edge-${i}`, from: graph.concepts[i % graph.concepts.length].id, to: graph.concepts[(i + 2) % graph.concepts.length].id });
  }
  return graph;
}

const real = combinedDemoGraph();
const cases = [{ name: 'real loaders', graph: real }, { name: 'extended with model proposals', graph: extendGraph(real) }]
  .flatMap(dataset => [{ width: 1024, height: 768 }, { width: 768, height: 1024 }].map(size => ({ ...dataset, ...size })));

it.each(cases)('separates nodes and labels: $name at $width × $height', ({ graph, width, height, name }) => {
  expect(real.concepts.length).toBeGreaterThan(150);
  expect(real.edges.length).toBeGreaterThan(250);
  if (name.startsWith('extended')) {
    expect(graph.concepts.length).toBeGreaterThanOrEqual(191);
    expect(graph.edges.length).toBeGreaterThanOrEqual(307);
    expect(graph.concepts.some(c => c.origin === 'model' && c.status === 'proposed')).toBe(true);
  }
  for (const size of [{ width, height }, { width, height: height - 230 }]) {
    const options = { width: size.width - 80, height: size.height - 100, seed: 17 };
    const positions = layoutGraph(graph, options), points = Object.values(positions);
    expect(Object.keys(positions).sort()).toEqual(graph.concepts.map(c => c.id).sort());
    expect(layoutGraph(graph, options)).toEqual(positions);
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      expect(Math.abs(points[i].x - points[j].x) >= 44 || Math.abs(points[i].y - points[j].y) >= 44).toBe(true);
    }
    const camera = fitCamera(points, size);
    const nodes = graph.concepts.map(c => ({ ...c, ...positions[c.id], degree: graph.edges.filter(e => e.from === c.id || e.to === c.id).length }));
    const nodeBoxes = nodes.map(n => screenNodeBox(n, camera));
    const labelBoxes = [...placeLabels(nodes, camera, size).values()].map(l => l.box);
    expect(labelBoxes.length).toBeGreaterThan(8);
    for (const box of nodeBoxes) {
      expect(box.left).toBeGreaterThanOrEqual(30); expect(box.right).toBeLessThanOrEqual(size.width - 30);
      expect(box.top).toBeGreaterThanOrEqual(30); expect(box.bottom).toBeLessThanOrEqual(size.height - 30);
    }
    for (let i = 0; i < nodeBoxes.length; i++) for (let j = i + 1; j < nodeBoxes.length; j++) expect(boxesOverlap(nodeBoxes[i], nodeBoxes[j])).toBe(false);
    for (let i = 0; i < labelBoxes.length; i++) {
      for (let j = i + 1; j < labelBoxes.length; j++) expect(boxesOverlap(labelBoxes[i], labelBoxes[j])).toBe(false);
      for (const nodeBox of nodeBoxes) expect(boxesOverlap(labelBoxes[i], nodeBox)).toBe(false);
    }
  }
});
