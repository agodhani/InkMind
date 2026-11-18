import { expect, it } from 'vitest';
import { largeDemoPages, loadKbDemo, loadLearningPathDemo, replayNotebook, type DemoNotebook } from './kbDemo';
import { extractPage } from '../kb/extract';
import { buildGraph } from '../kb/graph';
import { termKey } from '../kb/normalize';
import { mlMap } from '../path/model';
import { matchNotes } from '../path/match';
import { planPath } from '../path/plan';

it('replays each notebook to final pages with defining concepts preserved', () => {
  const fixtures = import.meta.glob<DemoNotebook>('../../eval/kb/notebooks/*.json', { eager: true, import: 'default' });
  for (const n of Object.values(fixtures)) {
    const raw = replayNotebook(n, ''), prefixed = replayNotebook(n);
    const labels = (pages: typeof raw) => buildGraph(pages.map(p => extractPage(p, { glossary: n.glossary }))).concepts.map(c => termKey(c.label)).sort();
    expect(labels(prefixed)).toEqual(labels(raw)); expect(labels(prefixed).length).toBeGreaterThan(0);
    expect(prefixed.every(p => p.id.startsWith(n.name) && p.blocks.every(b => b.confidence === 1 && b.strokeIds.length === 0))).toBe(true);
  }
  const demo = loadKbDemo();
  expect(new Set(demo.pages.map(p => p.id)).size).toBe(demo.pages.length);
  expect(demo.extractions.length).toBeGreaterThan(0); expect(demo.glossary.length).toBeGreaterThan(0);
  const graph = buildGraph(demo.extractions);
  expect(graph.proposals?.some(p => p.status === 'proposed')).toBe(true);
  expect(graph.proposals?.some(p => p.kind === 'alias')).toBe(true);
  expect(graph.proposals?.some(p => p.kind === 'proposition')).toBe(true);
  expect(graph.proposals?.every(p => p.provenance.every(s => demo.pages.some(page => page.id === s.pageId && page.blocks.some(b => b.id === s.blockId))))).toBe(true);
  const large = largeDemoPages(); expect(large).toHaveLength(10);
  expect(buildGraph(large.map(p => extractPage(p, { glossary: [] }))).concepts).toHaveLength(120);
  expect(replayNotebook({ name: 'empty', glossary: [], steps: [] })).toEqual([]);
  expect(largeDemoPages(0)).toEqual([]);
});

it('loads only the prior-knowledge demo notebooks and creates a substantial offline RLHF/RLVR path', () => {
  const { pages, goals } = loadLearningPathDemo();
  expect(goals).toEqual(['rlhf', 'rlvr']);
  expect(pages.every(p => /^path-(backprop|minimax)-/.test(p.id))).toBe(true);
  const extractions = pages.map(page => extractPage(page, { glossary: [] }));
  const matches = matchNotes(mlMap, { extractions, graph: buildGraph(extractions) });
  for (const label of ['Backpropagation', 'Minimax']) {
    const concept = mlMap.concepts.find(c => c.label === label);
    expect(matches.find(m => m.conceptId === concept?.id)?.basis).toBe('notes');
  }
  const plan = planPath(mlMap, goals, matches);
  expect(plan.steps.filter(s => s.status !== 'done').length).toBeGreaterThanOrEqual(40);
  expect(plan.next.length).toBeGreaterThan(0);
});
