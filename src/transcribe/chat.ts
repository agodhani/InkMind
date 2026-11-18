import { closeJsonPrefix, detectLoop } from './loopGuard';
import { ModelOutputError } from './prompt';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const RETRY_DELAYS_MS = [3000, 10000, 20000];

export interface CompatibleChatOptions {
  baseUrl: string;
  model: string;
  provider: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

export async function requestCompatibleChat(opts: CompatibleChatOptions, request: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const { baseUrl, model, apiKey } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body = JSON.stringify({ model, ...request });

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
    throw new Error(`${opts.provider} ${response?.status ?? 'network'}: ${text.slice(0, 300)}`);
  }
  const data = (await response.json()) as { choices?: { finish_reason?: string; message?: { content?: string | { type: string; text?: string }[] } }[] };
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  const text = typeof content === 'string' ? content : (content ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('');
  if (!text.trim()) throw new ModelOutputError(`Model returned empty content (finish_reason: ${choice?.finish_reason ?? 'unknown'})`, JSON.stringify(data).slice(0, 2000));
  return text;
}

export async function requestOllamaChat(url: string, body: Record<string, unknown>, signal?: AbortSignal) {
  let timing: Record<string, number | undefined> | undefined;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.throwIfAborted();
  signal?.addEventListener('abort', abort, { once: true });
  let raw = '';
  let guardedAt: number | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ ...body, stream: true }),
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
    return { raw, guardedAt, timing };
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}
