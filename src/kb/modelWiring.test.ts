import { afterEach, expect, it, vi } from 'vitest';
import type { Page } from '../model/page';
import { DEFAULT_SETTINGS } from '../settings';
import { configuredKbExtractor } from './modelSettings';
import { deterministicExtractor, type Extractor } from './extractor';
import { mockKbModel, modelExtractor } from './modelExtractor';
import * as models from './modelExtractor';
import { MemoryKnowledgeStore } from './store';
import { KbSyncer } from './sync';

const page: Page = { id: 'p', title: 'Test', createdAt: 0, updatedAt: 0, strokes: [], blocks: [{ id: 'b', kind: 'paragraph', text: '[[Alpha]] [[Beta]] Alpha supports Beta. Spaced retrieval improves learning.', strokeIds: [], confidence: 1, bbox: { left: 0, top: 0, right: 500, bottom: 30 } }] };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('does not schedule model work from a deterministic commit resumed after deletion', async () => {
  vi.useFakeTimers();
  const store = new MemoryKnowledgeStore(), commit = store.commit.bind(store);
  let resume!: () => void, started!: () => void;
  const gate = new Promise<void>(r => { resume = r; }), entered = new Promise<void>(r => { started = r; });
  let pause = true;
  store.commit = async (...args) => { if (pause) { pause = false; started(); await gate; } await commit(...args); };
  const syncer = new KbSyncer(store, () => [], { debounceMs: 0, modelDebounceMs: 5000, modelExtractor: () => deterministicExtractor });
  const changed = syncer.pageChanged(page);
  await vi.advanceTimersByTimeAsync(0); await entered;
  const deleted = syncer.pageDeleted(page.id);
  resume(); await changed; await deleted;
  await vi.advanceTimersByTimeAsync(5000);
  expect(await store.listExtractions()).toEqual([]);
  syncer.abortModel();
});

it('defaults off, disables Mock, and chooses only local or free model providers', () => {
  expect(configuredKbExtractor(DEFAULT_SETTINGS)).toBeUndefined();
  expect(configuredKbExtractor({ ...DEFAULT_SETTINGS, modelConceptExtraction: true })).toBeUndefined();
  const local = vi.spyOn(models, 'ollamaKbModel');
  const free = vi.spyOn(models, 'openRouterKbModel');
  expect(configuredKbExtractor({ ...DEFAULT_SETTINGS, modelConceptExtraction: true, provider: 'ollama' })).toBeDefined();
  expect(local).toHaveBeenCalledWith({ url: DEFAULT_SETTINGS.ollamaUrl });
  expect(configuredKbExtractor({ ...DEFAULT_SETTINGS, modelConceptExtraction: true, provider: 'openrouter', openRouterApiKey: 'test-only', visionModel: 'paid-model' })).toBeDefined();
  expect(free).toHaveBeenCalledWith('test-only');
  expect(() => configuredKbExtractor({ ...DEFAULT_SETTINGS, modelConceptExtraction: true, provider: 'openrouter' })).toThrow('required');
});

it('serializes real reviews with full-context extraction and preserves rejections on re-extraction', async () => {
  const store = new MemoryKnowledgeStore(), syncer = new KbSyncer(store, () => []);
  await syncer.indexAll([page]);
  const delegate = modelExtractor(mockKbModel(async () => JSON.stringify({ concepts: [{ block: 'b', term: 'Spaced retrieval' }], edges: [{ block: 'b', from: 'Alpha', to: 'Beta', kind: 'supports', quote: 'Alpha supports Beta.' }] })));
  const extract = vi.fn(delegate.extract), extractor = { ...delegate, extract };
  await syncer.extractWith(page, extractor);
  expect(extract.mock.calls[0][1].previous?.pageId).toBe('p');
  expect(extract.mock.calls[0][1].graph?.concepts).toHaveLength(2);
  const proposals = (await store.loadGraph()).proposals!;
  expect(proposals.length).toBeGreaterThan(1);
  const concept = proposals.find(p => p.kind === 'concept')!;
  await Promise.all([syncer.extractWith(page, extractor), syncer.review(concept.id, 'rejected')]);
  const edge = (await store.loadGraph()).proposals!.find(p => p.kind === 'edge' && p.label.includes('supports'))!;
  await syncer.review(edge.id, 'accepted');
  await syncer.indexAll([{ ...page, blocks: [...page.blocks, { ...page.blocks[0], id: 'new', text: 'An unrelated edit.' }] }]);
  expect((await store.loadGraph()).proposals?.find(p => p.id === edge.id)?.status).toBe('accepted');
  await syncer.extractWith(page, extractor);
  const graph = await store.loadGraph();
  expect(graph.proposalDecisions?.[concept.id]).toBe('rejected');
  expect(graph.proposals?.some(p => p.id === concept.id)).toBe(false);
  await expect(syncer.review('missing', 'accepted')).rejects.toThrow('Unknown proposal');
  await syncer.indexAll([]);
  expect((await store.loadGraph()).concepts).toEqual([]);
});

it('waits for idle, defers during transcription, aborts on edits and reports model errors', async () => {
  vi.useFakeTimers();
  const store = new MemoryKnowledgeStore(), onError = vi.fn();
  let busy = true, signal: AbortSignal | undefined;
  const extract = vi.fn(async (p: Page, ctx: Parameters<Extractor['extract']>[1]) => {
    signal = ctx.signal;
    await new Promise<void>((_, reject) => ctx.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    return deterministicExtractor.extract(p, ctx);
  });
  let extractor: Extractor = { ...deterministicExtractor, extract };
  const syncer = new KbSyncer(store, () => [], { modelExtractor: () => extractor, busy: () => busy, onError, debounceMs: 10, modelDebounceMs: 5000 });
  await syncer.indexAll([page]);
  await vi.advanceTimersByTimeAsync(5000); expect(extract).not.toHaveBeenCalled();
  busy = false;
  await vi.advanceTimersByTimeAsync(5000); expect(extract).toHaveBeenCalledTimes(1);
  const pending = syncer.pageChanged({ ...page, updatedAt: 1 });
  expect(signal?.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(10); await pending;
  expect(onError).not.toHaveBeenCalled();
  extractor = { ...deterministicExtractor, extract: async () => { throw new Error('Model unavailable'); } };
  await vi.advanceTimersByTimeAsync(5000);
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Model unavailable' }));
  await syncer.pageDeleted(page.id); syncer.abortModel();
});
