import type { DigitalBlock, Page } from '../model/page';
import { demoGraph } from '../kb/mapView';
import type { PageExtraction, Provenance } from '../kb/model';
import { extractPage } from '../kb/extract';
import { parseModelExtraction } from '../kb/modelExtractor';

interface NotebookPage { id: string; title?: string; blocks: (Partial<DigitalBlock> & Pick<DigitalBlock, 'id' | 'kind' | 'text'>)[] }
export interface DemoNotebook { name: string; glossary: string[]; steps: ({ op: 'put'; page: NotebookPage } | { op: 'delete'; pageId: string })[] }
const notebooks = import.meta.glob<DemoNotebook>('../../eval/kb/notebooks/*.json', { eager: true, import: 'default' });
const savedResponses = import.meta.glob<string>('../../eval/kb/results/kb-ollama-qwen25-3b-v2/raw/*/*.json', { eager: true, query: '?raw', import: 'default' });
export interface KbDemo { pages: Page[]; glossary: string[]; extractions: PageExtraction[] }
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
export function loadKbDemo(): KbDemo {
  const fixtures = Object.entries(notebooks).sort(([a], [b]) => a.localeCompare(b)).map(([, n]) => n);
  const pages = fixtures.flatMap(n => replayNotebook(n));
  const glossary = [...new Set(fixtures.flatMap(n => n.glossary))];
  const latest = new Map<string, PageExtraction>();
  for (const [path, raw] of Object.entries(savedResponses).sort(([a], [b]) => Number(a.split('/').at(-1)!.split('-')[0]) - Number(b.split('/').at(-1)!.split('-')[0]) || a.localeCompare(b))) {
    const extraction = parseModelExtraction(raw), prefix = path.split('/').at(-2)!;
    latest.set(`${prefix}-${extraction.pageId}`, extraction);
  }
  const extractions = pages.flatMap(page => {
    const original = latest.get(page.id);
    if (!original?.model) return [];
    const blockId = (id: string) => `${page.id}-${id}`;
    const prov = (p: Provenance): Provenance => ({ ...p, pageId: page.id, blockId: blockId(p.blockId), strokeIds: [] });
    const fresh = extractPage(page, { glossary });
    const model = { ...original.model, blocks: original.model.blocks.map(b => ({ ...b, id: blockId(b.id) })), suggestions: original.model.suggestions.map(s => s.kind === 'edge' ? { ...s, relation: { ...s.relation, prov: prov(s.relation.prov) } } : { ...s, prov: prov(s.prov) }) };
    return [{ ...fresh, extractor: 'deterministic+model', model }];
  });
  return { pages, glossary, extractions };
}
