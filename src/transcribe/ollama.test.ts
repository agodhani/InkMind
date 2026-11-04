import { afterEach, describe, expect, it, vi } from 'vitest';
import { OLLAMA_NUM_CTX, OllamaTranscriber, probeOllama } from './ollama';

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
  it('uses the native /api/chat with num_ctx, json format and raw base64 images', async () => {
    let captured: { url: string; body: Record<string, unknown> } | null = null;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      captured = { url, body: JSON.parse(String(init?.body)) as Record<string, unknown> };
      return new Response(JSON.stringify({ message: { content: '{"blocks":[{"kind":"paragraph","text":"hi","bbox":{"left":0,"top":0,"right":10,"bottom":10},"groupIndices":[0],"confidence":0.9}]}' } }));
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
    expect((c.body.options as { num_ctx: number }).num_ctx).toBe(OLLAMA_NUM_CTX);
    const msgs = c.body.messages as { role: string; content: string; images?: string[] }[];
    expect(msgs[1].images).toEqual(['BBBB', 'AAAA']);
    expect(msgs[1].content).toContain('"ex"');
  });
});
