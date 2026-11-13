import { afterEach, describe, expect, it, vi } from 'vitest';
import { OLLAMA_NUM_CTX, OllamaTranscriber, ollamaPromptStyle, ollamaTokenBudget, probeOllama } from './ollama';
import { COMPACT_SYSTEM_PROMPT, SYSTEM_PROMPT } from './prompt';
import type { TranscribeRequest } from './types';

const request: TranscribeRequest = {
  imageDataUrl: 'data:image/png;base64,AAAA', imageBounds: { left: 0, top: 0, right: 10, bottom: 10 }, imageSize: { width: 10, height: 10 },
  strokes: [], groups: [], contextText: '', pageTitle: '', profile: { glossary: [], habits: [], examples: [] },
};

function streamReply(parts: string[]): Response {
  const bytes = new TextEncoder().encode(parts.map((content) => JSON.stringify({ message: { content } })).join('\n') + '\n' + JSON.stringify({ done: true }));
  return new Response(new ReadableStream({
    start(controller) {
      // Split inside NDJSON records as well as between tokens.
      for (let i = 0; i < bytes.length; i += 17) controller.enqueue(bytes.slice(i, i + 17));
      controller.close();
    },
  }));
}

const caps: Record<string, string[] | undefined> = {
  'qwen2.5vl:3b': ['completion', 'vision'],
  'llama3.2:3b': ['completion'],
  'old-model:latest': undefined,
};

afterEach(() => vi.unstubAllGlobals());

describe('probeOllama', () => {
  it('splits pulled models by vision capability', async () => {
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: Object.keys(caps).map((name) => ({ name })) }));
      const { model } = JSON.parse(String(init?.body)) as { model: string };
      return new Response(JSON.stringify(caps[model] ? { capabilities: caps[model] } : {}));
    });
    const s = await probeOllama('http://x:11434/');
    expect(s.reachable).toBe(true);
    expect(s.models).toEqual(['qwen2.5vl:3b', 'old-model:latest']);
    expect(s.textOnly).toEqual(['llama3.2:3b']);
  });

  it('reports unreachable servers', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const s = await probeOllama('http://x:1');
    expect(s).toMatchObject({ reachable: false, models: [], textOnly: [], error: 'Failed to fetch' });
  });
});

