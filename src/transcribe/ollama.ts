import type { TranscribeRequest, TranscribeResult, Transcriber } from './types';
import { COMPACT_SYSTEM_PROMPT, ModelOutputError, SYSTEM_PROMPT, buildUserPrompt, extractJson } from './prompt';
import { looksDegenerate, normaliseBlocks, pickSaner } from './openaiCompat';
import { closeJsonPrefix, detectLoop } from './loopGuard';
import { preserveCompactNameWords } from './figure';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5vl:3b';
/** Vision-capable models worth suggesting in the UI (`ollama pull <name>`). */
export const OLLAMA_VISION_MODELS = ['qwen2.5vl:3b', 'qwen2.5vl:7b', 'gemma3:4b', 'gemma3:12b', 'llama3.2-vision:11b', 'minicpm-v:8b'];

export interface OllamaOptions {
  url?: string;
  model?: string;
  /** Context window to request; Ollama's default 4k is too small for a page image + prompt. */
  numCtx?: number;
  promptStyle?: 'full' | 'compact';
  maxImageEdge?: number;
}

export function ollamaPromptStyle(model: string): 'full' | 'compact' {
  const size = model.match(/(?:^|[:/_-])(\d+(?:\.\d+)?)b(?:$|[-_])/i);
  return size && Number(size[1]) <= 4 ? 'compact' : 'full';
}

export function ollamaTokenBudget(groups: number): number {
  // A short base plus 32 tokens per ink group keeps crops cheap while allowing full pages up to 2500.
  return Math.min(2500, 256 + Math.max(0, groups) * 32);
}

export const OLLAMA_NUM_CTX = 16384;
const MAX_EXAMPLES = 2;

/**
 * Local transcriber via Ollama's native `/api/chat` (not the OpenAI shim) so we can set
 * `num_ctx`: with the default 4096 a full page image plus the prompt is rejected with 400.
 * No key, no network, slower (CPU) but free to iterate on. Few-shot examples are capped
 * at 2: small local models lose the plot with many images in one turn.
 */
export class OllamaTranscriber implements Transcriber {
  readonly name: string;
  readonly maxImageEdge?: number;
  private readonly url: string;
  private readonly model: string;
  private readonly numCtx: number;
  private readonly promptStyle: 'full' | 'compact';

  constructor(opts: OllamaOptions = {}) {
    this.url = (opts.url ?? DEFAULT_OLLAMA_URL).replace(/\/$/, '');
    this.model = opts.model ?? DEFAULT_OLLAMA_MODEL;
    this.numCtx = opts.numCtx ?? OLLAMA_NUM_CTX;
    this.promptStyle = opts.promptStyle ?? ollamaPromptStyle(this.model);
    this.maxImageEdge = this.promptStyle === 'compact' ? opts.maxImageEdge ?? 1024 : undefined;
    if (this.maxImageEdge !== undefined && (!Number.isInteger(this.maxImageEdge) || this.maxImageEdge <= 0)) throw new RangeError('maxImageEdge must be a positive integer');
    this.name = `ollama:${this.model}`;
  }

  async transcribe(req: TranscribeRequest, signal?: AbortSignal): Promise<TranscribeResult> {
    const started = performance.now();
    try {
      const first = await this.request(req, 0.1, signal);
      if (!looksDegenerate(first.blocks, req)) return first;
      const second = await this.request(req, 0.5, signal);
      return { ...pickSaner(first, second, req), durationMs: performance.now() - started };
    } catch (e) {
      // Small models sometimes degenerate into a repeating token loop on short crops;
      // Ollama aborts with "token repeat limit reached". One retry with more sampling noise usually escapes it.
      if (!/repeat/i.test((e as Error).message)) throw e;
      const r = await this.request(req, 0.5, signal);
      return { ...r, durationMs: performance.now() - started };
    }
  }

  private async request(req: TranscribeRequest, temperature: number, signal?: AbortSignal): Promise<TranscribeResult> {
    const started = performance.now();
    const examples = req.profile.examples.slice(0, MAX_EXAMPLES);
    const images = [...examples.map((e) => stripDataUrl(e.imageDataUrl)), stripDataUrl(req.imageDataUrl)];
    const exampleText = examples.length
      ? `The first ${examples.length} image(s) are samples of this writer's handwriting with verified transcriptions:\n` +
        examples.map((e, i) => `${i + 1}. "${e.text}"`).join('\n') +
        `\nThe LAST image is the region to transcribe.\n\n`
      : '';

    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.throwIfAborted();
    signal?.addEventListener('abort', abort, { once: true });
    let raw = '';
    let guardedAt: number | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(`${this.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: true,
          format: 'json',
          options: { temperature, seed: 7, num_ctx: this.numCtx, num_predict: ollamaTokenBudget(req.groups.length) },
          messages: [
            { role: 'system', content: this.promptStyle === 'compact' ? COMPACT_SYSTEM_PROMPT : SYSTEM_PROMPT },
            { role: 'user', content: exampleText + buildUserPrompt(req, this.promptStyle), images },
          ],
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ollama ${response.status}: ${body.slice(0, 300)}`);
      }
      if (!response.body) throw new Error('Ollama response has no stream');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let done = false;
      let timing: Record<string, number | undefined> | undefined;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string; done?: boolean; prompt_eval_count?: number; prompt_eval_duration?: number; eval_count?: number; eval_duration?: number };
        if (chunk.done) timing = { prompt_eval_count: chunk.prompt_eval_count, prompt_eval_duration: chunk.prompt_eval_duration, eval_count: chunk.eval_count, eval_duration: chunk.eval_duration };
        if (chunk.error) throw new Error(chunk.error);
        raw += chunk.message?.content ?? '';
        const loop = detectLoop(raw);
        if (loop) {
          guardedAt = raw.length;
          raw = closeJsonPrefix(raw.slice(0, loop.keepUntil));
          controller.abort();
          done = true;
        } else if (chunk.done) done = true;
      };
      while (!done) {
        const part = await reader.read();
        pending += decoder.decode(part.value, { stream: !part.done });
        let newline: number;
        while (!done && (newline = pending.indexOf('\n')) >= 0) {
          consume(pending.slice(0, newline));
          pending = pending.slice(newline + 1);
        }
        if (part.done) {
          if (!done) consume(pending);
          break;
        }
      }
      signal?.throwIfAborted();
      const parsed = closeJsonPrefix(raw);
      const debugRaw = raw + (guardedAt === undefined ? '' : `\n[loop-guard: aborted at ${guardedAt} chars]`) + (timing ? `\n[ollama-timing: ${JSON.stringify(timing)}]` : '') + `\n[ollama-input: ${JSON.stringify({ imageSize: req.imageSize, promptStyle: this.promptStyle, maxImageEdge: this.maxImageEdge })}]`;
      let blocks: TranscribeResult['blocks'];
      try { blocks = normaliseBlocks(extractJson(this.promptStyle === 'compact' ? preserveCompactNameWords(parsed) : parsed)); } catch (e) {
        if (e instanceof ModelOutputError) throw new ModelOutputError(e.message, debugRaw);
        throw e;
      }
      return { blocks, model: this.model, durationMs: performance.now() - started, raw: debugRaw };
    } finally {
      signal?.removeEventListener('abort', abort);
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
  }
}

function stripDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf(',');
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
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
