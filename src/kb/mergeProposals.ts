import type { Concept, ConceptEdge, KbGraph, GraphProposal, ModelSuggestion, PageExtraction, ProposalDecision, Provenance, RelationMention } from './model';
import { termKey } from './normalize';

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const provKey = (p: Provenance) => JSON.stringify([p.pageId, p.blockId, p.extractor, p.surface]);
const sameBlock = (a: Provenance, b: Provenance) => a.pageId === b.pageId && a.blockId === b.blockId;
const proposalId = (kind: GraphProposal['kind'], ...keys: string[]) => `${kind}:${JSON.stringify(keys)}`;

function shortForm(form: string, label: string): boolean {
  const a = termKey(form), b = termKey(label), words = b.split(' ');
  if (words.length > 1) return a.length >= 2 && a === words.map(w => w[0]).join('');
  return a.length >= 7 && a.length + 4 <= b.length && b.startsWith(a);
}

export function mergeModelProposals(base: KbGraph, pages: PageExtraction[], decisions?: Record<string, ProposalDecision>): KbGraph {
  const byKey = new Map(base.concepts.flatMap(c => [c.label, ...c.aliases].map(label => [termKey(label), c] as const)));
  const trusted = new Map(byKey);
  const edges = new Map(base.edges.map(e => [e.id, e]));
  const proposals = new Map<string, GraphProposal>();
  const occupied = new Set(base.concepts.map(c => c.id));
  const rejectedShortForms = new Set(Object.entries(decisions ?? {}).flatMap(([id, decision]) =>
    decision === 'rejected' && id.startsWith('alias:') ? [JSON.parse(id.slice('alias:'.length))[1] as string] : []));
  const status = (id: string) => decisions?.[id] === 'accepted' ? 'accepted' as const : 'proposed' as const;
  const record = (id: string, kind: GraphProposal['kind'], label: string, prov: Provenance, target: { conceptId: string } | { edgeId: string }) => {
    const p = proposals.get(id) ?? { id, kind, label, ...target, origin: 'model', status: status(id), provenance: [] };
    p.provenance.push(prov);
    proposals.set(id, p);
  };
  const addConcept = (label: string, id: string): Concept => {
    const key = termKey(label);
    const baseId = `c_${key.replace(/[^\p{L}\p{N}]+/gu, '-')}`;
    let conceptId = baseId, suffix = 2;
    while (occupied.has(conceptId)) conceptId = `${baseId}-${suffix++}`;
    occupied.add(conceptId);
    const c: Concept = { id: conceptId, label, aliases: [], provenance: [], origin: 'model', status: status(id) };
    byKey.set(key, c);
    base.concepts.push(c);
    return c;
  };
  const byPage = pages.map(page => {
    const suggestions = page.model?.suggestions ?? [];
    const terms: Extract<ModelSuggestion, { kind: 'concept' }>[] = suggestions.filter(s => s.kind === 'concept');
    const expandedSubjects = new Map<ModelSuggestion, string>();
    for (const s of suggestions) {
      if (s.kind !== 'proposition') continue;
      const claim = termKey(s.term);
      for (const [term] of s.prov.surface.matchAll(/\b[\p{L}]{7,}\b/gu)) {
        const key = termKey(term);
        if (trusted.has(key)) continue;
        const candidates = base.concepts.filter(c => shortForm(term, c.label));
        if (candidates.length !== 1) continue;
        const canonical = candidates[0].label, canonicalKey = termKey(canonical);
        if (!` ${claim} `.includes(` ${key} `) && !` ${claim} `.includes(` ${canonicalKey} `)) continue;
        terms.push({ kind: 'concept', term, canonical, prov: { ...s.prov, surface: term } });
        if (claim.startsWith(`${canonicalKey} `) || claim.startsWith(`${key} `)) expandedSubjects.set(s, term);
      }
    }
    return { page, terms, expandedSubjects };
  });
  const shortTargets = new Map<string, Set<Concept>>();
  for (const s of byPage.flatMap(({ terms }) => terms)) {
    const key = termKey(s.term), candidate = s.canonical && trusted.get(termKey(s.canonical));
    if (!trusted.has(key) && candidate && shortForm(s.term, candidate.label)) {
      const targets = shortTargets.get(key) ?? new Set<Concept>();
      targets.add(candidate);
      shortTargets.set(key, targets);
    }
  }
  const implied: RelationMention[] = [];
  const mention = (c: Concept, prov: Provenance, section: string | undefined) => {
    if (section) implied.push({ from: section, to: c.label, kind: 'mentions', prov });
  };
  for (const { page, terms } of byPage) {
    const sections = new Map(page.texts.map(t => [t.blockId, t.section]));
    for (const s of terms) {
      const key = termKey(s.term), ordinaryId = proposalId('concept', key);
      const targets = shortTargets.get(key);
      const canonical = targets?.size === 1 ? [...targets][0] : undefined;
      const id = canonical ? proposalId('alias', termKey(canonical.label), key)
        : proposalId('concept', termKey(trusted.get(key)?.label ?? s.term));
      if (decisions?.[id] === 'rejected' || decisions?.[ordinaryId] === 'rejected' || (!canonical && !trusted.has(key) && rejectedShortForms.has(key))) continue;
      const c = canonical ?? byKey.get(key) ?? addConcept(s.term, id);
      if (canonical) {
        if (!byKey.has(key)) { c.aliases.push(s.term); byKey.set(key, c); }
        record(id, 'alias', s.term, s.prov, { conceptId: c.id });
      } else if (!c.provenance.some(p => !p.extractor.startsWith('model:') && sameBlock(p, s.prov))) {
        record(id, 'concept', c.label, s.prov, { conceptId: c.id });
      }
      if (!c.provenance.some(p => !p.extractor.startsWith('model:') && sameBlock(p, s.prov))) c.provenance.push(s.prov);
      mention(c, s.prov, sections.get(s.prov.blockId));
    }
  }
  for (const { page, expandedSubjects } of byPage) for (const s of page.model?.suggestions ?? []) {
    if (s.kind !== 'proposition') continue;
    const key = termKey(s.term);
    const id = proposalId('proposition', key);
    if (decisions?.[id] === 'rejected') continue;
    const subjectLabel = s.subject ?? expandedSubjects.get(s);
    const subjectKey = subjectLabel ? termKey(subjectLabel) : undefined;
    const subject = subjectKey ? byKey.get(subjectKey) : undefined;
    if (subjectKey && !subject && (rejectedShortForms.has(subjectKey) || decisions?.[proposalId('concept', subjectKey)] === 'rejected')) continue;
    if (!subject && !trusted.has(key) && decisions?.[proposalId('concept', key)] === 'rejected') continue;
    const c = subject ?? byKey.get(key) ?? addConcept(s.term, id);
    record(id, 'proposition', s.term, s.prov, { conceptId: c.id });
    if (!subject && !c.provenance.some(p => !p.extractor.startsWith('model:') && sameBlock(p, s.prov))) c.provenance.push(s.prov);
  }
  const stated = pages.flatMap(p => (p.model?.suggestions ?? []).flatMap(s => s.kind === 'edge' ? [s.relation] : []));
  for (const r of [...stated, ...implied]) {
    const from = byKey.get(termKey(r.from)), to = byKey.get(termKey(r.to));
    if (!from || !to || from === to) continue;
    const edgeId = `${from.id}|${r.kind}|${to.id}`, id = proposalId('edge', termKey(from.label), r.kind, termKey(to.label));
    if (decisions?.[id] === 'rejected') continue;
    if (edges.get(edgeId)?.provenance.some(p => !p.extractor.startsWith('model:') && sameBlock(p, r.prov))) continue;
    const e: ConceptEdge = edges.get(edgeId) ?? { id: edgeId, from: from.id, to: to.id, kind: r.kind, origin: 'model', status: status(id), labels: [], provenance: [] };
    if (r.label) e.labels.push(r.label);
    e.provenance.push(r.prov);
    edges.set(edgeId, e);
    record(id, 'edge', `${from.label} ${r.kind} ${to.label}`, r.prov, { edgeId });
  }
  if (!proposals.size && !decisions) return base;
  const sortProv = (ps: Provenance[]) => [...new Map(ps.map(p => [provKey(p), p])).entries()].sort(([a], [b]) => compare(a, b)).map(([, p]) => p);
  return {
    concepts: base.concepts.sort((a, b) => compare(a.id, b.id)).map(c => ({ ...c, aliases: c.aliases.sort(compare), provenance: sortProv(c.provenance) })),
    edges: [...edges.values()].sort((a, b) => compare(a.id, b.id)).map(e => ({ ...e, labels: [...new Set(e.labels)].sort(compare), provenance: sortProv(e.provenance) })),
    ...(proposals.size ? { proposals: [...proposals.values()].sort((a, b) => compare(a.id, b.id)).map(p => ({ ...p, provenance: sortProv(p.provenance) })) } : {}),
    ...(decisions ? { proposalDecisions: decisions } : {}),
  };
}
