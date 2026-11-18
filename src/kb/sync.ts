import type { Page } from '../model/page';
import { extractPage } from './extract';
import type { KbGraph, PageExtraction, ProposalDecision } from './model';
import type { Extractor } from './extractor';
import { removePage, reviewProposal, syncPage, type KnowledgeStore } from './store';

export interface SyncTimers { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
export interface KbSyncOptions { debounceMs?: number; modelDebounceMs?: number; timers?: SyncTimers; onGraph?: (graph: KbGraph) => void; modelExtractor?: () => Extractor | undefined; busy?: () => boolean; onError?: (e: unknown) => void }
export class KbSyncer {
  private queue: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, { handle: unknown; resolve: (() => void)[]; reject: ((e: unknown) => void)[] }>();
  private listeners = new Set<(graph: KbGraph) => void>();
  private models = new Map<string, { handle?: unknown; controller: AbortController }>();
  private generations = new Map<string, number>();
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
  private enqueue(op: () => Promise<void>): Promise<void> {
    const next = this.queue.then(op);
    this.queue = next.catch(() => {});
    return next;
  }
  private emit(graph: KbGraph): void { this.listeners.forEach(fn => fn(graph)); }
  private async sync(page: Page): Promise<void> {
    const extraction = extractPage(page, { glossary: this.glossary() });
    const all = await this.store.listExtractions();
    const previous = all.find(e => e.pageId === page.id);
    if (previous) {
      const base: PageExtraction = { pageId: previous.pageId, extractor: 'deterministic', terms: previous.terms, relations: previous.relations, texts: previous.texts };
      if (JSON.stringify(base) === JSON.stringify(extraction)) return;
    }
    this.emit(await syncPage(this.store, page, { glossary: this.glossary(), extract: (p, ctx) => {
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
      void this.enqueue(async () => {
        const extractor = this.options.modelExtractor?.();
        if (!extractor || work.controller.signal.aborted || this.generations.get(page.id) !== generation) return;
        if (this.options.busy?.()) { work.handle = this.timers.setTimeout(run, this.options.modelDebounceMs ?? 5000); return; }
        const guarded: Extractor = { ...extractor, extract: async (p, ctx) => {
          const result = await extractor.extract(p, ctx); ctx.signal?.throwIfAborted();
          if (this.generations.get(page.id) !== generation) throw new DOMException('Superseded', 'AbortError');
          return result;
        } };
        this.emit(await syncPage(this.store, page, { glossary: this.glossary(), extractor: guarded, signal: work.controller.signal }));
      }).catch(e => { if (!work.controller.signal.aborted) this.options.onError?.(e); });
    };
    work.handle = this.timers.setTimeout(run, this.options.modelDebounceMs ?? 5000);
    this.models.set(page.id, work);
  }
  review(id: string, decision: ProposalDecision): Promise<void> {
    return this.enqueue(async () => { this.emit(await reviewProposal(this.store, id, decision)); });
  }
  extractWith(page: Page, extractor: Extractor): Promise<void> {
    return this.enqueue(async () => { this.emit(await syncPage(this.store, page, { glossary: this.glossary(), extractor })); });
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
    return this.enqueue(async () => { this.emit(await removePage(this.store, id)); });
  }
  indexAll(pages: Page[]): Promise<void> {
    const snapshots = structuredClone(pages);
    const generations = new Map(snapshots.map(p => [p.id, this.advance(p.id)]));
    [...this.pending.keys()].forEach(id => this.cancel(id));
    return this.enqueue(async () => {
      const ids = new Set(snapshots.map(p => p.id));
      for (const e of await this.store.listExtractions()) if (!ids.has(e.pageId)) { this.abortModel(e.pageId); this.cancel(e.pageId); this.emit(await removePage(this.store, e.pageId)); }
      for (const p of snapshots) {
        const generation = generations.get(p.id)!;
        if (this.generations.get(p.id) !== generation) continue;
        await this.sync(p); this.scheduleModel(p, generation);
      }
    });
  }
}
