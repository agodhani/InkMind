import { describe, expect, it } from 'vitest';
import type { DigitalBlock, Page } from '../model/page';
import { extractPage } from './extract';
import { buildGraph } from './graph';
import { MemoryKnowledgeStore, removePage, syncPage } from './store';

const page = (id: string, blocks: Partial<DigitalBlock>[]): Page => ({ id, title: '', strokes: [], createdAt: 0, updatedAt: 0, blocks: blocks.map((b, i) => ({ id: `b${i}`, kind: 'paragraph', text: '', bbox: { left: 0, top: i * 40, right: 600, bottom: i * 40 + 30 }, confidence: 1, strokeIds: [], ...b })) });
const extract = (p: Page) => extractPage(p, { glossary: [] });

describe('graph merge', () => {
  it('merges cross-page aliases, unions edge provenance and remains order independent', () => {
    const a = extract(page('a', [{ kind: 'heading', text: 'Proximal Policy Optimization (PPO)' }, { text: '[[Reward]] [[Reward]]' }]));
    const b = extract(page('b', [{ kind: 'heading', text: 'PPO' }, { text: '[[Reward]]' }]));
    const graph = buildGraph([a, b]);
    expect(graph).toEqual(buildGraph([b, a]));
    expect(graph.concepts).toHaveLength(2);
    const concept = graph.concepts.find(c => c.label === 'Proximal Policy Optimization')!;
    expect(concept.aliases).toEqual(['PPO']);
    expect(new Set(concept.provenance.map(p => p.pageId))).toEqual(new Set(['a', 'b']));
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].provenance.map(p => p.pageId)).toEqual(['a', 'b']);
  });
  it('selects frequent surfaces before heading preference and earliest block', () => {
    const a = extract(page('a', [{ kind: 'heading', text: 'Policy' }, { text: '[[Policies]]' }, { text: '[[Policies]]' }]));
    expect(buildGraph([a]).concepts[0].label).toBe('Policies');
    expect(buildGraph([extract(page('a', [{ text: '[[Policies]]' }, { kind: 'heading', text: 'Policy' }]))]).concepts[0].label).toBe('Policy');
  });
  it('keeps near misses distinct and never creates concepts from mention-only terms', () => {
    const a = extract(page('a', ['policy', 'policy gradient', 'RLHF', 'RLVR', 'Q function', 'value function'].map(text => ({ kind: 'heading', text }))));
    a.terms.push({ term: 'Unknown', defines: false, prov: { pageId: 'a', blockId: 'unknown', strokeIds: [], extractor: 'det:mention', surface: 'Unknown' } });
    expect(buildGraph([a]).concepts).toHaveLength(6);
  });
  it('scans known terms and aliases with longest non-overlapping whole-token matches', () => {
    const definitions = extract(page('a', [{ text: '[[policy]] [[policy gradient]] [[Proximal Policy Optimization|PPO]]' }]));
    const text = extract(page('b', [{ kind: 'heading', text: 'Learning' }, { text: 'Policy gradients and PPO improve policies, not policyholders. PPO.' }]));
    const graph = buildGraph([definitions, text]);
    const mentions = graph.concepts.flatMap(c => c.provenance.filter(p => p.extractor === 'det:mention').map(p => [c.label, p.surface]));
    expect(mentions).toEqual(expect.arrayContaining([['policy gradient', 'Policy gradients'], ['policy', 'policies'], ['Proximal Policy Optimization', 'PPO']]));
    expect(mentions).toHaveLength(3);
    expect(graph.edges.filter(e => e.kind === 'mentions')).toHaveLength(3);
    expect(graph.concepts.flatMap(c => c.provenance).filter(p => p.pageId === 'a' && p.extractor === 'det:mention')).toEqual([]);
  });
  it('does not scan inside longer words or create unresolved/self edges', () => {
    const a = extract(page('a', [{ kind: 'heading', text: 'Policy' }, { text: 'policyholders' }]));
    a.relations.push({ from: 'Policy', to: 'Unknown', kind: 'supports', prov: a.terms[0].prov }, { from: 'Policy', to: 'Policies', kind: 'mentions', prov: a.terms[0].prov });
    const graph = buildGraph([a]);
    expect(graph.edges).toEqual([]);
    expect(graph.concepts[0].provenance).toHaveLength(1);
    expect(buildGraph([])).toEqual({ concepts: [], edges: [] });
  });
  it('has stable fresh rebuild ids and reuses previous ids after a label changes', () => {
    const a = extract(page('a', [{ kind: 'heading', text: 'Optimization (PPO)' }]));
    const first = buildGraph([a]);
    expect(buildGraph([a])).toEqual(first);
    const b = extract(page('b', [{ kind: 'heading', text: 'PPO' }, { text: '[[PPO]]' }]));
    const next = buildGraph([a, b], first);
    expect(next.concepts[0].label).toBe('PPO');
    expect(next.concepts[0].id).toBe(first.concepts[0].id);
  });
  it('excludes link contents and partial headings and prefers longest known mentions', () => {
    const definitions = extract(page('a', [{ text: '[[advantage]] [[gradient]] [[gradient descent]] [[stochastic gradient descent]]' }]));
    const scanned = extract(page('b', [
      { kind: 'heading', text: 'Advantage function' },
      { text: '[[stochastic gradient descent]]' },
      { text: 'Stochastic gradient descent works.' },
    ]));
    const graph = buildGraph([definitions, scanned]);
    expect(graph.concepts.flatMap(c => c.provenance.filter(p => p.extractor === 'det:mention').map(p => [c.label, p.blockId]))).toEqual([['stochastic gradient descent', 'b2']]);
  });
});

describe('knowledge synchronization', () => {
  it('is deep-equal on resync and removes definitions on edit/delete but preserves other pages', async () => {
    const store = new MemoryKnowledgeStore(), opts = { glossary: [] };
    const a = page('a', [{ kind: 'heading', text: 'Policy' }, { text: '[[Reward]]' }]);
    const first = await syncPage(store, a, opts);
    expect(await syncPage(store, a, opts)).toEqual(first);
    await syncPage(store, page('b', [{ text: 'Policies and rewards.' }]), opts);
    expect((await syncPage(store, page('a', []), opts)).concepts).toEqual([]);
    await syncPage(store, a, opts);
    await syncPage(store, page('c', [{ kind: 'heading', text: 'Policy' }]), opts);
    const edited = await syncPage(store, page('a', []), opts);
    expect(edited.concepts.map(c => c.label)).toEqual(['Policy']);
    expect(edited.concepts[0].provenance.map(p => p.pageId)).toEqual(['b', 'c']);
    expect(await removePage(store, 'c')).toEqual({ concepts: [], edges: [] });
    expect(await removePage(store, 'missing')).toEqual({ concepts: [], edges: [] });
    await store.clear();
    expect(await store.listExtractions()).toEqual([]);
  });
  it('accepts async extractors and leaves state unchanged on extraction errors', async () => {
    const store = new MemoryKnowledgeStore(), p = page('a', [{ kind: 'heading', text: 'Policy' }]);
    const graph = await syncPage(store, p, { glossary: [], extract: async p => extract(p) });
    await expect(syncPage(store, p, { glossary: [], extract: () => { throw new Error('invalid extraction'); } })).rejects.toThrow('invalid extraction');
    expect(await store.loadGraph()).toEqual(graph);
    graph.concepts.length = 0;
    expect((await store.loadGraph()).concepts).toHaveLength(1);
  });
});
