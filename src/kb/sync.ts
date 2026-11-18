import type { Page } from '../model/page';
import { extractPage } from './extract';
import { buildGraph } from './graph';
import type { KbGraph, PageExtraction, ProposalDecision } from './model';
import type { Extractor } from './extractor';
import { removePage, reviewProposal, syncPage, type KnowledgeStore } from './store';

export interface SyncTimers { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
export interface KbSyncOptions { debounceMs?: number; modelDebounceMs?: number; timers?: SyncTimers; onGraph?: (graph: KbGraph) => void; modelExtractor?: () => Extractor | undefined; busy?: () => boolean; onError?: (e: unknown) => void }
export class KbSyncer {
  private queue: { op: () => Promise<void>; priority: boolean; resolve: () => void; reject: (e: unknown) => void }[] = [];
  private writing = false;
  private extractions: Promise<unknown> = Promise.resolve();
  private graph: KbGraph | null = null;
  private snapshots: PageExtraction[] = [];
  private reviews = new Map<string, { decision: ProposalDecision }>();
  private pending = new Map<string, { handle: unknown; resolve: (() => void)[]; reject: ((e: unknown) => void)[] }>();
  private listeners = new Set<(graph: KbGraph) => void>();
  private models = new Map<string, { handle?: unknown; controller: AbortController }>();
  private generations = new Map<string, number>();
  private indexing = 0;
  private advance(id: string): number {
    const next = (this.generations.get(id) ?? 0) + 1; this.generations.set(id, next); return next;
  }
  private timers: SyncTimers;
  private store: KnowledgeStore;
  private glossary: () => string[];
  private options: KbSyncOptions;
  constructor(store: KnowledgeStore, glossary: () => string[], options: KbSyncOptions = {}) {
    this.store = store; this.glossary = glossary; this.options = options;
    this.timers = options.timers ?? { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: h => clearTimeout(h as ReturnType<typeof setTimeout>) };
    if (options.onGraph) this.listeners.add(options.onGraph);
  }
  subscribe(fn: (graph: KbGraph) => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private enqueue(op: () => Promise<void>, priority = false): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ op, priority, resolve, reject });
      if (!this.writing) { this.writing = true; void Promise.resolve().then(() => this.drain()); }
    });
  }
  private async drain(): Promise<void> {
    while (this.queue.length) {
      const priority = this.queue.findIndex(job => job.priority);
      const [job] = this.queue.splice(priority < 0 ? 0 : priority, 1);
      try { await job.op(); job.resolve(); } catch (e) { job.reject(e); }
    }
    this.writing = false;
  }
  private enqueueExtraction(op: () => Promise<void>): Promise<void> {
    const next = this.extractions.then(async () => { await this.enqueue(async () => {}); await op(); });
    this.extractions = next.catch(() => {});
    return next;
  }
  private emit(): void {
    if (!this.graph) return;
    const graph = this.reviews.size ? buildGraph(this.snapshots, { ...this.graph, proposalDecisions: {
      ...this.graph.proposalDecisions, ...Object.fromEntries([...this.reviews].map(([id, review]) => [id, review.decision])),
    } }) : this.graph;
    this.listeners.forEach(fn => fn(graph));
  }
  private async publish(graph: KbGraph): Promise<void> {
    this.snapshots = await this.store.listExtractions(); this.graph = graph;
    for (const [id, review] of this.reviews) if (graph.proposalDecisions?.[id] === review.decision) this.reviews.delete(id);
    this.emit();
  }
  load(): Promise<void> {
    return this.enqueue(async () => { await this.publish(await this.store.loadGraph()); });
  }
  private async extract(page: Page, extractor: Extractor, signal?: AbortSignal, valid = () => true): Promise<void> {
    const check = () => { signal?.throwIfAborted(); if (!valid()) throw new DOMException('Superseded', 'AbortError'); };
    check();
    const [all, graph] = await Promise.all([this.store.listExtractions(), this.store.loadGraph()]);
    const extraction = extractor.parse((await extractor.extract(page, { glossary: this.glossary(), graph, previous: all.find(e => e.pageId === page.id), signal })).raw);
    check();
    await this.enqueue(async () => {
      check();
      await this.publish(await syncPage(this.store, page, { glossary: this.glossary(), extract: () => extraction }));
    });
  }
  private async sync(page: Page): Promise<void> {
    const extraction = extractPage(page, { glossary: this.glossary() });
    const all = await this.store.listExtractions();
    const previous = all.find(e => e.pageId === page.id);
    if (previous) {
      const base: PageExtraction = { pageId: previous.pageId, extractor: 'deterministic', terms: previous.terms, relations: previous.relations, texts: previous.texts };
      if (JSON.stringify(base) === JSON.stringify(extraction)) { if (!this.graph) await this.publish(await this.store.loadGraph()); return; }
    }
    await this.publish(await syncPage(this.store, page, { glossary: this.glossary(), extract: (p, ctx) => {
      const fresh = extractPage(p, ctx), model = ctx.previous?.model;
      if (!model) return fresh;
      const unchanged = new Set(p.blocks.filter(b => model.blocks.some(old => old.id === b.id && old.key === JSON.stringify([b.kind, b.text]))).map(b => b.id));
      return { ...fresh, extractor: 'deterministic+model', model: { ...model, blocks: model.blocks.filter(b => unchanged.has(b.id)), suggestions: model.suggestions.filter(s => unchanged.has(s.kind === 'edge' ? s.relation.prov.blockId : s.prov.blockId)) } };
    } }));
  }
  abortModel(id?: string): void {
    for (const [key, work] of this.models) if (!id || id === key) {
      work.controller.abort(); if (work.handle !== undefined) this.timers.clearTimeout(work.handle); this.models.delete(key);
    }
  }
  private scheduleModel(page: Page, generation: number): void {
    if (this.generations.get(page.id) !== generation) return;
    this.abortModel(page.id);
    if (!this.options.modelExtractor?.()) return;
    const work = { controller: new AbortController(), handle: undefined as unknown };
    const run = () => {
      if (work.controller.signal.aborted || this.generations.get(page.id) !== generation) return;
      if (this.options.busy?.()) { work.handle = this.timers.setTimeout(run, this.options.modelDebounceMs ?? 5000); return; }
      void this.enqueueExtraction(async () => {
        const extractor = this.options.modelExtractor?.();
        if (!extractor || work.controller.signal.aborted || this.generations.get(page.id) !== generation) return;
        if (this.options.busy?.()) { work.handle = this.timers.setTimeout(run, this.options.modelDebounceMs ?? 5000); return; }
        await this.extract(page, extractor, work.controller.signal, () => this.generations.get(page.id) === generation);
      }).catch(e => { if (!work.controller.signal.aborted) this.options.onError?.(e); });
    };
    work.handle = this.timers.setTimeout(run, this.options.modelDebounceMs ?? 5000);
    this.models.set(page.id, work);
  }
  review(id: string, decision: ProposalDecision): Promise<void> {
    const proposal = this.graph?.proposals?.find(p => p.id === id);
    const review = { decision }; this.reviews.set(id, review); this.emit();
    return this.enqueue(async () => {
      try { await this.publish(await reviewProposal(this.store, id, decision, proposal)); }
      catch (e) { if (this.reviews.get(id) === review) this.reviews.delete(id); this.emit(); throw e; }
    }, true);
  }
  extractWith(page: Page, extractor: Extractor): Promise<void> {
    const snapshot = structuredClone(page), generation = this.generations.get(page.id) ?? this.advance(page.id);
    return this.enqueueExtraction(() => this.extract(snapshot, extractor, undefined, () => this.generations.get(page.id) === generation));
  }
  pageChanged(page: Page): Promise<void> {
    const generation = this.advance(page.id);
    this.abortModel(page.id);
    const snapshot = structuredClone(page), prev = this.pending.get(page.id);
    if (prev) this.timers.clearTimeout(prev.handle);
    return new Promise((resolve, reject) => {
      const entry = { handle: undefined as unknown, resolve: [...(prev?.resolve ?? []), resolve], reject: [...(prev?.reject ?? []), reject] };
      entry.handle = this.timers.setTimeout(() => {
        this.pending.delete(page.id);
        void this.enqueue(() => this.sync(snapshot)).then(() => { this.scheduleModel(snapshot, generation); entry.resolve.forEach(fn => fn()); }, e => entry.reject.forEach(fn => fn(e)));
      }, this.options.debounceMs ?? 800);
      this.pending.set(page.id, entry);
    });
  }
  private cancel(id: string): void {
    const p = this.pending.get(id);
    if (p) { this.timers.clearTimeout(p.handle); this.pending.delete(id); p.resolve.forEach(fn => fn()); }
  }
  pageDeleted(id: string): Promise<void> {
    this.advance(id);
    this.abortModel(id);
    this.cancel(id);
    return this.enqueue(async () => { await this.publish(await removePage(this.store, id)); });
  }
  async indexAll(pages: Page[]): Promise<void> {
    const indexing = ++this.indexing;
    const snapshots = structuredClone(pages);
    const generations = new Map(snapshots.map(p => [p.id, this.advance(p.id)]));
    const ids = new Set(snapshots.map(p => p.id));
    const excluded = new Map<string, number>();
    for (const id of new Set([...this.generations.keys(), ...this.pending.keys(), ...this.models.keys()])) if (!ids.has(id)) {
      excluded.set(id, this.advance(id)); this.abortModel(id); this.cancel(id);
    }
    [...this.pending.keys()].forEach(id => this.cancel(id));
    let previous: PageExtraction[] = [];
    await this.enqueue(async () => { if (this.indexing === indexing) previous = await this.store.listExtractions(); });
    if (this.indexing !== indexing) return;
    for (const e of previous) if (!ids.has(e.pageId)) {
      if (!excluded.has(e.pageId) && this.generations.has(e.pageId)) continue;
      const generation = excluded.get(e.pageId) ?? this.advance(e.pageId);
      await this.enqueue(async () => { if (this.indexing === indexing && this.generations.get(e.pageId) === generation) await this.publish(await removePage(this.store, e.pageId)); });
    }
    for (const p of snapshots) {
      await this.enqueue(async () => {
        const generation = generations.get(p.id)!;
        if (this.indexing !== indexing || this.generations.get(p.id) !== generation) return;
        await this.sync(p); this.scheduleModel(p, generation);
      });
    }
  }
}
