import { afterEach, expect, it, vi } from 'vitest';
import type { Page } from '../model/page';
import type { KbGraph } from './model';
import { modelExtractor, mockKbModel } from './modelExtractor';
import { MemoryKnowledgeStore } from './store';
import { KbSyncer } from './sync';

const page: Page = { id: 'p', title: 'Test', createdAt: 0, updatedAt: 0, strokes: [], blocks: [{ id: 'b', kind: 'paragraph', text: 'Spaced retrieval improves learning.', strokeIds: [], confidence: 1, bbox: { left: 0, top: 0, right: 500, bottom: 30 } }] };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
const response = JSON.stringify({ concepts: [{ block: 'b', term: 'Spaced retrieval' }], edges: [] });
const extractor = modelExtractor(mockKbModel(async () => response));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it.each(['accepted', 'rejected'] as const)('reviews %s immediately ahead of queued models and survives late and later extraction', async decision => {
  vi.useFakeTimers();
  const store = new MemoryKnowledgeStore(), graphs: KbGraph[] = [];
  const syncer = new KbSyncer(store, () => [], { onGraph: graph => graphs.push(graph) });
  await syncer.extractWith(page, extractor);
  const id = graphs.at(-1)!.proposals![0].id;
  const started = deferred(), gate = deferred(), order: string[] = [];
  const slow = modelExtractor(mockKbModel(async () => { order.push('in flight'); started.resolve(); await gate.promise; return response; }));
  const changed = { ...page, blocks: [{ ...page.blocks[0], text: `${page.blocks[0].text} More context.` }] };
  const running = syncer.extractWith(changed, slow);
  await started.promise;
  const queued = [1, 2, 3].map(i => syncer.extractWith({ ...page, id: `queued-${i}` }, modelExtractor(mockKbModel(async () => { order.push(`queued-${i}`); return response; }))));
  const review = syncer.review(id, decision).then(() => order.push('reviewed'));
  const check = (graph: KbGraph) => {
    expect(graph.proposalDecisions?.[id]).toBe(decision);
    if (decision === 'rejected') expect(graph.concepts).toEqual([]);
    else expect(graph.concepts[0].status).toBe('accepted');
  };
  check(graphs.at(-1)!);
  await vi.advanceTimersByTimeAsync(0);
  expect(order).toEqual(['in flight', 'reviewed']);
  check(await store.loadGraph());
  const emitted = graphs.length;
  gate.resolve(); await running; await review; await Promise.all(queued);
  for (const graph of graphs.slice(emitted)) check(graph);
  await syncer.extractWith(page, extractor);
  check(await store.loadGraph());
});

it.each(['accepted', 'rejected'] as const)('keeps optimistic %s through an in-flight commit and rolls it back on review failure', async decision => {
  vi.useFakeTimers();
  const store = new MemoryKnowledgeStore(), graphs: KbGraph[] = [];
  const syncer = new KbSyncer(store, () => [], { onGraph: graph => graphs.push(graph) });
  await syncer.extractWith(page, extractor);
  const id = graphs.at(-1)!.proposals![0].id;
  const commit = store.commit.bind(store), entered = deferred(), gate = deferred();
  store.commit = async (pageId, extraction, graph) => {
    if (pageId) { entered.resolve(); await gate.promise; }
    else throw new Error('Review write failed');
    await commit(pageId, extraction, graph);
  };
  const running = syncer.extractWith(page, extractor); await entered.promise;
  const review = syncer.review(id, decision);
  const failed = expect(review).rejects.toThrow('Review write failed');
  expect(graphs.at(-1)!.proposalDecisions?.[id]).toBe(decision);
  const optimistic = graphs.length;
  gate.resolve(); await running; await failed;
  expect(graphs.slice(optimistic, -1).length).toBeGreaterThan(0);
  expect(graphs.slice(optimistic, -1).every(g => g.proposalDecisions?.[id] === decision)).toBe(true);
  expect(graphs.at(-1)!.proposals?.find(p => p.id === id)?.status).toBe('proposed');
  expect((await store.loadGraph()).proposalDecisions?.[id]).toBeUndefined();
  store.commit = commit;
  await syncer.review(id, 'accepted');
  expect(graphs.at(-1)!.concepts[0].status).toBe('accepted');
});

it('persists a review before deterministic commits already queued behind the current commit', async () => {
  vi.useFakeTimers();
  const store = new MemoryKnowledgeStore(), syncer = new KbSyncer(store, () => [], { debounceMs: 0 });
  await syncer.extractWith(page, extractor);
  const id = (await store.loadGraph()).proposals![0].id;
  const commit = store.commit.bind(store), entered = deferred(), gate = deferred(), order: (string | null)[] = [];
  store.commit = async (pageId, extraction, graph) => {
    order.push(pageId);
    if (pageId === page.id) { entered.resolve(); await gate.promise; }
    await commit(pageId, extraction, graph);
  };
  const running = syncer.extractWith(page, extractor); await entered.promise;
  const queued = ['q1', 'q2'].map(id => syncer.pageChanged({ ...page, id }));
  const queuedModel = syncer.extractWith({ ...page, id: 'q3' }, modelExtractor(mockKbModel(async () => { order.push('model-start'); return response; })));
  await vi.advanceTimersByTimeAsync(0);
  const review = syncer.review(id, 'accepted');
  gate.resolve(); await running; await review; await Promise.all(queued); await queuedModel;
  expect(order.slice(0, 2)).toEqual(['p', null]);
  expect(order.indexOf('model-start')).toBeGreaterThan(order.indexOf(null));
  expect((await store.loadGraph()).proposals?.find(p => p.id === id)?.status).toBe('accepted');
});

it('persists a known review even when the current commit temporarily removes its proposal', async () => {
  const store = new MemoryKnowledgeStore(), syncer = new KbSyncer(store, () => []);
  await syncer.extractWith(page, extractor);
  const id = (await store.loadGraph()).proposals![0].id;
  const commit = store.commit.bind(store), entered = deferred(), gate = deferred();
  store.commit = async (...args) => { if (args[0]) { entered.resolve(); await gate.promise; } await commit(...args); };
  const empty = { ...page, blocks: [] };
  const running = syncer.extractWith(empty, extractor); await entered.promise;
  const review = syncer.review(id, 'rejected');
  gate.resolve(); await running; await review;
  expect((await store.loadGraph()).proposalDecisions?.[id]).toBe('rejected');
  await syncer.extractWith(page, extractor);
  expect((await store.loadGraph()).concepts).toEqual([]);
});
