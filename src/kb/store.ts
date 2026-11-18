import type { Page } from '../model/page';
import type { KbGraph, PageExtraction } from './model';
import { extractPage } from './extract';
import { buildGraph } from './graph';

export interface KnowledgeStore {
  listExtractions(): Promise<PageExtraction[]>;
  loadGraph(): Promise<KbGraph>;
  commit(pageId: string, extraction: PageExtraction | null, graph: KbGraph): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryKnowledgeStore implements KnowledgeStore {
  private extractions = new Map<string, PageExtraction>();
  private graph: KbGraph = { concepts: [], edges: [] };
  async listExtractions(): Promise<PageExtraction[]> { return structuredClone([...this.extractions.values()]); }
  async loadGraph(): Promise<KbGraph> { return structuredClone(this.graph); }
  async commit(pageId: string, extraction: PageExtraction | null, graph: KbGraph): Promise<void> {
    const copy = structuredClone({ extraction, graph });
    if (copy.extraction) this.extractions.set(pageId, copy.extraction);
    else this.extractions.delete(pageId);
    this.graph = copy.graph;
  }
  async clear(): Promise<void> { this.extractions.clear(); this.graph = { concepts: [], edges: [] }; }
}

export interface SyncOptions {
  glossary: string[];
  extract?: (page: Page, opts: { glossary: string[] }) => PageExtraction | Promise<PageExtraction>;
}

export async function syncPage(store: KnowledgeStore, page: Page, opts: SyncOptions): Promise<KbGraph> {
  const extraction = await (opts.extract ?? extractPage)(page, opts);
  const all = (await store.listExtractions()).filter(e => e.pageId !== page.id);
  const graph = buildGraph([...all, extraction], await store.loadGraph());
  await store.commit(page.id, extraction, graph);
  return graph;
}

export async function removePage(store: KnowledgeStore, pageId: string): Promise<KbGraph> {
  const all = (await store.listExtractions()).filter(e => e.pageId !== pageId);
  const graph = buildGraph(all, await store.loadGraph());
  await store.commit(pageId, null, graph);
  return graph;
}
