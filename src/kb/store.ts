import type { Page } from '../model/page';
import type { GraphProposal, KbGraph, PageExtraction, ProposalDecision } from './model';
import type { ExtractionContext, Extractor } from './extractor';
import { extractPage } from './extract';
import { buildGraph } from './graph';

export interface KnowledgeStore {
  listExtractions(): Promise<PageExtraction[]>;
  loadGraph(): Promise<KbGraph>;
  commit(pageId: string | null, extraction: PageExtraction | null, graph: KbGraph): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryKnowledgeStore implements KnowledgeStore {
  private extractions = new Map<string, PageExtraction>();
  private graph: KbGraph = { concepts: [], edges: [] };
  async listExtractions(): Promise<PageExtraction[]> { return structuredClone([...this.extractions.values()]); }
  async loadGraph(): Promise<KbGraph> { return structuredClone(this.graph); }
  async commit(pageId: string | null, extraction: PageExtraction | null, graph: KbGraph): Promise<void> {
    const copy = structuredClone({ extraction, graph });
    if (pageId !== null) {
      if (copy.extraction) this.extractions.set(pageId, copy.extraction);
      else this.extractions.delete(pageId);
    }
    this.graph = copy.graph;
  }
  async clear(): Promise<void> { this.extractions.clear(); this.graph = { concepts: [], edges: [] }; }
}

export interface SyncOptions {
  glossary: string[];
  extract?: (page: Page, opts: ExtractionContext) => PageExtraction | Promise<PageExtraction>;
  extractor?: Extractor;
  signal?: AbortSignal;
}

export async function syncPage(store: KnowledgeStore, page: Page, opts: SyncOptions): Promise<KbGraph> {
  const [all, previousGraph] = await Promise.all([store.listExtractions(), store.loadGraph()]);
  const ctx: ExtractionContext = { glossary: opts.glossary, graph: previousGraph, previous: all.find(e => e.pageId === page.id), signal: opts.signal };
  const extraction = opts.extractor
    ? opts.extractor.parse((await opts.extractor.extract(page, ctx)).raw)
    : await (opts.extract ?? extractPage)(page, ctx);
  if (extraction.pageId !== page.id) throw new Error(`Extraction page ID does not match ${page.id}`);
  const graph = buildGraph([...all.filter(e => e.pageId !== page.id), extraction], previousGraph);
  await store.commit(page.id, extraction, graph);
  return graph;
}

export async function reviewProposal(store: KnowledgeStore, id: string, decision: ProposalDecision, knownProposal?: GraphProposal): Promise<KbGraph> {
  const [all, previous] = await Promise.all([store.listExtractions(), store.loadGraph()]);
  if (!previous.proposals?.some(p => p.id === id) && knownProposal?.id !== id) throw new Error(`Unknown proposal: ${id}`);
  const graph = buildGraph(all, { ...previous, proposalDecisions: { ...previous.proposalDecisions, [id]: decision } });
  await store.commit(null, null, graph);
  return graph;
}

export async function removePage(store: KnowledgeStore, pageId: string): Promise<KbGraph> {
  const all = (await store.listExtractions()).filter(e => e.pageId !== pageId);
  const graph = buildGraph(all, await store.loadGraph());
  await store.commit(pageId, null, graph);
  return graph;
}
