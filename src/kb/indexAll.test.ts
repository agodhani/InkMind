import { afterEach, expect, it, vi } from 'vitest';
import type { Page } from '../model/page';
import { deterministicExtractor } from './extractor';
import type { KbGraph } from './model';
import { MemoryKnowledgeStore } from './store';
import { KbSyncer } from './sync';

const page: Page = { id: 'p', title: 'Test', createdAt: 0, updatedAt: 0, strokes: [], blocks: [
  { id: 'b', kind: 'heading', text: 'Policy', strokeIds: [], confidence: 1, bbox: { left: 0, top: 0, right: 500, bottom: 30 } },
] };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it.each([false, true])('cleans up a first in-flight commit with model extraction enabled: %s', async model => {
  vi.useFakeTimers();
  const store = new MemoryKnowledgeStore(), commit = store.commit.bind(store);
  const entered = deferred(), gate = deferred(), graphs: KbGraph[] = [];
  let first = true;
  store.commit = async (...args) => {
    if (first) { first = false; entered.resolve(); await gate.promise; }
    await commit(...args);
  };
  const extract = vi.fn(deterministicExtractor.extract);
  const syncer = new KbSyncer(store, () => [], {
    debounceMs: 0, modelDebounceMs: 10, onGraph: graph => graphs.push(graph),
    modelExtractor: model ? () => ({ ...deterministicExtractor, extract }) : undefined,
  });
  const changed = syncer.pageChanged(page);
  await vi.advanceTimersByTimeAsync(0); await entered.promise;
  expect(await store.listExtractions()).toEqual([]);
  const indexing = syncer.indexAll([]);
  await vi.advanceTimersByTimeAsync(0);
  gate.resolve(); await changed; await indexing;
  await vi.advanceTimersByTimeAsync(10);
  expect(await store.listExtractions()).toEqual([]);
  expect(await store.loadGraph()).toEqual({ concepts: [], edges: [] });
  expect(graphs.at(-1)).toEqual({ concepts: [], edges: [] });
  expect(extract).not.toHaveBeenCalled();
});

it('invalidates an excluded first model request outside the write queue even if it ignores cancellation', async () => {
  const store = new MemoryKnowledgeStore(), entered = deferred(), gate = deferred();
  const syncer = new KbSyncer(store, () => []);
  const running = syncer.extractWith(page, { ...deterministicExtractor, extract: async (...args) => {
    entered.resolve(); await gate.promise;
    return deterministicExtractor.extract(...args);
  } });
  const rejected = expect(running).rejects.toMatchObject({ name: 'AbortError' });
  await entered.promise;
  await syncer.indexAll([]);
  gate.resolve(); await rejected;
  expect(await store.listExtractions()).toEqual([]);
  expect(await store.loadGraph()).toEqual({ concepts: [], edges: [] });
});

it('cancels excluded debounced pages before they have any stored extraction', async () => {
  vi.useFakeTimers();
  const store = new MemoryKnowledgeStore(), syncer = new KbSyncer(store, () => [], { debounceMs: 10 });
  const changed = syncer.pageChanged(page);
  await syncer.indexAll([]); await changed;
  await vi.advanceTimersByTimeAsync(10);
  expect(await store.listExtractions()).toEqual([]);
  expect(await store.loadGraph()).toEqual({ concepts: [], edges: [] });
});
