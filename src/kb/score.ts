import type { Page } from '../model/page';
import type { ConceptEdgeKind, KbGraph, Provenance } from './model';

export interface ExpectedProvenance { pageId: string; blockId: string }
export interface ExpectedConcept { label: string; aliases?: string[]; provenance: ExpectedProvenance[] }
export interface ExpectedEdge { from: string; to: string; kind: ConceptEdgeKind; provenance: ExpectedProvenance[] }
export interface AnswerKey { concepts: ExpectedConcept[]; edges: ExpectedEdge[]; mustNotMerge?: [string, string][] }
export interface KbCounts {
  notebooks: number; expectedConcepts: number; predictedConcepts: number; conceptHits: number; conceptCorrect: number;
  expectedEdges: number; predictedEdges: number; edgeHits: number; edgeCorrect: number;
  duplicates: number; falseMerges: number; provenanceOk: number; provenanceTotal: number; idempotent: number;
}
export interface ScoreResult { counts: KbCounts; details: string[] }

export function scorerKey(s: string): string {
  return s.toLowerCase().replace(/[-\s]+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
}

export function emptyCounts(): KbCounts {
  return { notebooks: 0, expectedConcepts: 0, predictedConcepts: 0, conceptHits: 0, conceptCorrect: 0, expectedEdges: 0, predictedEdges: 0, edgeHits: 0, edgeCorrect: 0, duplicates: 0, falseMerges: 0, provenanceOk: 0, provenanceTotal: 0, idempotent: 0 };
}

export const ratio = (numerator: number, denominator: number): number => denominator ? numerator / denominator : 1;
const names = (c: { label: string; aliases?: string[] }) => [c.label, ...(c.aliases ?? [])].map(scorerKey);
const locations = (ps: ExpectedProvenance[]) => [...new Set(ps.map(p => `${p.pageId}/${p.blockId}`))].sort();

export function scoreGraph(graph: KbGraph, expected: AnswerKey, pages: Page[], idempotent = true): ScoreResult {
  const counts: KbCounts = { ...emptyCounts(), notebooks: 1, expectedConcepts: expected.concepts.length, predictedConcepts: graph.concepts.length, expectedEdges: expected.edges.length, predictedEdges: graph.edges.length, idempotent: Number(idempotent) };
  const details: string[] = [];
  const matches = expected.concepts.map(e => graph.concepts.filter(p => names(p).some(n => names(e).includes(n))));
  const predictedMatches = graph.concepts.map(p => expected.concepts.filter(e => names(p).some(n => names(e).includes(n))));
  counts.conceptHits = matches.filter(m => m.length).length;
  counts.conceptCorrect = predictedMatches.filter(m => m.length).length;
  counts.duplicates = matches.reduce((sum, m) => sum + Math.max(0, m.length - 1), 0);
  const merged = new Set(graph.concepts.filter((_, i) => predictedMatches[i].length > 1).map(p => p.id));
  counts.falseMerges = merged.size;
  const resolveExpected = (s: string) => expected.concepts.flatMap((c, i) => names(c).includes(scorerKey(s)) ? [i] : []);
  const resolves = (id: string, s: string) => resolveExpected(s).some(i => matches[i].some(c => c.id === id));
  for (const [a, b] of expected.mustNotMerge ?? []) {
    const common = graph.concepts.filter(p => resolves(p.id, a) && resolves(p.id, b));
    if (common.length && !common.some(p => merged.has(p.id))) counts.falseMerges++;
    if (common.length) details.push(`False merge: ${a} / ${b} → ${common.map(c => c.label).join(', ')}`);
  }
  graph.concepts.forEach((c, i) => { if (predictedMatches[i].length > 1) details.push(`False merge: ${c.label} matches ${predictedMatches[i].map(e => e.label).join(', ')}`); });
  const blockInk = new Map(pages.flatMap(p => p.blocks.map(b => [`${p.id}/${b.id}`, new Set(b.strokeIds)] as const)));
  const checkProvenance = (wanted: ExpectedProvenance[], got: Provenance[]) => {
    const inkErrors = got.flatMap(p => p.strokeIds.filter(s => !blockInk.get(`${p.pageId}/${p.blockId}`)?.has(s)).map(s => `${p.pageId}/${p.blockId}:${s}`));
    const want = locations(wanted), actual = locations(got);
    return { ok: JSON.stringify(want) === JSON.stringify(actual) && !inkErrors.length, want, actual, inkErrors };
  };
  const scoreProvenance = (label: string, wanted: ExpectedProvenance[], candidates: { provenance: Provenance[] }[]) => {
    if (!candidates.length) return;
    counts.provenanceTotal++;
    const checks = candidates.map(c => checkProvenance(wanted, c.provenance));
    if (checks.some(c => c.ok)) { counts.provenanceOk++; return; }
    checks.sort((a, b) => a.want.filter(s => !a.actual.includes(s)).length + a.actual.filter(s => !a.want.includes(s)).length + a.inkErrors.length - (b.want.filter(s => !b.actual.includes(s)).length + b.actual.filter(s => !b.want.includes(s)).length + b.inkErrors.length));
    const best = checks[0];
    details.push(`Provenance mismatch: ${label}; expected ${JSON.stringify(best.want)}; got ${JSON.stringify(best.actual)}${best.inkErrors.length ? `; invalid strokes ${JSON.stringify(best.inkErrors)}` : ''}`);
  };
  expected.concepts.forEach((e, i) => {
    if (!matches[i].length) details.push(`Missing concept: ${e.label}`);
    if (matches[i].length > 1) details.push(`Duplicate concept: ${e.label} → ${matches[i].map(c => c.id).join(', ')}`);
    scoreProvenance(`concept ${e.label}`, e.provenance, matches[i]);
  });
  graph.concepts.forEach((p, i) => { if (!predictedMatches[i].length) details.push(`Extra concept: ${p.label} (${p.id})`); });
  const edgeMatches = expected.edges.map(e => graph.edges.filter(p => p.kind === e.kind && resolves(p.from, e.from) && resolves(p.to, e.to)));
  const edgeName = (e: { from: string; to: string; kind: ConceptEdgeKind }) => `${e.from} —${e.kind}→ ${e.to}`;
  counts.edgeHits = edgeMatches.filter(m => m.length).length;
  counts.edgeCorrect = graph.edges.filter(p => edgeMatches.some(m => m.includes(p))).length;
  expected.edges.forEach((e, i) => {
    if (!edgeMatches[i].length) details.push(`Missing edge: ${edgeName(e)}`);
    scoreProvenance(`edge ${edgeName(e)}`, e.provenance, edgeMatches[i]);
  });
  const conceptLabel = (id: string) => graph.concepts.find(c => c.id === id)?.label ?? id;
  graph.edges.forEach(p => { if (!edgeMatches.some(m => m.includes(p))) details.push(`Extra edge: ${edgeName({ ...p, from: conceptLabel(p.from), to: conceptLabel(p.to) })}`); });
  return { counts, details };
}
