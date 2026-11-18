import { useState } from 'react';
import type { Page } from '../model/page';
import type { Provenance } from '../kb/model';
import type { KbGraph } from '../kb/model';
import { deleteConcept, mergeConcept, renameConcept, type KbDecisions } from '../kb/decisions';
import { groupLinks } from '../kb/mapView';
import { IconButton, Section } from '../ui/primitives';
import { ProposalReview, type ReviewProposal } from './ProposalReview';

export interface ConceptDetailProps {
  graph: KbGraph; conceptId: string; pages: Page[];
  decide: (fn: (d: KbDecisions) => KbDecisions) => void;
  review: ReviewProposal;
  onFocus: (id: string) => void; onSource: (source: Provenance) => void; onClose: () => void;
}
export function ConceptDetail({ graph, conceptId, pages, decide, review, onFocus, onSource, onClose }: ConceptDetailProps) {
  const concept = graph.concepts.find(c => c.id === conceptId);
  const [action, setAction] = useState<'rename' | 'merge' | null>(null);
  const [draft, setDraft] = useState('');
  if (!concept) return null;
  const links = groupLinks(graph, concept.id);
  return <aside className="kb-detail" aria-label="Concept details" key={concept.id}>
    <header className="kb-detail-head"><div><small>CONCEPT</small><h2>{concept.label}</h2></div><IconButton icon="close" label="Close concept details" onClick={onClose} className="ghost" /></header>
    {graph.proposals?.filter(p => p.conceptId === concept.id || (p.edgeId && graph.edges.some(e => e.id === p.edgeId && (e.from === concept.id || e.to === concept.id)))).map(p => <ProposalReview key={p.id} proposal={p} graph={graph} review={review} />)}
    {concept.aliases.length > 0 && <p className="kb-aliases">Also known as {concept.aliases.join(' · ')}</p>}
    <div className="kb-actions"><button className="btn" onClick={() => { setAction('rename'); setDraft(concept.label); }}>Rename</button><button className="btn" onClick={() => { setAction('merge'); setDraft(''); }}>Merge into…</button><button className="btn tone-danger" onClick={() => { if (window.confirm(`Delete “${concept.label}” from the knowledge base? Your notes are kept.`)) { decide(d => deleteConcept(d, concept.label)); onClose(); } }}>Delete</button></div>
    {action && <form className="kb-edit" onSubmit={e => { e.preventDefault(); if (action === 'rename' && draft.trim()) { decide(d => renameConcept(d, concept.label, draft.trim())); setAction(null); } }}>
      <label htmlFor="concept-action">{action === 'rename' ? 'New concept name' : 'Search merge target'}</label><input id="concept-action" className="input" autoFocus value={draft} onChange={e => setDraft(e.target.value)} />
      {action === 'rename' ? <button className="btn tone-primary" type="submit" disabled={!draft.trim()}>Save name</button> : <div className="kb-results">{graph.concepts.filter(c => c.id !== concept.id && c.label.toLowerCase().includes(draft.toLowerCase())).slice(0, 12).map(c => <button className="kb-list-item" type="button" key={c.id} onClick={() => { decide(d => mergeConcept(d, concept.label, c.label)); setAction(null); onFocus(c.id); }}>{c.label}</button>)}</div>}
      <button className="btn" type="button" onClick={() => setAction(null)}>Cancel</button>
    </form>}
    {Object.entries(links).map(([kind, directions]) => (directions.outgoing.length + directions.incoming.length > 0) && <Section title={kind} key={kind}>{(['outgoing', 'incoming'] as const).map(direction => directions[direction].map(({ edge, concept: other }) => <div className="kb-link-row" key={edge.id}><button className="kb-list-item" onClick={() => onFocus(other.id)}><small>{direction === 'outgoing' ? '→' : '←'}</small> {other.label}</button>{graph.edges.find(e => e.id === edge.id)?.status === 'proposed' && <span className="badge warn">Suggested</span>}</div>))}</Section>)}
    <Section title={`Sources · ${concept.provenance.length}`} description="Jump back to the exact block in your notes.">{concept.provenance.map((source, i) => {
      const page = pages.find(p => p.id === source.pageId), block = page?.blocks.find(b => b.id === source.blockId);
      return <button className="kb-source" key={i} disabled={!block} onClick={() => onSource(source)}><strong>{page?.title ?? 'Unavailable page'}</strong><span>{block?.text.slice(0, 160) || source.surface}</span><small>{source.extractor}</small></button>;
    })}</Section>
  </aside>;
}
