import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DigitalBlock, Page } from '../model/page';
import { mockKbModel, modelExtractor, ollamaKbModel, openRouterKbModel, parseModelExtraction } from './modelExtractor';
import { MemoryKnowledgeStore, reviewProposal, syncPage } from './store';

const block = (id: string, text: string, kind: DigitalBlock['kind'] = 'paragraph', top = 50): DigitalBlock =>
  ({ id, text, kind, bbox: { left: 0, top, right: 100, bottom: top + 20 }, strokeIds: ['s1'], confidence: 1 });
const page = (id: string, ...blocks: DigitalBlock[]): Page => ({ id, title: '', blocks, strokes: [], createdAt: 0, updatedAt: 0 });
const output = (concepts: unknown[] = [], propositions: unknown[] = [], edges: unknown[] = []) => JSON.stringify({ concepts, propositions, edges });

describe('model KB extractor', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('adds grounded, reviewable contributions without overriding deterministic concepts or merging near misses', async () => {
    const store = new MemoryKnowledgeStore();
    const extractor = modelExtractor(mockKbModel(async () => output([
      { block: 'p', term: 'Backprop', canonical: 'Backpropagation' },
      { block: 'p', term: 'gradient', canonical: 'Gradient descent' },
      { block: 'p', term: 'gradients' },
      { block: 'f', term: 'Reward hacking' },
      { block: 'f', term: 'Off-policy evaluation' },
      { block: 'invalid', term: 'Backprop' },
      { block: 'p', term: 'policy ratio' },
    ], [
      { block: 'p', claim: 'Backprop computes gradients.', subject: 'Backprop', quote: 'Backprop computes gradients' },
      { block: 'f', claim: 'Reward models can be exploited.', quote: 'an invented quotation' },
      { block: 'f', claim: 'Policies exploit flaws in reward models.', quote: 'Reward hacking: policies exploit flaws.' },
    ], [
      { block: 'p', from: 'Backprop', to: 'gradients', kind: 'supports', quote: 'Backprop computes gradients' },
      { block: 'p', from: 'Backprop', to: 'Reward hacking', kind: 'supports', quote: 'Backprop computes gradients' },
    ])));
    const p = page('p1', block('h', 'Backpropagation', 'heading', 0), block('p', 'Backprop computes gradients; [[Gradient descent]] uses a gradient.'), block('f', 'Reward hacking: policies exploit flaws.', 'footnote_def', 100));
    const graph = await syncPage(store, p, { glossary: [], extractor });
    const backprop = graph.concepts.find(c => c.label === 'Backpropagation')!;
    expect(backprop).toMatchObject({ aliases: ['Backprop'], provenance: [{ blockId: 'h', strokeIds: ['s1'] }, { pageId: 'p1', blockId: 'p', extractor: 'model:mock', strokeIds: [] }] });
    expect(backprop.status).toBeUndefined();
    expect(graph.concepts.map(c => c.label)).toEqual(['Backpropagation', 'gradient', 'Gradient descent', 'Policies exploit flaws in reward models.', 'Reward hacking']);
    expect(graph.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'alias', label: 'Backprop', origin: 'model', status: 'proposed', conceptId: backprop.id }),
      expect.objectContaining({ kind: 'proposition', label: 'Backprop computes gradients.', conceptId: backprop.id }),
    ]));
    const edge = graph.edges.find(e => e.kind === 'supports')!;
    expect(edge).toMatchObject({ from: backprop.id, to: 'c_gradient', origin: 'model', status: 'proposed', provenance: [{ blockId: 'p', surface: 'Backprop computes gradients' }] });
    expect(graph.edges.filter(e => e.kind === 'supports')).toHaveLength(1);
    const accepted = await reviewProposal(store, graph.proposals!.find(a => a.edgeId === edge.id)!.id, 'accepted');
    expect(accepted.edges.find(e => e.id === edge.id)?.status).toBe('accepted');
    expect(await syncPage(store, p, { glossary: [], extractor })).toEqual(accepted);
  });

  it('sends only changed text, includes existing terms, replays, and removes stale provenance', async () => {
    const store = new MemoryKnowledgeStore();
    await syncPage(store, page('prev', block('h', 'KL divergence', 'heading')), { glossary: [] });
    const complete = vi.fn(async (_system: string, user: string) => {
      const { known, blocks } = JSON.parse(user);
      expect(known).toContainEqual(['KL divergence']);
      return output(blocks.map((b: DigitalBlock) => ({ block: b.id, term: b.text })));
    });
    const extractor = modelExtractor(mockKbModel(complete));
    const first = page('p', block('a', 'KL penalty'), block('b', 'Entropy bonus', 'paragraph', 90));
    const before = await syncPage(store, first, { glossary: [], extractor });
    expect(await syncPage(store, first, { glossary: [], extractor })).toEqual(before);
    expect(complete).toHaveBeenCalledTimes(1);
    const changed = page('p', block('a', 'KL penalty'), block('b', 'Entropy regularization', 'paragraph', 90));
    const after = await syncPage(store, changed, { glossary: [], extractor });
    expect(complete).toHaveBeenCalledTimes(2);
    expect(JSON.parse(complete.mock.calls[1][1]).blocks.map((b: DigitalBlock) => b.id)).toEqual(['b']);
    expect(after.concepts.map(c => c.label)).toEqual(['Entropy regularization', 'KL divergence', 'KL penalty']);
    const previous = (await store.listExtractions()).find(e => e.pageId === 'p')!;
    const saved = await extractor.extract(changed, { glossary: [], previous, graph: after });
    expect(new Set(parseModelExtraction(saved.raw).model?.suggestions.map(s => JSON.stringify(s)))).toEqual(new Set(previous.model?.suggestions.map(s => JSON.stringify(s))));
    const removed = await syncPage(store, page('p'), { glossary: [], extractor });
    expect(removed.concepts.map(c => c.label)).toEqual(['KL divergence']);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('uses a grounded claim to link a distinctive truncation even when the terms array omits it', async () => {
    const store = new MemoryKnowledgeStore();
    const extractor = modelExtractor(mockKbModel(async () => output([], [{
      block: 'p', claim: 'Backpropagation applies the chain rule.', quote: 'Backprop applies the chain rule.',
    }])));
    const p = page('p1', block('h', 'Backpropagation', 'heading', 0), block('p', 'Backprop applies the chain rule.'));
    const graph = await syncPage(store, p, { glossary: [], extractor });
    expect(graph.concepts).toEqual([expect.objectContaining({ label: 'Backpropagation', aliases: ['Backprop'] })]);
    expect(graph.proposals).toEqual([
      expect.objectContaining({ kind: 'alias', label: 'Backprop', provenance: [expect.objectContaining({ blockId: 'p', surface: 'Backprop' })] }),
      expect.objectContaining({ kind: 'proposition', conceptId: 'c_backpropagation' }),
    ]);
  });

  it('does not split a technical word or accept a word prefix as a concept', async () => {
    const chunks: string[] = [];
    const extractor = modelExtractor(mockKbModel(async (_system, user) => {
      chunks.push(...JSON.parse(user).blocks.map((b: DigitalBlock) => b.text));
      return output([{ block: 'b', term: 'gradient' }, { block: 'b', term: 'gradientless' }]);
    }));
    const input = page('p', block('b', 'x '.repeat(1746) + 'gradientless methods work.'));
    const { raw } = await extractor.extract(input, { glossary: [] });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).not.toContain('gradient');
    expect(chunks[1]).toContain('gradientless');
    expect(extractor.parse(raw).model?.suggestions).toEqual([
      expect.objectContaining({ kind: 'concept', term: 'gradientless' }),
    ]);
  });

  it('overlaps chunks across a multiword term and validates evidence against the full block', async () => {
    const chunks: string[] = [];
    const quote = 'contrastive learning improves retrieval';
    const extractor = modelExtractor(mockKbModel(async (_system, user) => {
      chunks.push(...JSON.parse(user).blocks.map((b: DigitalBlock) => b.text));
      return chunks.length === 1 ? output([{ block: 'b', term: 'contrastive learning' }], [
        { block: 'b', claim: 'Contrastive learning improves retrieval.', quote },
      ]) : output();
    }));
    const input = page('p', block('b', 'x '.repeat(1744) + quote + '.'));
    const { raw } = await extractor.extract(input, { glossary: [] });
    expect(chunks).toHaveLength(2);
    expect(chunks.every(chunk => chunk.length <= 3500)).toBe(true);
    expect(chunks[0]).toMatch(/contrastive$/);
    expect(chunks[1]).toContain(quote);
    expect(extractor.parse(raw).model?.suggestions).toEqual([
      expect.objectContaining({ kind: 'concept', term: 'contrastive learning' }),
      expect.objectContaining({ kind: 'proposition', prov: expect.objectContaining({ blockId: 'b', surface: quote }) }),
    ]);
  });

  it('requests Ollama native text chat and shares the loop guard', async () => {
    const payload = output();
    const fetch = vi.fn(async (_url: string, _req: RequestInit) => new Response([
      JSON.stringify({ message: { content: payload } }),
      JSON.stringify({ message: { content: ' repeat me'.repeat(6) } }),
      JSON.stringify({ error: 'should not be consumed' }),
    ].join('\n')));
    vi.stubGlobal('fetch', fetch);
    await expect(ollamaKbModel({ numCtx: 9000 }).complete('system', 'text')).resolves.toBe(payload);
    const [url, req] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(JSON.parse(req.body as string)).toEqual(expect.objectContaining({
      stream: true, options: expect.objectContaining({ num_ctx: 9000 }),
      messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'text' }],
    }));
  });

  it('restricts OpenRouter to free text routes and backs off after HTTP 429', async () => {
    vi.useFakeTimers();
    expect(() => openRouterKbModel('test-key', 'paid/model')).toThrow('free OpenRouter route');
    const fetch = vi.fn(async (_url: string, _req: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: output() } }] })))
      .mockResolvedValueOnce(new Response('busy', { status: 429 }));
    vi.stubGlobal('fetch', fetch);
    const result = openRouterKbModel('test-key').complete('system', 'text');
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toBe(output());
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, req] = fetch.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(JSON.parse(req.body as string)).toMatchObject({ model: 'openrouter/free', messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'text' }] });
  });
});
