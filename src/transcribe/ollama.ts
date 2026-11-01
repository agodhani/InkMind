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
  models: string[];
  error?: string;
}

/** Probe an Ollama server and list the models it has pulled. */
export async function probeOllama(url = DEFAULT_OLLAMA_URL, signal?: AbortSignal): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/tags`, { signal });
    if (!res.ok) return { reachable: false, models: [], error: `HTTP ${res.status}` };
    const data = (await res.json()) as { models?: { name?: string }[] };
    return { reachable: true, models: (data.models ?? []).map((m) => m.name ?? '').filter(Boolean) };
  } catch (e) {
    return { reachable: false, models: [], error: e instanceof Error ? e.message : String(e) };
  }
}