describe('OllamaTranscriber', () => {
  it.each(['figure', 'table'])('keeps compact table words under a table block with %s fields', async (field) => {
    vi.stubGlobal('fetch', async () => streamReply([JSON.stringify({ blocks: [{ kind: 'table', groupIndices: [1, 2], [field]: { labels: ['day', 'am', 'pm'] } }] })]));
    const result = await new OllamaTranscriber().transcribe(request);
    expect(result.blocks[0]).toMatchObject({ kind: 'diagram', groupIndices: [1, 2], figure: { kind: 'table', labels: ['day', 'am', 'pm'] } });
  });
  it('preserves repeated compact name values as labels before JSON decoding', async () => {
    vi.stubGlobal('fetch', async () => streamReply(['{"blocks":[{"kind":"diagram","figure":{"names":{"size":"3b","size":"7b","size":"72b"}}}]}']));
    const result = await new OllamaTranscriber().transcribe(request);
    expect(result.blocks[0].figure!.labels).toEqual(['size', '3b', '7b', '72b']);
  });
  it('caps only compact requests, with an override for resolution experiments', () => {
    expect(new OllamaTranscriber({ model: 'qwen2.5vl:3b' }).maxImageEdge).toBe(1024);
    expect(new OllamaTranscriber({ model: 'qwen2.5vl:3b', maxImageEdge: 1280 }).maxImageEdge).toBe(1280);
    expect(new OllamaTranscriber({ model: 'qwen2.5vl:7b', maxImageEdge: 1024 }).maxImageEdge).toBeUndefined();
    expect(new OllamaTranscriber({ promptStyle: 'full' }).maxImageEdge).toBeUndefined();
    expect(() => new OllamaTranscriber({ maxImageEdge: 0 })).toThrow('positive integer');
    expect(() => new OllamaTranscriber({ maxImageEdge: NaN })).toThrow('positive integer');
  });
  it('records prompt and generation counters from the final stream chunk', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ message: { content: '{"blocks":[]}' } }) + '\n' + JSON.stringify({ done: true, prompt_eval_count: 200, prompt_eval_duration: 3000000000, eval_count: 40, eval_duration: 5000000000 }) + '\n'));
    const result = await new OllamaTranscriber().transcribe(request);
    expect(result.raw).toContain('[ollama-timing: {"prompt_eval_count":200,"prompt_eval_duration":3000000000,"eval_count":40,"eval_duration":5000000000}]');
  });
  it('uses the native /api/chat with num_ctx, json format and raw base64 images', async () => {
    let captured: { url: string; body: Record<string, unknown> } | null = null;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      captured = { url, body: JSON.parse(String(init?.body)) as Record<string, unknown> };
      return streamReply(['{"blocks":[{"kind":"paragraph","text":"hi","bbox":{"left":0,"top":0,"right":10,"bottom":10},"groupIndices":[0],"confidence":0.9}]}']);
    });
    const t = new OllamaTranscriber({ url: 'http://x:11434/', model: 'm' });
    const res = await t.transcribe({
      imageDataUrl: 'data:image/png;base64,AAAA',
      imageBounds: { left: 0, top: 0, right: 10, bottom: 10 },
      imageSize: { width: 10, height: 10 },
      strokes: [],
      groups: [],
      contextText: '',
      pageTitle: 't',
      profile: { glossary: [], habits: [], examples: [{ imageDataUrl: 'data:image/png;base64,BBBB', text: 'ex' }] },
    });
    expect(res.blocks[0].text).toBe('hi');
    const c = captured!;
    expect(c.url).toBe('http://x:11434/api/chat');
    expect(c.body.format).toBe('json');
    expect(c.body.stream).toBe(true);
    expect((c.body.options as { num_ctx: number }).num_ctx).toBe(OLLAMA_NUM_CTX);
    const msgs = c.body.messages as { role: string; content: string; images?: string[] }[];
    expect(msgs[1].images).toEqual(['BBBB', 'AAAA']);
    expect(msgs[1].content).toContain('"ex"');
  });

  it.each(['qwen2.5vl:3b', 'gemma3:4b', 'model:1b', 'model:2b', 'repo/model:3b-q4_K_M'])('selects compact for %s', (model) => {
    expect(ollamaPromptStyle(model)).toBe('compact');
  });
  it.each(['qwen2.5vl:7b', 'gemma3:12b', 'unknown', 'llama3.2-vision:11b'])('keeps full for %s', (model) => {
    expect(ollamaPromptStyle(model)).toBe('full');
  });
  it('scales and caps token budgets', () => {
    expect(ollamaTokenBudget(1)).toBe(288);
    expect(ollamaTokenBudget(20)).toBe(896);
    expect(ollamaTokenBudget(100)).toBe(2500);
  });
  it.each([undefined, 'full'] as const)('uses the selected prompt with override %s', async (promptStyle) => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.messages[0].content).toBe(promptStyle === 'full' ? SYSTEM_PROMPT : COMPACT_SYSTEM_PROMPT);
      return streamReply(['{"blocks":[]}']);
    });
    vi.stubGlobal('fetch', fetch);
    await new OllamaTranscriber({ model: 'qwen2.5vl:3b', promptStyle }).transcribe(request);
  });
  it('aborts looping streams and salvages usable blocks without retry', async () => {
    let signal: AbortSignal;
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      signal = init.signal!;
      return streamReply(['{"blocks":[{"kind":"diagram","figure":{"labels":["read"],"shapes":[', ...Array(15).fill('"box",')]);
    });
    vi.stubGlobal('fetch', fetch);
    const result = await new OllamaTranscriber().transcribe(request);
    expect(result.blocks[0].figure?.labels).toEqual(['read']);
    expect(result.raw).toContain('[loop-guard: aborted at');
    expect(signal!.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('propagates caller cancellation', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      controller.abort();
      expect(init.signal?.aborted).toBe(true);
      return streamReply(['{"blocks":[]}']);
    });
    await expect(new OllamaTranscriber().transcribe(request, controller.signal)).rejects.toThrow();
  });
  it('does not fetch when the caller already cancelled', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(new OllamaTranscriber().transcribe(request, controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('repairs a token-limited reply and accepts a final NDJSON record without newline', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ message: { content: '{"blocks":[{"kind":"paragraph","text":"café' }, done: true })));
    const result = await new OllamaTranscriber().transcribe(request);
    expect(result.blocks[0].text).toBe('café');
    expect(result.raw).not.toContain('loop-guard');
  });
  it('retains the repeat-error retry', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('{"error":"token repeat limit reached"}\n')).mockResolvedValueOnce(streamReply(['{"blocks":[]}']));
    vi.stubGlobal('fetch', fetch);
    expect((await new OllamaTranscriber().transcribe(request)).blocks).toEqual([]);
    expect(JSON.parse(fetch.mock.calls[1][1].body).options.temperature).toBe(0.5);
  });
  it.each([new Response('failure', { status: 500 }), streamReply([]), new Response('{"error":"bad model"}\n')])('handles errors and empty streams', async (response) => {
    vi.stubGlobal('fetch', async () => response);
    await expect(new OllamaTranscriber().transcribe(request)).rejects.toThrow();
  });
});
