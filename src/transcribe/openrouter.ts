import type { RawBlock, TranscribeRequest, TranscribeResult, Transcriber } from './types';
import { BLOCK_KINDS, SYSTEM_PROMPT, buildUserPrompt, extractJson } from './prompt';
import type { BlockKind } from '../model/page';

export const DEFAULT_VISION_MODEL = 'google/gemini-2.5-flash';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterOptions {
  apiKey: string;
  model?: string;
  siteUrl?: string;
  siteName?: string;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export class OpenRouterTranscriber implements Transcriber {
  readonly name: string;
  private readonly opts: OpenRouterOptions;

  constructor(opts: OpenRouterOptions) {
    this.opts = opts;
    this.name = `openrouter:${opts.model ?? DEFAULT_VISION_MODEL}`;
  }

  async transcribe(req: TranscribeRequest, signal?: AbortSignal): Promise<TranscribeResult> {
    const started = performance.now();
    const model = this.opts.model ?? DEFAULT_VISION_MODEL;

    const userContent: ContentPart[] = [];
    for (const ex of req.profile.examples.slice(0, 6)) {
      userContent.push({ type: 'text', text: `Example of this writer's handwriting; verified transcription: "${ex.text}"` });
      userContent.push({ type: 'image_url', image_url: { url: ex.imageDataUrl, detail: 'low' } });
    }
    userContent.push({ type: 'text', text: buildUserPrompt(req) });
    userContent.push({ type: 'image_url', image_url: { url: req.imageDataUrl, detail: 'high' } });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.opts.siteUrl) headers['HTTP-Referer'] = this.opts.siteUrl;
    if (this.opts.siteName) headers['X-Title'] = this.opts.siteName;

    const response = await fetch(ENDPOINT, {
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
      throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 300)}`);
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string | ContentPart[] } }[] };
    const content = data.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : (content ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('');
    const blocks = normaliseBlocks(extractJson(text));
    return { blocks, model, durationMs: performance.now() - started };
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
    const b = (item.bbox ?? {}) as Record<string, unknown>;
    const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
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
