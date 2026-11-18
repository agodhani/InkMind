import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../store/db';
import { IndexedDbKnowledgeStore } from '../store/kbDb';
import type { Page } from '../model/page';
import { mockKbModel, modelExtractor } from './modelExtractor';
import { removePage, reviewProposal, syncPage } from './store';

const page: Page = { id: 'p', title: 'Kept', strokes: [], createdAt: 0, updatedAt: 0, blocks: [{ id: 'b', kind: 'heading', text: 'Policy', bbox: { left: 0, top: 0, right: 100, bottom: 30 }, strokeIds: [], confidence: 1 }] };

describe('IndexedDB knowledge store', () => {
  beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
  afterEach(() => vi.unstubAllGlobals());
  it('upgrades v1 to v2 without losing pages, corrections or kv', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('inkmind', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('pages', { keyPath: 'id' }).put(page);
        req.result.createObjectStore('corrections', { keyPath: 'id' }).put({ id: 'correction' });
        req.result.createObjectStore('kv').put('kept', 'key');
      };
      req.onsuccess = () => { req.result.close(); resolve(); };
      req.onerror = () => reject(req.error);
    });
    const store = new IndexedDbKnowledgeStore();
    const graph = await syncPage(store, page, { glossary: [] });
    expect(await db.getPage('p')).toEqual(page);
    expect(await db.listCorrections()).toEqual([{ id: 'correction' }]);
    expect(await db.getKv('key')).toBe('kept');
    expect(await store.loadGraph()).toEqual(graph);
    expect(await syncPage(store, page, { glossary: [] })).toEqual(graph);
    expect(await store.listExtractions()).toHaveLength(1);
    expect(await removePage(store, 'p')).toEqual({ concepts: [], edges: [] });
    expect(await store.loadGraph()).toEqual({ concepts: [], edges: [] });
    expect(await db.getPage('p')).toEqual(page);
    await syncPage(store, page, { glossary: [] });
    await store.clear();
    expect(await store.listExtractions()).toEqual([]);
    expect(await store.loadGraph()).toEqual({ concepts: [], edges: [] });
  });
  it('rolls back extraction and graph together if a write fails', async () => {
    const store = new IndexedDbKnowledgeStore();
    const graph = await syncPage(store, page, { glossary: [] });
    await expect(store.commit('p', null, { concepts: [{ ...graph.concepts[0], id: undefined! }], edges: [] })).rejects.toThrow();
    expect(await store.loadGraph()).toEqual(graph);
    expect(await store.listExtractions()).toHaveLength(1);
  });
  it('persists rejection across reopen, delete, and re-extraction without deleting deterministic facts', async () => {
    const extractor = modelExtractor(mockKbModel(async () => JSON.stringify({ concepts: [
      { block: 'a', term: 'Backprop', canonical: 'Backpropagation' }, { block: 'a', term: 'KL penalty' },
    ] })));
    const notes = { ...page, blocks: [{ ...page.blocks[0], text: 'Backpropagation' },
      { ...page.blocks[0], id: 'a', kind: 'paragraph' as const, text: 'Backprop and KL penalty' }] };
    const store = new IndexedDbKnowledgeStore();
    const graph = await syncPage(store, notes, { glossary: [], extractor });
    const alias = graph.proposals!.find(p => p.kind === 'alias')!;
    const term = graph.proposals!.find(p => p.label === 'KL penalty')!;
    await reviewProposal(store, alias.id, 'rejected');
    const rejected = await reviewProposal(store, term.id, 'rejected');
    const reopened = new IndexedDbKnowledgeStore();
    expect(await reopened.loadGraph()).toEqual(rejected);
    await removePage(reopened, notes.id);
    expect((await syncPage(reopened, notes, { glossary: [], extractor })).concepts).toEqual(rejected.concepts);
    expect(await reopened.loadGraph()).toMatchObject({ proposalDecisions: { [alias.id]: 'rejected', [term.id]: 'rejected' } });
    expect((await reopened.loadGraph()).proposals).toBeUndefined();
    expect(rejected.concepts).toEqual([expect.objectContaining({ label: 'Backpropagation', aliases: [] })]);
    await reopened.clear();
    expect(await reopened.loadGraph()).toEqual({ concepts: [], edges: [] });
  });

  it('links a later short form to an accepted model concept only while its evidence survives', async () => {
    const store = new IndexedDbKnowledgeStore();
    const long = { ...page, blocks: [{ ...page.blocks[0], kind: 'paragraph' as const, text: 'Backpropagation computes gradients.' }] };
    const short = { ...long, id: 'later', blocks: [{ ...long.blocks[0], text: 'Backprop computes gradients.' }] };
    const extractor = modelExtractor(mockKbModel(async (_system, user) => {
      const { blocks, known } = JSON.parse(user);
      if (blocks[0].text === long.blocks[0].text) return JSON.stringify({ concepts: [{ block: 'b', term: 'Backpropagation' }] });
      expect(known).toContainEqual(['Backpropagation']);
      return JSON.stringify({ concepts: [{ block: 'b', term: 'Backprop', canonical: 'Backpropagation' }] });
    }));
    const pending = await syncPage(store, long, { glossary: [], extractor });
    const proposal = pending.proposals![0];
    await reviewProposal(store, proposal.id, 'accepted');

    const reopened = new IndexedDbKnowledgeStore();
    const linked = await syncPage(reopened, short, { glossary: [], extractor });
    expect(linked.concepts).toEqual([expect.objectContaining({
      id: proposal.conceptId, label: 'Backpropagation', aliases: ['Backprop'], origin: 'model', status: 'accepted',
      provenance: [expect.objectContaining({ pageId: 'later' }), expect.objectContaining({ pageId: 'p' })],
    })]);
    expect(linked.proposals).toContainEqual(expect.objectContaining({ kind: 'alias', status: 'proposed', conceptId: proposal.conceptId }));

    const headings = { ...page, id: 'headings', blocks: [
      { ...page.blocks[0], text: 'Backpropagation' }, { ...page.blocks[0], id: 'short', text: 'Backprop' },
    ] };
    const separate = await syncPage(reopened, headings, { glossary: [] });
    expect(separate.concepts.map(c => [c.label, c.aliases])).toEqual([['Backprop', []], ['Backpropagation', []]]);
    await removePage(reopened, headings.id);

    const removed = await removePage(reopened, long.id);
    expect(removed.proposalDecisions?.[proposal.id]).toBe('accepted');
    expect(removed.concepts).toEqual([expect.objectContaining({
      label: 'Backprop', status: 'proposed', aliases: [], provenance: [expect.objectContaining({ pageId: 'later' })],
    })]);
  });
});
