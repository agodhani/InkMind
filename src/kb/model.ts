export type ConceptEdgeKind = 'follows' | 'supports' | 'mentions' | 'contains';

export interface Provenance {
  pageId: string; blockId: string;
  strokeIds: string[];
  extractor: string;
  surface: string;
}
export interface Concept { id: string; label: string; aliases: string[]; provenance: Provenance[] }
export interface ConceptEdge { id: string; from: string; to: string; kind: ConceptEdgeKind; labels: string[]; provenance: Provenance[] }
export interface KbGraph { concepts: Concept[]; edges: ConceptEdge[] }
export interface TermMention { term: string; aliases?: string[]; prov: Provenance; defines: boolean }
export interface RelationMention { from: string; to: string; kind: ConceptEdgeKind; label?: string; prov: Provenance }
export interface TextSpan { blockId: string; text: string; section?: string }
export interface PageExtraction { pageId: string; extractor: string; terms: TermMention[]; relations: RelationMention[]; texts: TextSpan[] }
