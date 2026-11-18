import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Page } from '../model/page';
import { db } from '../store/db';
import { IndexedDbKnowledgeStore } from '../store/kbDb';
import { IndexedDbDecisionsStore } from '../store/kbDecisionsDb';
import { applyDecisions, emptyDecisions, type KbDecisions } from './decisions';
import type { KbGraph } from './model';
import { withProposals, type KbProposal } from './proposals';
import { KbSyncer } from './sync';

export function useKnowledgeBase(pages: Page[], loaded: boolean, glossary: string[]) {
  const [graph, setGraph] = useState<KbGraph>({ concepts: [], edges: [] });
  const [decisions, setDecisions] = useState(emptyDecisions);
  const [proposals, setProposals] = useState<KbProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latestGlossary = useRef(glossary); latestGlossary.current = glossary;
  const decisionRef = useRef(decisions);
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const decisionsStore = useMemo(() => new IndexedDbDecisionsStore(), []);
  const syncer = useMemo(() => new KbSyncer(new IndexedDbKnowledgeStore(), () => latestGlossary.current, { onGraph: setGraph }), []);
  const report = useCallback((e: unknown) => setError((e as Error).message), []);
  useEffect(() => {
    void new IndexedDbKnowledgeStore().loadGraph().then(setGraph).catch(report);
    void Promise.all([decisionsStore.load(), db.getKv<KbProposal[]>('kb.proposals')]).then(([d, p]) => {
      decisionRef.current = d; setDecisions(d); setProposals(p ?? []);
    }).catch(report);
  }, [decisionsStore, report]);
  useEffect(() => {
    if (loaded) void syncer.indexAll(pages).catch(report);
  }, [loaded, pages, glossary, syncer, report]);
  const decide = useCallback((fn: (d: KbDecisions) => KbDecisions) => {
    const next = fn(decisionRef.current); decisionRef.current = next; setDecisions(next);
    saves.current = saves.current.then(() => decisionsStore.save(next)).catch(report);
  }, [decisionsStore, report]);
  const saveProposals = useCallback((p: KbProposal[]) => {
    setProposals(p); saves.current = saves.current.then(() => db.setKv('kb.proposals', p)).catch(report);
  }, [report]);
  const pageChanged = useCallback((p: Page) => { void syncer.pageChanged(p).catch(report); }, [syncer, report]);
  const pageDeleted = useCallback((id: string) => { void syncer.pageDeleted(id).catch(report); }, [syncer, report]);
  const displayed = useMemo(() => withProposals(applyDecisions(graph, decisions), proposals, decisions), [graph, decisions, proposals]);
  return { graph: displayed, decisions, decide, proposals, saveProposals, pageChanged, pageDeleted, error };
}
