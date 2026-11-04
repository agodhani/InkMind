import type { RawBlock, TranscribeRequest, TranscribeResult, Transcriber } from './types';
import { BLOCK_KINDS, SYSTEM_PROMPT, buildUserPrompt, extractJson } from './prompt';
import type { BlockKind } from '../model/page';

export interface OpenAICompatOptions {
  /** Base URL up to and including `/v1`, e.g. `https://openrouter.ai/api/v1` or `http://localhost:11434/v1`. */
  baseUrl: string;
  model: string;
  apiKey?: string;
  headers?: Record<string, string>;
  /** Few-shot handwriting examples to send (0 disables; small local models get confused by many images). */
  maxExamples?: number;
  /** Display name prefix, e.g. "openrouter" or "ollama". */
  provider: string;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

/** Transcriber for any OpenAI-compatible chat/completions endpoint with vision support. */
export class OpenAICompatTranscriber implements Transcriber {
  readonly name: string;
  private readonly opts: OpenAICompatOptions;

  constructor(opts: OpenAICompatOptions) {
    this.opts = opts;
    this.name = `${opts.provider}:${opts.model}`;
  }

  async transcribe(req: TranscribeRequest, signal?: AbortSignal): Promise<TranscribeResult> {
    const started = performance.now();
    const { baseUrl, model, apiKey, maxExamples = 6 } = this.opts;

    const userContent: ContentPart[] = [];
    for (const ex of req.profile.examples.slice(0, maxExamples)) {
      userContent.push({ type: 'text', text: `Example of this writer's handwriting; verified transcription: "${ex.text}"` });
      userContent.push({ type: 'image_url', image_url: { url: ex.imageDataUrl, detail: 'low' } });
    }
    userContent.push({ type: 'text', text: buildUserPrompt(req) });
    userContent.push({ type: 'image_url', image_url: { url: req.imageDataUrl, detail: 'high' } });

    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...this.opts.headers };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 2500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`${this.opts.provider} ${response.status}: ${body.slice(0, 300)}`);
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string | ContentPart[] } }[] };
    const content = data.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : (content ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('');
    const blocks = normaliseBlocks(extractJson(text));
    return { blocks, model, durationMs: performance.now() - started, raw: text };
  }
}

export function normaliseBlocks(json: unknown): RawBlock[] {
  const root = (json ?? {}) as { blocks?: unknown };
  const list = Array.isArray(root.blocks) ? root.blocks : Array.isArray(json) ? json : [];
  const out: RawBlock[] = [];
  for (const item of list as Record<string, unknown>[]) {
    if (!item || typeof item !== 'object') continue;
    const kind = (BLOCK_KINDS as string[]).includes(String(item.kind)) ? (item.kind as BlockKind) : 'unknown';
    const text = typeof item.text === 'string' ? item.text : '';
    if (!text.trim() && kind !== 'diagram') continue;
    const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    const rawBox = item.bbox;
    let b: Record<string, unknown> = Array.isArray(rawBox)
      ? { left: rawBox[0], top: rawBox[1], right: rawBox[2], bottom: rawBox[3] }
      : ((rawBox ?? {}) as Record<string, unknown>);
    // Some models nest the other fields inside bbox, or put the whole [l,t,r,b] box in each bbox field.
    for (const key of ['groupIndices', 'confidence', 'marker', 'level'] as const) if (item[key] === undefined && b[key] !== undefined) item[key] = b[key];
    if (Array.isArray(b.left) && b.left.length === 4) b = { left: b.left[0], top: b.left[1], right: b.left[2], bottom: b.left[3] };
    out.push({
      kind,
      text,
      bbox: { left: num(b.left), top: num(b.top), right: num(b.right), bottom: num(b.bottom) },
      groupIndices: Array.isArray(item.groupIndices) ? item.groupIndices.filter((n): n is number => typeof n === 'number') : [],
      confidence: num(item.confidence, 0.5),
      marker: typeof item.marker === 'string' && item.marker ? item.marker : undefined,
      level: typeof item.level === 'number' ? item.level : undefined,
    });
  }
  return out;
}
