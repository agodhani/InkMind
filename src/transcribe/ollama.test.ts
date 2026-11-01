import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeOllama } from './ollama';

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
