import { expect, it } from 'vitest';
import { largeDemoPages, loadKbDemo, replayNotebook, type DemoNotebook } from './kbDemo';
import { extractPage } from '../kb/extract';
import { buildGraph } from '../kb/graph';
import { termKey } from '../kb/normalize';

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
  expect(demo.proposals).toHaveLength(4); expect(demo.glossary.length).toBeGreaterThan(0);
  const large = largeDemoPages(); expect(large).toHaveLength(10);
  expect(buildGraph(large.map(p => extractPage(p, { glossary: [] }))).concepts).toHaveLength(120);
  expect(replayNotebook({ name: 'empty', glossary: [], steps: [] })).toEqual([]);
  expect(largeDemoPages(0)).toEqual([]);
});
