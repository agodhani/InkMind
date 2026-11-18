// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import type { Page } from '../model/page';
import { DEFAULT_SETTINGS } from '../settings';
import { IndexedDbKnowledgeStore } from '../store/kbDb';
import { ConceptMap } from '../views/ConceptMap';
import { ConceptDetail } from '../views/ConceptDetail';
import { PageConcepts } from '../views/PageConcepts';
import { modelExtractor, mockKbModel } from './modelExtractor';
import { syncPage } from './store';
import { useKnowledgeBase } from './useKnowledgeBase';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each(['accepted', 'rejected'] as const)('optimistically displays %s across map, detail and page panel, then rolls back and reports a failed write', async decision => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const page: Page = { id: 'p', title: 'Test', createdAt: 0, updatedAt: 0, strokes: [], blocks: [{ id: 'b', kind: 'paragraph', text: 'Spaced retrieval improves learning.', strokeIds: [], confidence: 1, bbox: { left: 0, top: 0, right: 500, bottom: 30 } }] };
  const store = new IndexedDbKnowledgeStore();
  const seeded = await syncPage(store, page, { glossary: [], extractor: modelExtractor(mockKbModel(async () => JSON.stringify({ concepts: [{ block: 'b', term: 'Spaced retrieval' }] }))) });
  const conceptId = seeded.concepts[0].id, noop = vi.fn();
  let fail!: () => void;
  const gate = new Promise<void>(resolve => { fail = resolve; });
  vi.spyOn(IndexedDbKnowledgeStore.prototype, 'commit').mockImplementation(async () => { await gate; throw new Error('Review write failed'); });
  function Harness() {
    const kb = useKnowledgeBase([page], false, DEFAULT_SETTINGS, false);
    const common = { graph: kb.graph, pages: [page], decide: kb.decide, review: kb.review, onSource: noop };
    return createElement('main', null,
      createElement(ConceptMap, { ...common, focused: null, onFocus: noop }),
      createElement(ConceptDetail, { ...common, conceptId, onFocus: noop, onClose: noop }),
      createElement(PageConcepts, { ...common, page, decisions: kb.decisions, onMap: noop, onAccept: noop, onClose: noop }),
      kb.error && createElement('div', { role: 'alert' }, kb.error));
  }
  const host = document.createElement('div'), root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(createElement(Harness)));
    await vi.waitFor(async () => { await act(async () => {}); expect(host.querySelector('.kb-node.suggested')).not.toBeNull(); });
    const button = [...host.querySelectorAll<HTMLButtonElement>('.kb-detail .kb-proposal button')].find(b => b.textContent === (decision === 'accepted' ? 'Accept' : 'Dismiss'))!;
    await act(async () => button.click());
    expect(host.querySelector('.kb-node.suggested')).toBeNull();
    expect(host.querySelector('.drawer .kb-proposal')).toBeNull();
    if (decision === 'accepted') expect(host.querySelector('.kb-detail .kb-proposal')?.textContent).toContain('Accepted');
    else expect(host.querySelector('.kb-detail')).toBeNull();
    await act(async () => fail());
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(host.querySelector('[role="alert"]')?.textContent).toBe('Review write failed');
    });
    expect(host.querySelector('.kb-node.suggested')).not.toBeNull();
    expect(host.querySelector('.kb-detail .kb-proposal')?.textContent).toContain('Suggested');
    expect(host.querySelector('.drawer .kb-proposal')).not.toBeNull();
    expect((await store.loadGraph()).proposals?.[0].status).toBe('proposed');
  } finally { fail(); await act(async () => root.unmount()); host.remove(); }
});
