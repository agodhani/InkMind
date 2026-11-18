import { describe, expect, it } from 'vitest';
import type { Page } from '../model/page';
import type { Concept, KbGraph, Provenance } from './model';
import { emptyCounts, scoreGraph, scorerKey } from './score';
import type { AnswerKey } from './score';
import { deterministicExtractor } from './extractor';

const prov: Provenance = { pageId: 'p', blockId: 'b', strokeIds: ['s'], extractor: 'test', surface: 'Policy' };
const page: Page = { id: 'p', title: '', createdAt: 0, updatedAt: 0, strokes: [], blocks: [{ id: 'b', kind: 'heading', text: 'Policy', strokeIds: ['s'], bbox: { left: 0, top: 0, right: 1, bottom: 1 }, confidence: 1 }] };
const concept = (id: string, label: string, aliases: string[] = []): Concept => ({ id, label, aliases, provenance: [prov] });
const expected: AnswerKey = { concepts: [{ label: 'Policy', aliases: ['Strategy'], provenance: [prov] }, { label: 'Reward', provenance: [prov] }], edges: [{ from: 'Strategy', to: 'Reward', kind: 'follows', provenance: [prov] }], mustNotMerge: [['Policy', 'Reward']] };
const graph = (): KbGraph => ({ concepts: [concept('a', 'Strategy'), concept('b', 'Reward')], edges: [{ id: 'edge', from: 'a', to: 'b', kind: 'follows', labels: ['ignored'], provenance: [prov] }] });

describe('independent KB scoring', () => {
  it('normalizes only case, whitespace, hyphens and outer punctuation', () => {
    expect(scorerKey(' **POLICY--Gradient! ')).toBe('policy gradient');
    expect(scorerKey('policies')).not.toBe(scorerKey('policy'));
    expect(scorerKey('Q/function')).not.toBe(scorerKey('Q function'));
  });
  it('scores alias endpoints, labels independently, and exact provenance sets', () => {
    const scored = scoreGraph(graph(), expected, [page]);
    expect(scored.counts).toEqual({ notebooks: 1, expectedConcepts: 2, predictedConcepts: 2, conceptHits: 2, conceptCorrect: 2, expectedEdges: 1, predictedEdges: 1, edgeHits: 1, edgeCorrect: 1, duplicates: 0, falseMerges: 0, provenanceOk: 3, provenanceTotal: 3, idempotent: 1 });
    expect(scored.details).toEqual([]);
  });
  it('reports misses, extras, direction and edge kind errors', () => {
    const g = graph(); g.concepts.push(concept('c', 'Unknown'));
    g.edges[0].from = 'b'; g.edges[0].to = 'a';
    const result = scoreGraph(g, expected, [page], false);
    expect(result.counts).toMatchObject({ conceptCorrect: 2, predictedConcepts: 3, edgeHits: 0, edgeCorrect: 0, idempotent: 0 });
    expect(result.details).toContain('Missing edge: Strategy —follows→ Reward');
    expect(result.details).toContain('Extra concept: Unknown (c)');
    g.edges[0].from = 'a'; g.edges[0].to = 'b'; g.edges[0].kind = 'supports';
    expect(scoreGraph(g, expected, [page]).counts.edgeHits).toBe(0);
    expect(scoreGraph({ concepts: [], edges: [] }, expected, []).details).toContain('Missing concept: Policy');
  });
  it('counts duplicates and false merges once, not again for mustNotMerge pairs', () => {
    const g = graph();
    g.concepts.push(concept('c', 'Policy'));
    expect(scoreGraph(g, expected, [page]).counts.duplicates).toBe(1);
    g.concepts = [concept('merged', 'Policy', ['Reward'])]; g.edges = [];
    expect(scoreGraph(g, expected, [page]).counts).toMatchObject({ conceptHits: 2, conceptCorrect: 1, falseMerges: 1 });
  });
  it('chooses best provenance among duplicate predictions and rejects foreign ink', () => {
    const g = graph(); g.concepts[0].provenance = [{ ...prov, blockId: 'wrong' }];
    g.concepts.push(concept('c', 'Policy'));
    expect(scoreGraph(g, expected, [page]).counts.provenanceOk).toBe(3);
    g.concepts.pop();
    g.concepts[1].provenance = [{ ...prov, strokeIds: ['foreign'] }];
    const result = scoreGraph(g, expected, [page]);
    expect(result.counts).toMatchObject({ provenanceOk: 1, provenanceTotal: 3 });
    expect(result.details.join('\n')).toContain('invalid strokes ["p/b:foreign"]');
    expect(result.details.join('\n')).toContain('expected ["p/b"]; got ["p/wrong"]');
  });
  it('treats provenance as sets but rejects extra occurrences', () => {
    const g = graph(); g.concepts[0].provenance.push(prov);
    expect(scoreGraph(g, expected, [page]).counts.provenanceOk).toBe(3);
    g.concepts[0].provenance.push({ ...prov, blockId: 'extra' });
    expect(scoreGraph(g, expected, [page]).counts.provenanceOk).toBe(2);
  });
  it('handles empty graphs and answer keys', () => {
    expect(scoreGraph({ concepts: [], edges: [] }, { concepts: [], edges: [] }, []).counts).toEqual({ ...emptyCounts(), notebooks: 1, idempotent: 1 });
  });
});

describe('deterministic extractor replay contract', () => {
  it('round-trips extraction JSON', async () => {
    const { raw } = await deterministicExtractor.extract(page, { glossary: [] });
    expect(deterministicExtractor.parse(raw)).toMatchObject({ pageId: 'p', extractor: 'deterministic' });
  });
  it.each(['{', '{}', 'null'])('rejects invalid raw output %s', raw => expect(() => deterministicExtractor.parse(raw)).toThrow());
});
