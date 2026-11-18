import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Page } from '../model/page';
import type { AppSettings } from '../settings';
import { openDb } from '../store/db';
import { IndexedDbKnowledgeStore } from '../store/kbDb';
import { IndexedDbDecisionsStore } from '../store/kbDecisionsDb';
import { applyDecisions, emptyDecisions, type KbDecisions } from './decisions';
import type { KbGraph, PageExtraction, ProposalDecision } from './model';
import { configuredKbExtractor } from './modelSettings';
import { KbSyncer } from './sync';

export function useKnowledgeBase(pages: Page[], loaded: boolean, settings: AppSettings, busy: boolean) {
  const [graph, setGraph] = useState<KbGraph>({ concepts: [], edges: [] });
  const [decisions, setDecisions] = useState(emptyDecisions);
  const [error, setError] = useState<string | null>(null);
  const current = useRef({ pages, settings, busy }); current.current = { pages, settings, busy };
  const decisionRef = useRef(decisions);
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const decisionsStore = useMemo(() => new IndexedDbDecisionsStore(), []);
  const report = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), []);
  const syncer = useMemo(() => new KbSyncer(new IndexedDbKnowledgeStore(), () => current.current.settings.glossary, {
    onGraph: setGraph, onError: report, busy: () => current.current.busy,
    modelExtractor: () => { try { return configuredKbExtractor(current.current.settings); } catch (e) { report(e); return undefined; } },
  }), [report]);
  useEffect(() => {
    void openDb().then(connection => new Promise<void>((resolve, reject) => {
      const tx = connection.transaction('kv', 'readwrite'); tx.objectStore('kv').delete('kb.proposals');
      tx.oncomplete = () => { connection.close(); resolve(); };
      tx.onabort = () => { connection.close(); reject(tx.error); };
    })).catch(report);
    void syncer.load().catch(report);
    void decisionsStore.load().then(d => { decisionRef.current = d; setDecisions(d); }).catch(report);
    return () => syncer.abortModel();
  }, [decisionsStore, report, syncer]);
  useEffect(() => {
    syncer.abortModel();
    if (loaded) void syncer.indexAll(current.current.pages).catch(report);
  }, [loaded, settings.glossary, settings.modelConceptExtraction, settings.provider, settings.ollamaUrl, settings.openRouterApiKey, syncer, report]);
  useEffect(() => {
    if (busy) syncer.abortModel();
    else if (loaded) void syncer.indexAll(current.current.pages).catch(report);
  }, [busy, loaded, syncer, report]);
  const decide = useCallback((fn: (d: KbDecisions) => KbDecisions) => {
    const next = fn(decisionRef.current); decisionRef.current = next; setDecisions(next);
    saves.current = saves.current.then(() => decisionsStore.save(next)).catch(report);
  }, [decisionsStore, report]);
  const review = useCallback((id: string, decision: ProposalDecision) => { void syncer.review(id, decision).catch(report); }, [syncer, report]);
  const seedExtractions = useCallback(async (pages: Page[], extractions: PageExtraction[]) => {
    for (const extraction of extractions) {
      const page = pages.find(p => p.id === extraction.pageId);
      if (page) await syncer.extractWith(page, { name: 'saved-model-fixture', extract: async () => ({ raw: JSON.stringify(extraction) }), parse: raw => JSON.parse(raw) as PageExtraction });
    }
  }, [syncer]);
  const pageChanged = useCallback((p: Page) => { void syncer.pageChanged(p).catch(report); }, [syncer, report]);
  const pageEdited = useCallback((id: string) => syncer.abortModel(id), [syncer]);
  const pageDeleted = useCallback((id: string) => { void syncer.pageDeleted(id).catch(report); }, [syncer, report]);
  const displayed = useMemo(() => applyDecisions(graph, decisions), [graph, decisions]);
  return { graph: displayed, rawGraph: graph, decisions, decide, review, seedExtractions, pageChanged, pageEdited, pageDeleted, error };
}
