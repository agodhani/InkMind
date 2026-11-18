import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../store/db';
import { IndexedDbKnowledgeStore } from '../store/kbDb';
import type { Page } from '../model/page';
import { removePage, syncPage } from './store';

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
});
