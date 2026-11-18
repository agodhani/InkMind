import { useState } from 'react';
import type { DigitalBlock, Page } from '../model/page';
import { decideProposal, rejectSuggestion, type KbDecisions } from '../kb/decisions';
import { acceptSuggestion, suggestLinks } from '../kb/suggest';
import type { KbProposal, ViewGraph } from '../kb/proposals';
import type { Provenance } from '../kb/model';
import { Drawer, Section } from '../ui/primitives';
import { ConceptDetail } from './ConceptDetail';

export function PageConcepts({ page, pages, graph, decisions, proposals, decide, onMap, onSource, onAccept, onClose }: {
  page: Page; pages: Page[]; graph: ViewGraph; decisions: KbDecisions; proposals: KbProposal[];
  decide: (fn: (d: KbDecisions) => KbDecisions) => void; onMap: (id: string) => void;
  onSource: (p: Provenance) => void; onAccept: (block: DigitalBlock, text: string) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const concepts = graph.concepts.filter(c => c.provenance.some(p => p.pageId === page.id));
  const suggestions = suggestLinks(page, graph, decisions);
  const proposed = proposals.filter(p => p.provenance.some(s => s.pageId === page.id) && !decisions.proposals?.some(d => d.id === p.id));
  return <Drawer open side="right" title="Concepts on this page" width={420} onClose={onClose}>
    {selected && graph.concepts.some(c => c.id === selected) ? <ConceptDetail key={selected} graph={graph} conceptId={selected} pages={pages} decide={decide} onSource={onSource} onFocus={onMap} onClose={() => setSelected(null)} /> : <>
      <Section title={`${concepts.length} concepts`} description="Explore the ideas connected to this note.">{concepts.map(c => <div className="kb-link-row" key={c.id}><button className="kb-list-item" onClick={() => onMap(c.id)}>{c.label}{c.status === 'suggested' && <span className="badge warn">Suggested</span>}</button><button className="btn ghost" aria-label={`Details for ${c.label}`} onClick={() => setSelected(c.id)}>Details</button></div>)}{!concepts.length && <p className="kb-muted">Headings and [[links]] create concepts as you write.</p>}</Section>
      <Section title={`Link suggestions · ${suggestions.length}`} description="Connect a mention to a concept you already know.">{suggestions.map(s => {
        const block = page.blocks.find(b => b.id === s.blockId)!;
        const at = block.text.indexOf(s.surface), start = Math.max(0, at - 45), end = at + s.surface.length;
        return <article className="kb-suggestion" key={`${s.blockId}-${s.conceptId}`}><strong>{s.label}</strong><p>{start > 0 && '…'}{block.text.slice(start, at)}<mark>{s.surface}</mark>{block.text.slice(end, end + 65)}</p><div className="kb-actions"><button className="btn tone-primary" onClick={() => onAccept(block, acceptSuggestion(block, s))}>Accept link</button><button className="btn" onClick={() => decide(d => rejectSuggestion(d, page.id, block.id, s.label))}>Reject</button></div></article>;
      })}{!suggestions.length && <p className="kb-muted">No unlinked mentions to review.</p>}</Section>
      <Section title={`Suggested items · ${proposed.length}`}>{proposed.map(p => <article className="kb-suggestion" key={p.id}><span className="badge warn">Suggested {p.kind}</span><p>{p.label ?? `${p.from} → ${p.to}`}</p><div className="kb-actions"><button className="btn" onClick={() => decide(d => decideProposal(d, p.id, 'accepted'))}>Accept</button><button className="btn" onClick={() => decide(d => decideProposal(d, p.id, 'rejected'))}>Dismiss</button></div></article>)}</Section>
    </>}
  </Drawer>;
}
