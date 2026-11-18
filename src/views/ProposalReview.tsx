import type { GraphProposal, KbGraph, ProposalDecision } from '../kb/model';

export type ReviewProposal = (id: string, decision: ProposalDecision) => void;
export function proposalText(proposal: GraphProposal, graph: KbGraph): string {
  const concept = graph.concepts.find(c => c.id === proposal.conceptId);
  if (proposal.kind === 'alias') return `${concept?.label ?? 'This concept'} is also called ${proposal.label}`;
  if (proposal.kind === 'edge') {
    const edge = graph.edges.find(e => e.id === proposal.edgeId);
    if (edge) return `${graph.concepts.find(c => c.id === edge.from)?.label} → ${edge.kind} → ${graph.concepts.find(c => c.id === edge.to)?.label}`;
  }
  return proposal.label;
}
export function ProposalReview({ proposal, graph, review }: { proposal: GraphProposal; graph: KbGraph; review: ReviewProposal }) {
  return <article className="kb-proposal" data-proposal-id={proposal.id}><span className={`badge ${proposal.status === 'proposed' ? 'warn' : 'ok'}`}>{proposal.status === 'proposed' ? 'Suggested' : 'Accepted'} {proposal.kind}</span><p>{proposalText(proposal, graph)}</p><small>{proposal.provenance.map(p => p.extractor).filter((s, i, all) => all.indexOf(s) === i).join(' · ')}</small>{proposal.status === 'proposed' && <div className="kb-actions"><button className="btn tone-primary" onClick={() => review(proposal.id, 'accepted')}>Accept</button><button className="btn" onClick={() => review(proposal.id, 'rejected')}>Dismiss</button></div>}</article>;
}
