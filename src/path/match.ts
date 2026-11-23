import type { KbGraph, PageExtraction } from '../kb/model';
import { scanTerms, termKey } from '../kb/normalize';
import { forms, resolveConcept } from './model';
import type { SubjectMap } from './model';

export type Evidence = { kind: 'note'; noteConceptId: string; label: string; provenance: { pageId: string; blockId: string; surface: string }[] }
  | { kind: 'mention'; pageId: string; blockId: string; surface: string }
  | { kind: 'project'; projectId: string };
export interface ProjectResult { projectId: string; concepts: string[]; passed: boolean }
export interface ConceptMatch {
  conceptId: string; state: 'known' | 'partial' | 'new'; basis: 'notes' | 'project' | 'declared' | 'mention' | 'proposal' | 'none'; evidence: Evidence[]; declared: boolean; projectPassed?: boolean;
}
export function matchNotes(map: SubjectMap, notes: { graph: KbGraph; extractions: PageExtraction[] }, declared: string[] = [], projects: ProjectResult[] = []): ConceptMatch[] {
  const declarations = new Set(declared.map(d => resolveConcept(map, d).id));
  const candidates = map.concepts.flatMap(c => forms(c).map(key => ({ key, value: c.id })));
  const pageHits = new Map<string, Set<string>>();
  const hit = (page: string, id: string) => { const s = pageHits.get(page) ?? new Set(); s.add(id); pageHits.set(page, s); };
  const results = map.concepts.map(c => {
    const keys = forms(c), evidence: Evidence[] = [];
    let proposal = false;
    for (const n of notes.graph.concepts) {
      const pendingAlias = (s: string) => notes.graph.proposals?.some(p => p.kind === 'alias' && p.conceptId === n.id && termKey(p.label) === termKey(s) && p.status !== 'accepted');
      if (![n.label, ...n.aliases.filter(a => !pendingAlias(a))].some(s => keys.includes(termKey(s)))) continue;
      if (n.origin === 'model' && n.status !== 'accepted') { proposal = true; continue; }
      const provenance = n.provenance.map(p => ({ pageId: p.pageId, blockId: p.blockId, surface: p.surface })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      evidence.push({ kind: 'note', noteConceptId: n.id, label: n.label, provenance });
      provenance.forEach(p => hit(p.pageId, c.id));
    }
    proposal ||= !!notes.graph.proposals?.some(p => (p.kind === 'concept' || p.kind === 'alias') && p.status !== 'accepted' && keys.includes(termKey(p.label)));
    const d = declarations.has(c.id);
    const hasNote = evidence.length > 0;
    const passed = [...new Set(projects.filter(p => p.passed && p.concepts.includes(c.id)).map(p => p.projectId))].sort();
    evidence.push(...passed.map(projectId => ({ kind: 'project' as const, projectId })));
    return { conceptId: c.id, state: evidence.length || d ? 'known' : proposal ? 'partial' : 'new', basis: hasNote ? 'notes' : passed.length ? 'project' : d ? 'declared' : proposal ? 'proposal' : 'none', evidence, declared: d,
      ...(passed.length ? { projectPassed: true } : {}) } as ConceptMatch;
  });
  const mentions = notes.extractions.flatMap(e => e.texts.flatMap(t => scanTerms(t.text, candidates).map(m => ({ conceptId: m.value, pageId: e.pageId, blockId: t.blockId, surface: m.surface }))));
  mentions.forEach(m => hit(m.pageId, m.conceptId));
  for (const m of mentions) {
    const r = results.find(r => r.conceptId === m.conceptId)!;
    if (r.state === 'known' || pageHits.get(m.pageId)!.size < 2) continue;
    r.state = 'partial';
    if (r.basis !== 'proposal') r.basis = 'mention';
    r.evidence.push({ kind: 'mention', pageId: m.pageId, blockId: m.blockId, surface: m.surface });
  }
  results.forEach(r => { r.evidence = [...new Map(r.evidence.map(e => [JSON.stringify(e), e])).values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))); });
  return results;
}
