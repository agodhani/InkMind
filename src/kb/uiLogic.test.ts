import { describe, expect, it, vi } from 'vitest';
import type { Page } from '../model/page';
import { MemoryDecisionsStore, IndexedDbDecisionsStore } from '../store/kbDecisionsDb';
import { IDBFactory } from 'fake-indexeddb';
import { applyDecisions, deleteConcept, emptyDecisions, mergeConcept, rejectSuggestion, renameConcept } from './decisions';
import { MemoryKnowledgeStore, syncPage } from './store';
import { acceptSuggestion, suggestLinks } from './suggest';
import { KbSyncer } from './sync';
import { demoGraph, filterGraph, groupLinks, layoutGraph, neighbourhood } from './mapView';
import { fitCamera } from '../views/mapGestures';

const page = (id = 'p', text = '[[Alpha]] [[Beta]] [[Gamma]]'): Page => ({ id, title: id, strokes: [], createdAt: 0, updatedAt: 0, blocks: [{ id: 'b', kind: 'paragraph', text, bbox: { left: 0, top: 0, right: 600, bottom: 30 }, confidence: 1, strokeIds: [] }] });
describe('KB decisions', () => {
  it('survives edited page re-extraction and preserves raw graphs', async () => {
    const store = new MemoryKnowledgeStore(), p = page();
    let graph = await syncPage(store, p, { glossary: [] });
    let d = renameConcept(emptyDecisions(), 'Alpha', 'First');
    d = renameConcept(d, 'First', 'Primary');
    d = mergeConcept(d, 'Beta', 'Primary'); d = deleteConcept(d, 'Gamma');
    graph = await syncPage(store, page('p', `${p.blocks[0].text} edited`), { glossary: [] });
    const view = applyDecisions(graph, d);
    expect(view.concepts.map(c => c.label)).toEqual(['Primary']);
    expect(view.concepts[0].aliases).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
    expect(graph.concepts).toHaveLength(3);
    expect(deleteConcept(d, 'Primary').renames).toEqual([]);
    expect(applyDecisions({ concepts: [], edges: [] }, d)).toEqual({ concepts: [], edges: [] });
  });
  it('rewires and deduplicates edges and supports merge chains', () => {
    const g = demoGraph(4);
    g.edges.push({ ...g.edges[0], id: 'other', from: 'demo-2', labels: ['other'] });
    let d = mergeConcept(emptyDecisions(), g.concepts[1].label, g.concepts[2].label);
    d = mergeConcept(d, g.concepts[0].label, g.concepts[1].label);
    const view = applyDecisions(g, d);
    expect(view.concepts).toHaveLength(2);
    expect(view.edges.every(e => e.from !== e.to)).toBe(true);
    expect(new Set(view.edges.map(e => e.id)).size).toBe(view.edges.length);
  });
  it('persists isolated copies in both stores', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    try {
      for (const store of [new MemoryDecisionsStore(), new IndexedDbDecisionsStore()]) {
        expect(await store.load()).toEqual(emptyDecisions());
        const d = renameConcept(emptyDecisions(), 'Alpha', 'New'); await store.save(d);
        d.deletes.push('alpha'); expect((await store.load()).deletes).toEqual([]);
      }
    } finally { vi.unstubAllGlobals(); }
  });
});
describe('link suggestions', () => {
  it('skips links, own-only provenance, headings and rejected matches; accepts first unlinked alias', async () => {
    const graph = await syncPage(new MemoryKnowledgeStore(), page('source', '[[Alpha|First]]'), { glossary: [] });
    const p = page('other', '[[Alpha|First]] First First');
    const suggestions = suggestLinks(p, graph, emptyDecisions());
    expect(suggestions).toHaveLength(1);
    expect(acceptSuggestion(p.blocks[0], suggestions[0])).toBe('[[Alpha|First]] [[Alpha|First]] First');
    expect(suggestLinks(p, graph, rejectSuggestion(emptyDecisions(), 'other', 'b', 'alpha'))).toEqual([]);
    expect(suggestLinks(page('source', 'Alpha'), graph, emptyDecisions())).toEqual([]);
    p.blocks[0].kind = 'heading'; p.blocks[0].text = 'Alpha';
    expect(suggestLinks(p, graph, emptyDecisions())).toEqual([]);
    p.blocks[0].text = 'no matches'; expect(suggestLinks(p, graph, emptyDecisions())).toEqual([]);
    expect(acceptSuggestion(p.blocks[0], suggestions[0])).toBe('no matches');
    p.blocks[0].kind = 'paragraph';
    p.blocks[0].text = 'Alphas'; expect(acceptSuggestion(p.blocks[0], suggestLinks(p, graph, emptyDecisions())[0])).toBe('[[Alpha]]');
    p.blocks[0].text = 'Firstborn First'; expect(acceptSuggestion(p.blocks[0], suggestions[0])).toBe('Firstborn First');
    expect(acceptSuggestion(p.blocks[0], suggestLinks(p, graph, emptyDecisions())[0])).toBe('Firstborn [[Alpha|First]]');
  });
});
describe('proposals', () => {
  it('reattaches merged proposals, rewires their edge IDs, and hides deleted concepts', () => {
    const g = { ...demoGraph(3), proposals: [
      { id: 'alias', kind: 'alias' as const, label: 'Short name', conceptId: 'demo-0', provenance: [], origin: 'model' as const, status: 'proposed' as const },
      { id: 'edge', kind: 'edge' as const, label: 'Connection', edgeId: 'demo-0|mentions|demo-2', provenance: [], origin: 'model' as const, status: 'proposed' as const },
    ] };
    g.edges.push({ ...g.edges[0], id: 'demo-0|mentions|demo-2', to: 'demo-2' });
    const merged = applyDecisions(g, mergeConcept(emptyDecisions(), g.concepts[0].label, g.concepts[1].label));
    expect(merged.proposals![0].conceptId).toBe('demo-1');
    expect(merged.proposals![1].edgeId).toBe('demo-1|mentions|demo-2');
    const deleted = applyDecisions(merged, deleteConcept(emptyDecisions(), g.concepts[1].label));
    expect(deleted.proposals).toEqual([]);
    expect(g.proposals[0].conceptId).toBe('demo-0');
  });
});
describe('KB sync queue', () => {
  it('debounces, indexes missing/stale pages, skips identical extractions and removes only supported concepts', async () => {
    const callbacks = new Map<number, () => void>(); let id = 0;
    const store = new MemoryKnowledgeStore(), commit = vi.spyOn(store, 'commit'), onGraph = vi.fn();
    const syncer = new KbSyncer(store, () => [], { onGraph, timers: { setTimeout: fn => { callbacks.set(++id, fn); return id; }, clearTimeout: h => { callbacks.delete(h as number); } } });
    const unsubscribe = syncer.subscribe(vi.fn());
    const first = syncer.pageChanged(page('p', '[[Old]]')), second = syncer.pageChanged(page());
    expect(callbacks.size).toBe(1); [...callbacks.values()][0](); await Promise.all([first, second]);
    await syncer.indexAll([page(), page('q', '[[Alpha]] [[Delta]]')]);
    const count = commit.mock.calls.length;
    await syncer.indexAll([page(), page('q', '[[Alpha]] [[Delta]]')]); expect(commit).toHaveBeenCalledTimes(count);
    await syncer.pageDeleted('p'); expect((await store.loadGraph()).concepts.map(c => c.label)).toEqual(['Alpha', 'Delta']);
    await syncer.indexAll([page('q', '[[Alpha]]')]); expect((await store.loadGraph()).concepts).toHaveLength(1);
    await syncer.indexAll([]); expect((await store.loadGraph()).concepts).toEqual([]);
    expect(onGraph).toHaveBeenCalled(); unsubscribe();
  });
  it('recovers its queue after storage errors and cancels pending deleted pages', async () => {
    const store = new MemoryKnowledgeStore(), syncer = new KbSyncer(store, () => []);
    vi.spyOn(store, 'listExtractions').mockRejectedValueOnce(new Error('offline'));
    await expect(syncer.indexAll([])).rejects.toThrow('offline');
    const pending = syncer.pageChanged(page()); await syncer.pageDeleted('p'); await pending;
    const obsolete = syncer.pageChanged(page('obsolete')); await syncer.indexAll([]); await obsolete;
    await syncer.indexAll([page()]); expect((await store.loadGraph()).concepts).toHaveLength(3);
  });
});
describe('map helpers', () => {
  it('filters, groups and traverses', () => {
    const g = demoGraph(10);
    expect(neighbourhood(g, 'demo-0', 0).concepts).toHaveLength(1);
    expect(neighbourhood(g, 'missing', 3).concepts).toEqual([]);
    expect(neighbourhood(g, 'demo-0', 1).concepts).toHaveLength(3);
    expect(filterGraph(g, { query: 'TOPIC 10', pageIds: ['large-0'], kinds: ['supports'] }).concepts).toHaveLength(1);
    expect(filterGraph(g, { pageIds: ['absent'] }).concepts).toEqual([]);
    expect(groupLinks(g, 'demo-0').mentions.outgoing).toHaveLength(2);
  });
  it('lays out 150 concepts / nearly 300 edges deterministically under 200ms', () => {
    const g = demoGraph(150), opts = { width: 1000, height: 700, seed: 42 };
    const start = performance.now(), positions = layoutGraph(g, opts), elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
    expect(layoutGraph(g, opts)).toEqual(positions);
    const camera = fitCamera(Object.values(positions), opts);
    expect(Object.values(positions).every(p => p.x * camera.zoom + camera.x >= 40 && p.y * camera.zoom + camera.y >= 40)).toBe(true);
    expect(layoutGraph({ concepts: [], edges: [] }, opts)).toEqual({});
    expect(() => layoutGraph(g, { width: 0, height: 1 })).toThrow();
  });
  it('fits without wall clamping and centers a single concept', () => {
    const positions = Object.values(layoutGraph(demoGraph(120), { width: 900, height: 200 }));
    const camera = fitCamera(positions, { width: 900, height: 200 });
    expect(positions.every(p => p.x * camera.zoom + camera.x > 0 && p.x * camera.zoom + camera.x < 900 && p.y * camera.zoom + camera.y > 0 && p.y * camera.zoom + camera.y < 200)).toBe(true);
    expect(layoutGraph(demoGraph(1), { width: 900, height: 200 })).toEqual({ 'demo-0': { x: 450, y: 100 } });
  });
});
