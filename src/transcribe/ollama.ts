import { OpenAICompatTranscriber } from './openaiCompat';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5vl:3b';
/** Vision-capable models worth suggesting in the UI (`ollama pull <name>`). */
export const OLLAMA_VISION_MODELS = ['qwen2.5vl:3b', 'qwen2.5vl:7b', 'gemma3:4b', 'gemma3:12b', 'llama3.2-vision:11b', 'minicpm-v:8b'];

export interface OllamaOptions {
  url?: string;
  model?: string;
}

/**
 * Local transcriber via Ollama's OpenAI-compatible endpoint. No key, no network,
 * slower (CPU) but free to iterate on. Few-shot examples are capped at 2: small
 * local models lose the plot with many images in one turn.
 */
export class OllamaTranscriber extends OpenAICompatTranscriber {
  constructor(opts: OllamaOptions = {}) {
    super({
      provider: 'ollama',
      baseUrl: `${(opts.url ?? DEFAULT_OLLAMA_URL).replace(/\/$/, '')}/v1`,
      model: opts.model ?? DEFAULT_OLLAMA_MODEL,
      maxExamples: 2,
    });
  }
}

export interface OllamaStatus {
  reachable: boolean;
  /** Pulled models that can take images (per `/api/show` capabilities). */
  models: string[];
  /** Pulled models that are text-only. */
  textOnly: string[];
  error?: string;
}

/**
 * Probe an Ollama server and list pulled models, split by vision capability.
 * `/api/show` reports `capabilities` (Ollama ≥ 0.6); if it doesn't, the model is
 * assumed to be vision-capable rather than hidden.
 */
export async function probeOllama(url = DEFAULT_OLLAMA_URL, signal?: AbortSignal): Promise<OllamaStatus> {
  const base = url.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/tags`, { signal });
    if (!res.ok) return { reachable: false, models: [], textOnly: [], error: `HTTP ${res.status}` };
    const data = (await res.json()) as { models?: { name?: string }[] };
    const names = (data.models ?? []).map((m) => m.name ?? '').filter(Boolean);
    const vision = await Promise.all(names.map((name) => supportsVision(base, name, signal)));
    return {
      reachable: true,
      models: names.filter((_, i) => vision[i]),
      textOnly: names.filter((_, i) => !vision[i]),
    };
  } catch (e) {
    return { reachable: false, models: [], textOnly: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function supportsVision(base: string, model: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/show`, { method: 'POST', body: JSON.stringify({ model }), signal });
    if (!res.ok) return true;
    const data = (await res.json()) as { capabilities?: string[] };
    return !Array.isArray(data.capabilities) || data.capabilities.includes('vision');
  } catch {
    return true;
  }
}
