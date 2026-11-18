// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Page } from '../model/page';
import { DEFAULT_SETTINGS } from '../settings';
import { db } from '../store/db';
import { IndexedDbDecisionsStore } from '../store/kbDecisionsDb';
import { IndexedDbKnowledgeStore } from '../store/kbDb';
import { deleteConcept, emptyDecisions, mergeConcept, renameConcept } from './decisions';
import type { KbGraph } from './model';
import { KbSyncer } from './sync';
import { useKnowledgeBase } from './useKnowledgeBase';

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(() => vi.unstubAllGlobals());

function page(id: string, heading: string, text: string): Page {
  return { id, title: id, strokes: [], createdAt: 0, updatedAt: 0, blocks: [
    { id: 'heading', kind: 'heading', text: heading, strokeIds: [], confidence: 1, bbox: { left: 0, top: 0, right: 500, bottom: 30 } },
    { id: 'body', kind: 'paragraph', text, strokeIds: [], confidence: 1, bbox: { left: 0, top: 40, right: 500, bottom: 80 } },
  ] };
}

async function mount(source: Page) {
  let current!: ReturnType<typeof useKnowledgeBase>;
  function Harness({ source }: { source: Page }) {
    const kb = useKnowledgeBase([source], true, DEFAULT_SETTINGS, false);
    useEffect(() => { current = kb; });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  const render = (source: Page) => act(async () => root.render(createElement(Harness, { source })));
  await render(source);
  return { get kb() { return current; }, render, unmount: () => act(async () => root.unmount()) };
}

async function eventually(assertion: () => void | Promise<void>) {
  await vi.waitFor(async () => { await act(async () => {}); await assertion(); }, { timeout: 3000 });
}

it.each(['rename', 'merge', 'delete'] as const)('persists %s through fresh hook/store reloads and source re-extraction', async action => {
  const source = page('source', 'Gamma', '[[Alpha]] [[Beta]]');
  await db.putPage(source);
  let mounted = await mount(source);
  const change = action === 'rename' ? (d: ReturnType<typeof emptyDecisions>) => renameConcept(d, 'Alpha', 'First')
    : action === 'merge' ? (d: ReturnType<typeof emptyDecisions>) => mergeConcept(d, 'Alpha', 'Beta')
      : (d: ReturnType<typeof emptyDecisions>) => deleteConcept(d, 'Alpha');
  const decisions = change(emptyDecisions());
  const check = (graph: KbGraph) => {
    expect(graph.concepts.some(c => c.label === 'Alpha')).toBe(false);
    expect(graph.concepts.map(c => c.label)).toEqual(expect.arrayContaining(['Beta', 'Gamma']));
    if (action === 'rename') expect(graph.concepts.find(c => c.label === 'First')?.aliases).toContain('Alpha');
    else expect(graph.concepts.some(c => c.label === 'First')).toBe(false);
    if (action === 'merge') expect(graph.concepts.find(c => c.label === 'Beta')?.aliases).toContain('Alpha');
    if (action === 'delete') expect(graph.concepts.some(c => c.aliases.includes('Alpha'))).toBe(false);
  };
  try {
    await eventually(() => expect(mounted.kb.graph.concepts.map(c => c.label).sort()).toEqual(['Alpha', 'Beta', 'Gamma']));
    await act(async () => mounted.kb.decide(change));
    check(mounted.kb.graph);
    await eventually(async () => expect(await new IndexedDbDecisionsStore().load()).toEqual(decisions));
    await mounted.unmount();

    mounted = await mount((await db.getPage(source.id))!);
    await eventually(() => { expect(mounted.kb.decisions).toEqual(decisions); check(mounted.kb.graph); });
    const edited = structuredClone(source);
    edited.updatedAt = 1;
    edited.blocks[1].text += ' Edited source with [[Fresh concept]].';
    await db.putPage(edited);
    await mounted.render(edited);
    await act(async () => mounted.kb.pageChanged(edited));
    await eventually(() => {
      expect(mounted.kb.rawGraph.concepts.some(c => c.label === 'Fresh concept')).toBe(true);
      check(mounted.kb.graph);
      expect(mounted.kb.error).toBeNull();
    });
    const extraction = (await new IndexedDbKnowledgeStore().listExtractions()).find(e => e.pageId === source.id)!;
    expect(extraction.texts).toContainEqual(expect.objectContaining({ blockId: 'body', text: edited.blocks[1].text }));
    expect(extraction.terms.some(t => t.term === 'Alpha')).toBe(true);
    await mounted.unmount();

    mounted = await mount((await db.getPage(source.id))!);
    await eventually(() => {
      expect(mounted.kb.decisions).toEqual(decisions);
      expect(mounted.kb.graph.concepts.some(c => c.label === 'Fresh concept')).toBe(true);
      check(mounted.kb.graph);
    });
    expect(await new IndexedDbDecisionsStore().load()).toEqual(decisions);
  } finally { await mounted.unmount(); }
});

it('removes page-only concepts/edges and shared provenance across reloads, including deletion of the last page', async () => {
  const a = page('a', 'Learning', '[[Reward]] [[Only here]]');
  const b = page('b', 'Learning', '[[Reward]] [[Only there]]');
  await db.putPage(a); await db.putPage(b);
  let emitted: KbGraph = { concepts: [], edges: [] };
  const store = new IndexedDbKnowledgeStore();
  const syncer = new KbSyncer(store, () => [], { onGraph: graph => { emitted = graph; } });
  await syncer.indexAll(await db.listPages());
  expect(emitted.concepts.map(c => c.label).sort()).toEqual(['Learning', 'Only here', 'Only there', 'Reward']);
  const shared = emitted.concepts.filter(c => ['Learning', 'Reward'].includes(c.label));
  for (const c of shared) expect(new Set(c.provenance.map(p => p.pageId))).toEqual(new Set(['a', 'b']));
  const ids = new Set(shared.map(c => c.id));
  const sharedEdge = emitted.edges.find(e => ids.has(e.from) && ids.has(e.to))!;
  expect(new Set(sharedEdge.provenance.map(p => p.pageId))).toEqual(new Set(['a', 'b']));
  const uniqueEdges = emitted.edges.filter(e => e.provenance.every(p => p.pageId === a.id));
  expect(uniqueEdges.length).toBeGreaterThan(0);

  await db.deletePage(a.id);
  await syncer.pageDeleted(a.id);
  const remaining = structuredClone(emitted);
  expect(remaining.concepts.map(c => c.label).sort()).toEqual(['Learning', 'Only there', 'Reward']);
  expect(remaining.edges).toHaveLength(2);
  expect(remaining.edges.some(e => e.id === sharedEdge.id)).toBe(true);
  for (const e of uniqueEdges) expect(remaining.edges.some(edge => edge.id === e.id)).toBe(false);
  for (const item of [...remaining.concepts, ...remaining.edges]) {
    expect(item.provenance.length).toBeGreaterThan(0);
    expect(new Set(item.provenance.map(p => p.pageId))).toEqual(new Set(['b']));
  }
  expect(await store.loadGraph()).toEqual(remaining);
  expect((await store.listExtractions()).map(e => e.pageId)).toEqual(['b']);

  const reopenedStore = new IndexedDbKnowledgeStore();
  const reopened = new KbSyncer(reopenedStore, () => [], { onGraph: graph => { emitted = graph; } });
  await reopened.load();
  expect(emitted).toEqual(remaining);
  await reopened.indexAll(await db.listPages());
  expect(emitted).toEqual(remaining);
  expect((await reopenedStore.listExtractions()).map(e => e.pageId)).toEqual(['b']);

  await db.deletePage(b.id);
  await reopened.pageDeleted(b.id);
  expect(emitted).toEqual({ concepts: [], edges: [] });
  const emptyStore = new IndexedDbKnowledgeStore();
  const empty = new KbSyncer(emptyStore, () => [], { onGraph: graph => { emitted = graph; } });
  await empty.load();
  await empty.indexAll(await db.listPages());
  expect(emitted).toEqual({ concepts: [], edges: [] });
  expect(await emptyStore.listExtractions()).toEqual([]);
  expect(await emptyStore.loadGraph()).toEqual(emitted);
});
