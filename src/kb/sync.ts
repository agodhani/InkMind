import type { Page } from '../model/page';
import { extractPage } from './extract';
import { buildGraph } from './graph';
import type { KbGraph } from './model';
import { removePage, type KnowledgeStore } from './store';

export interface SyncTimers { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
export interface KbSyncOptions { debounceMs?: number; timers?: SyncTimers; onGraph?: (graph: KbGraph) => void }
export class KbSyncer {
  private queue: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, { handle: unknown; resolve: (() => void)[]; reject: ((e: unknown) => void)[] }>();
  private listeners = new Set<(graph: KbGraph) => void>();
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
    if (JSON.stringify(all.find(e => e.pageId === page.id)) === JSON.stringify(extraction)) return;
    const graph = buildGraph([...all.filter(e => e.pageId !== page.id), extraction], await this.store.loadGraph());
    await this.store.commit(page.id, extraction, graph);
    this.emit(graph);
  }
  pageChanged(page: Page): Promise<void> {
    const snapshot = structuredClone(page), prev = this.pending.get(page.id);
    if (prev) this.timers.clearTimeout(prev.handle);
    return new Promise((resolve, reject) => {
      const entry = { handle: undefined as unknown, resolve: [...(prev?.resolve ?? []), resolve], reject: [...(prev?.reject ?? []), reject] };
      entry.handle = this.timers.setTimeout(() => {
        this.pending.delete(page.id);
        void this.enqueue(() => this.sync(snapshot)).then(() => entry.resolve.forEach(fn => fn()), e => entry.reject.forEach(fn => fn(e)));
      }, this.options.debounceMs ?? 800);
      this.pending.set(page.id, entry);
    });
  }
  private cancel(id: string): void {
    const p = this.pending.get(id);
    if (p) { this.timers.clearTimeout(p.handle); this.pending.delete(id); p.resolve.forEach(fn => fn()); }
  }
  pageDeleted(id: string): Promise<void> {
    this.cancel(id);
    return this.enqueue(async () => { this.emit(await removePage(this.store, id)); });
  }
  indexAll(pages: Page[]): Promise<void> {
    const snapshots = structuredClone(pages);
    [...this.pending.keys()].forEach(id => this.cancel(id));
    return this.enqueue(async () => {
      const ids = new Set(snapshots.map(p => p.id));
      for (const e of await this.store.listExtractions()) if (!ids.has(e.pageId)) { this.cancel(e.pageId); this.emit(await removePage(this.store, e.pageId)); }
      for (const p of snapshots) await this.sync(p);
    });
  }
}
