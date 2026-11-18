export type ConceptEdgeKind = 'follows' | 'supports' | 'mentions' | 'contains';

export interface Provenance {
  pageId: string; blockId: string;
  strokeIds: string[];
  extractor: string;
  surface: string;
}
export type ProposalStatus = 'proposed' | 'accepted';
export type ProposalDecision = 'accepted' | 'rejected';
interface ModelOrigin { origin?: 'model'; status?: ProposalStatus }
export interface Concept extends ModelOrigin { id: string; label: string; aliases: string[]; provenance: Provenance[] }
export interface ConceptEdge extends ModelOrigin { id: string; from: string; to: string; kind: ConceptEdgeKind; labels: string[]; provenance: Provenance[] }
export interface GraphProposal {
  id: string; kind: 'concept' | 'alias' | 'proposition' | 'edge';
  label: string; conceptId?: string; edgeId?: string;
  origin: 'model'; status: ProposalStatus; provenance: Provenance[];
}
export interface KbGraph {
  concepts: Concept[]; edges: ConceptEdge[];
  proposals?: GraphProposal[];
  proposalDecisions?: Record<string, ProposalDecision>;
}
export interface TermMention { term: string; aliases?: string[]; prov: Provenance; defines: boolean }
export interface RelationMention { from: string; to: string; kind: ConceptEdgeKind; label?: string; prov: Provenance }
export interface TextSpan { blockId: string; text: string; section?: string }
export type ModelSuggestion =
  | { kind: 'concept'; term: string; canonical?: string; prov: Provenance }
  | { kind: 'proposition'; term: string; subject?: string; prov: Provenance }
  | ({ kind: 'edge'; relation: RelationMention });
export interface ModelExtraction { provider: string; blocks: { id: string; key: string }[]; suggestions: ModelSuggestion[] }
export interface PageExtraction { pageId: string; extractor: string; terms: TermMention[]; relations: RelationMention[]; texts: TextSpan[]; model?: ModelExtraction }
