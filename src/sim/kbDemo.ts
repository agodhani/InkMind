import type { DigitalBlock, Page } from '../model/page';
import { demoGraph } from '../kb/mapView';
import type { KbProposal } from '../kb/proposals';

interface NotebookPage { id: string; title?: string; blocks: (Partial<DigitalBlock> & Pick<DigitalBlock, 'id' | 'kind' | 'text'>)[] }
export interface DemoNotebook { name: string; glossary: string[]; steps: ({ op: 'put'; page: NotebookPage } | { op: 'delete'; pageId: string })[] }
const notebooks = import.meta.glob<DemoNotebook>('../../eval/kb/notebooks/*.json', { eager: true, import: 'default' });
export function replayNotebook(notebook: DemoNotebook, prefix = notebook.name): Page[] {
  const pages = new Map<string, Page>();
  for (const step of notebook.steps) {
    if (step.op === 'delete') { pages.delete(step.pageId); continue; }
    const input = step.page;
    pages.set(input.id, { id: `${prefix}-${input.id}`, title: `${prefix}: ${input.title ?? input.id}`, createdAt: 0, updatedAt: 0, strokes: [], blocks: input.blocks.map((b, i) => ({ ...b, id: `${prefix}-${input.id}-${b.id}`, bbox: { left: 0, top: i * 40, right: 600, bottom: i * 40 + 30 }, confidence: 1, strokeIds: [] })) });
  }
  return [...pages.values()];
}
export function largeDemoPages(n = 120): Page[] {
  const graph = demoGraph(n), pages = new Map<string, Page>();
  graph.concepts.forEach(c => {
    const prov = c.provenance[0];
    const page = pages.get(prov.pageId) ?? { id: prov.pageId, title: `Large notebook ${pages.size + 1}`, createdAt: 0, updatedAt: 0, strokes: [], blocks: [] };
    const i = page.blocks.length;
    page.blocks.push({ id: prov.blockId, kind: 'heading', text: c.label, level: 2, bbox: { left: 0, top: i * 80, right: 600, bottom: i * 80 + 30 }, confidence: 1, strokeIds: [] });
    page.blocks.push({ id: `${prov.blockId}-links`, kind: 'paragraph', text: graph.edges.filter(e => e.from === c.id).map(e => `[[${graph.concepts.find(t => t.id === e.to)!.label}]]`).join(' '), bbox: { left: 0, top: i * 80 + 40, right: 600, bottom: i * 80 + 70 }, confidence: 1, strokeIds: [] });
    pages.set(page.id, page);
  });
  return [...pages.values()];
}
export function loadKbDemo(): { pages: Page[]; glossary: string[]; proposals: KbProposal[] } {
  const fixtures = Object.entries(notebooks).sort(([a], [b]) => a.localeCompare(b)).map(([, n]) => n);
  const pages = [...fixtures.flatMap(n => replayNotebook(n)), ...largeDemoPages()];
  const provenance = [{ pageId: 'large-0', blockId: 'topic-0', strokeIds: [], extractor: 'fixture', surface: 'Knowledge synthesis' }];
  const proposals: KbProposal[] = [
    { id: 'fixture-synthesis', kind: 'concept', label: 'Knowledge synthesis', provenance, origin: 'fixture', status: 'suggested' },
    { id: 'fixture-retrieval', kind: 'concept', label: 'Knowledge retrieval', provenance, origin: 'fixture', status: 'suggested' },
    { id: 'fixture-support', kind: 'edge', from: 'Knowledge topic 1', to: 'fixture-synthesis', edgeKind: 'supports', provenance, origin: 'fixture', status: 'suggested' },
    { id: 'fixture-follows', kind: 'edge', from: 'fixture-synthesis', to: 'fixture-retrieval', edgeKind: 'follows', provenance, origin: 'fixture', status: 'suggested' },
  ];
  return { pages, glossary: [...new Set(fixtures.flatMap(n => n.glossary))], proposals };
}
