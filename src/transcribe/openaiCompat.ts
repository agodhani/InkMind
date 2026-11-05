import type { RawBlock, TranscribeRequest, TranscribeResult, Transcriber } from './types';
import { BLOCK_KINDS, ModelOutputError, SYSTEM_PROMPT, buildUserPrompt, extractJson } from './prompt';
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
  /** Extra top-level request fields (e.g. OpenRouter's `reasoning`). */
  extraBody?: Record<string, unknown>;
}

const RETRY_DELAYS_MS = [3000, 10000, 20000];

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
    const first = await this.request(req, 0.1, signal);
    if (!looksDegenerate(first.blocks, req)) return first;
    const second = await this.request(req, 0.5, signal);
    return { ...pickSaner(first, second, req), durationMs: performance.now() - started };
  }

  private async request(req: TranscribeRequest, temperature: number, signal?: AbortSignal): Promise<TranscribeResult> {
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

    const body = JSON.stringify({
        model,
        temperature,
        // Reasoning models spend tokens thinking before the JSON; too small a cap returns empty content.
        max_tokens: 8000,
        response_format: { type: 'json_object' },
        ...this.opts.extraBody,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      });

    // Free-tier routes are often rate-limited upstream (429) or briefly unavailable (5xx); back off and retry.
    let response: Response | undefined;
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers, signal, body });
      if (response.ok || attempt === RETRY_DELAYS_MS.length || !(response.status === 429 || response.status >= 500)) break;
      await response.text().catch(() => '');
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    }
    if (!response || !response.ok) {
      const text = response ? await response.text().catch(() => '') : '';
      throw new Error(`${this.opts.provider} ${response?.status ?? 'network'}: ${text.slice(0, 300)}`);
    }
    const data = (await response.json()) as { choices?: { finish_reason?: string; message?: { content?: string | ContentPart[] } }[] };
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const text = typeof content === 'string' ? content : (content ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('');
    if (!text.trim()) throw new ModelOutputError(`Model returned empty content (finish_reason: ${choice?.finish_reason ?? 'unknown'})`, JSON.stringify(data).slice(0, 2000));
    const blocks = normaliseBlocks(extractJson(text));
    return { blocks, model, durationMs: performance.now() - started, raw: text };
  }
}

/** Words per line-group a page of notes realistically holds; above this the model is inventing text. */
export const MAX_WORDS_PER_GROUP = 6;
/** Even cursive rarely writes a whole word in one stroke; more words than ~0.8 × strokes is invention. */
export const MAX_WORDS_PER_STROKE = 0.8;

export function wordCount(blocks: RawBlock[]): number {
  return blocks.reduce((n, b) => n + (b.kind === 'diagram' ? 0 : b.text.trim().split(/\s+/).filter(Boolean).length), 0);
}

/**
 * Hallucination guard: free/small vision models sometimes keep generating plausible "notes"
 * long after the real ink ran out (one run produced 4x the page's words). Flag a reply only
 * when it has far more words than both the line-groups and the strokes could hold — groups
 * alone can merge adjacent lines, so the stroke bound keeps a dense multi-line group from
 * tripping it.
 */
export function looksDegenerate(blocks: RawBlock[], region: Pick<TranscribeRequest, 'groups' | 'strokes'>): boolean {
  if (region.groups.length === 0 || blocks.length === 0) return false;
  const words = wordCount(blocks);
  return words > MAX_WORDS_PER_GROUP * Math.max(region.groups.length, 4) && words > MAX_WORDS_PER_STROKE * region.strokes.length;
}

/**
 * After a degenerate first reply and a hotter retry: never trade content for an empty reply;
 * prefer a sane retry; if both ran away keep the shorter one.
 */
export function pickSaner(first: TranscribeResult, second: TranscribeResult, region: Pick<TranscribeRequest, 'groups' | 'strokes'>): TranscribeResult {
  if (second.blocks.length === 0 && first.blocks.length > 0) return first;
  if (!looksDegenerate(second.blocks, region)) return second;
  return wordCount(second.blocks) < wordCount(first.blocks) ? second : first;
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
    const block: RawBlock = {
      kind,
      text,
      bbox: { left: num(b.left), top: num(b.top), right: num(b.right), bottom: num(b.bottom) },
      groupIndices: Array.isArray(item.groupIndices) ? item.groupIndices.filter((n): n is number => typeof n === 'number') : [],
      confidence: num(item.confidence, 0.5),
      marker: typeof item.marker === 'string' && item.marker ? item.marker : undefined,
      level: typeof item.level === 'number' ? item.level : undefined,
    };
    if (isLoopedRepeat(block, out)) continue;
    out.push(block);
  }
  return out;
}

/**
 * Vision models sometimes loop and emit a line again (seen on dense pages). A genuine repeat
 * elsewhere on the page has its own groups/box, so only drop a repeat that points at the same
 * region as an earlier identical block (shared group index, overlapping box, or no location at all).
 */
function isLoopedRepeat(block: RawBlock, earlier: RawBlock[]): boolean {
  const text = block.text.trim().toLowerCase();
  if (text.split(/\s+/).length < 3) return false;
  const located = block.groupIndices.length > 0 || boxArea(block.bbox) > 0;
  return earlier.some((e) => {
    if (e.kind !== block.kind || e.text.trim().toLowerCase() !== text) return false;
    if (!located) return true;
    if (block.groupIndices.some((g) => e.groupIndices.includes(g))) return true;
    return boxArea(block.bbox) > 0 && boxArea(e.bbox) > 0 && boxOverlap(block.bbox, e.bbox) > 0.5;
  });
}

function boxArea(b: RawBlock['bbox']): number {
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}

function boxOverlap(a: RawBlock['bbox'], b: RawBlock['bbox']): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(boxArea(a), boxArea(b));
}
