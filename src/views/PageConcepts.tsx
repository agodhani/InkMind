import { useState } from 'react';
import type { DigitalBlock, Page } from '../model/page';
import { rejectSuggestion, type KbDecisions } from '../kb/decisions';
import { acceptSuggestion, suggestLinks } from '../kb/suggest';
import type { KbGraph } from '../kb/model';
import type { Provenance } from '../kb/model';
import { Drawer, Section } from '../ui/primitives';
import { ConceptDetail } from './ConceptDetail';
import { ProposalReview, type ReviewProposal } from './ProposalReview';

export function PageConcepts({ page, pages, graph, decisions, decide, review, onMap, onSource, onAccept, onClose }: {
  page: Page; pages: Page[]; graph: KbGraph; decisions: KbDecisions; review: ReviewProposal;
  decide: (fn: (d: KbDecisions) => KbDecisions) => void; onMap: (id: string) => void;
  onSource: (p: Provenance) => void; onAccept: (block: DigitalBlock, text: string) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const concepts = graph.concepts.filter(c => c.provenance.some(p => p.pageId === page.id));
  const suggestions = suggestLinks(page, graph, decisions);
  const proposed = graph.proposals?.filter(p => p.status === 'proposed' && p.provenance.some(s => s.pageId === page.id)) ?? [];
  return <Drawer open side="right" title="Concepts on this page" width={420} onClose={onClose}>
    {selected && graph.concepts.some(c => c.id === selected) ? <ConceptDetail key={selected} graph={graph} conceptId={selected} pages={pages} decide={decide} review={review} onSource={onSource} onFocus={onMap} onClose={() => setSelected(null)} /> : <>
      <Section title={`${concepts.length} concepts`} description="Explore the ideas connected to this note.">{concepts.map(c => <div className="kb-link-row" key={c.id}><button className="kb-list-item" onClick={() => onMap(c.id)}>{c.label}{c.status === 'proposed' && <span className="badge warn">Suggested</span>}</button><button className="btn ghost" aria-label={`Details for ${c.label}`} onClick={() => setSelected(c.id)}>Details</button></div>)}{!concepts.length && <p className="kb-muted">Headings and [[links]] create concepts as you write.</p>}</Section>
      <Section title={`Link suggestions · ${suggestions.length}`} description="Connect a mention to a concept you already know.">{suggestions.map(s => {
        const block = page.blocks.find(b => b.id === s.blockId)!;
        const start = Math.max(0, s.start - 45);
        return <article className="kb-suggestion" key={`${s.blockId}-${s.conceptId}`}><strong>{s.label}</strong><p>{start > 0 && '…'}{block.text.slice(start, s.start)}<mark>{block.text.slice(s.start, s.end)}</mark>{block.text.slice(s.end, s.end + 65)}</p><div className="kb-actions"><button className="btn tone-primary" onClick={() => onAccept(block, acceptSuggestion(block, s))}>Accept link</button><button className="btn" onClick={() => decide(d => rejectSuggestion(d, page.id, block.id, s.label))}>Reject</button></div></article>;
      })}{!suggestions.length && <p className="kb-muted">No unlinked mentions to review.</p>}</Section>
      <Section title={`Suggested items · ${proposed.length}`}>{proposed.map(p => <ProposalReview key={p.id} proposal={p} graph={graph} review={review} />)}</Section>
    </>}
  </Drawer>;
}
