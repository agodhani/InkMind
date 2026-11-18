import type { Concept, ConceptEdge, ConceptEdgeKind, KbGraph, Provenance } from './model';
import { conceptMatches, union, type KbDecisions } from './decisions';

/** UI interchange for future model extraction output; raw extracted graphs remain unchanged. */
export interface KbProposal {
  id: string; kind: 'concept' | 'edge'; label?: string; from?: string; to?: string;
  edgeKind?: ConceptEdgeKind; provenance: Provenance[]; origin: string; status: 'suggested';
}
export type ViewGraph = { concepts: (Concept & { status: 'accepted' | 'suggested' })[]; edges: (ConceptEdge & { status: 'accepted' | 'suggested' })[] };
export function withProposals(graph: KbGraph, proposals: KbProposal[], decisions: KbDecisions): ViewGraph {
  const result: ViewGraph = { concepts: graph.concepts.map(c => ({ ...structuredClone(c), status: 'accepted' })), edges: graph.edges.map(e => ({ ...structuredClone(e), status: 'accepted' })) };
  const status = (p: KbProposal) => decisions.proposals?.find(d => d.id === p.id)?.status ?? 'suggested';
  const find = (key: string) => result.concepts.find(c => c.id === key || conceptMatches(c, key));
  for (const p of proposals.filter(p => p.kind === 'concept')) {
    const s = status(p);
    if (s === 'rejected' || !p.label) continue;
    const existing = find(p.label);
    if (existing) { existing.provenance = union([...existing.provenance, ...p.provenance]); if (s === 'accepted') existing.status = s; }
    else result.concepts.push({ id: p.id, label: p.label, aliases: [], provenance: structuredClone(p.provenance), status: s });
  }
  for (const p of proposals.filter(p => p.kind === 'edge')) {
    const s = status(p), from = find(p.from ?? ''), to = find(p.to ?? '');
    if (s === 'rejected' || !from || !to || from === to || !p.edgeKind) continue;
    const id = `${from.id}|${p.edgeKind}|${to.id}`, existing = result.edges.find(e => e.id === id);
    if (existing) { existing.provenance = union([...existing.provenance, ...p.provenance]); if (s === 'accepted') existing.status = s; }
    else result.edges.push({ id, from: from.id, to: to.id, kind: p.edgeKind, labels: [], provenance: structuredClone(p.provenance), status: s });
  }
  return result;
}
