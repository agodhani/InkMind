import { expect, it } from 'vitest';
import { buildScene } from '../sim/scenes';
import { figureFromGeometry } from '../ink/shapeHints';
import type { FigureInfo } from '../model/page';
import { figureToMermaid } from '../views/figureView';
import { resolveFigureRefs } from './figure';
import { buildStrokeGroups, mergeWithGeometry } from './regions';

it.each([false, true])('keeps a connector between identically named nodes distinct, model edge: %s', (modelEdge) => {
  const scene = buildScene('state-machine', 62, 'messy');
  const groups = buildStrokeGroups(scene.strokes);
  const hint = { ...groups.find((g) => g.figure)!.figure!, kind: 'flowchart' as const };
  const full = figureFromGeometry(hint, () => undefined, groups);
  const nodes = full.nodes!.slice(0, 2);
  const geometry = { ...full, nodes, edges: [{ from: nodes[0].label, to: nodes[1].label, kind: 'arrow' as const }], sequence: nodes.map((n) => n.label) };
  const prior: FigureInfo = { kind: 'flowchart', shapes: [], labels: ['work'], nodes: nodes.map((n) => ({ id: n.id, label: 'work' })), edges: modelEdge ? [{ from: nodes[0].id, to: nodes[1].id }] : [] };
  const out = resolveFigureRefs(mergeWithGeometry(prior, hint, prior.labels, geometry));
  expect(out.nodes!.map((n) => n.label)).toEqual(['work', 'work (2)']);
  expect(out.edges).toHaveLength(1);
  expect(out.edges[0]).toMatchObject({ from: 'work', to: 'work (2)', kind: 'arrow' });
  const mermaid = figureToMermaid(out)!;
  expect(mermaid).toContain('n1 --> n2');
  expect(mermaid).not.toContain('n3');
});
