import type { Page } from '../model/page';

/** "just now", "4 min ago", "yesterday", or a short date. */
export function relativeTime(then: number, now = Date.now()): string {
  const diff = Math.max(0, now - then);
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

/** Case-insensitive match on title or transcribed text; an empty query keeps everything. */
export function filterPages(pages: Page[], query: string): Page[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages;
  return pages.filter((p) => p.title.toLowerCase().includes(q) || p.blocks.some((b) => b.text.toLowerCase().includes(q)));
}

/** First line of digital text, for a page preview under the title. */
export function pageExcerpt(page: Page, max = 80): string {
  const text = page.blocks
    .filter((b) => b.kind !== 'diagram')
    .map((b) => b.text.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim())
    .find(Boolean);
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Loose check that a string looks like an OpenRouter key; used only for inline hints, never to block. */
export function openRouterKeyHint(key: string): string | null {
  const k = key.trim();
  if (!k) return null;
  if (!k.startsWith('sk-or-')) return 'OpenRouter keys start with “sk-or-”. Double-check you copied the whole key.';
  if (k.length < 40) return 'That looks too short for an OpenRouter key.';
  return null;
}

export function urlHint(url: string): string | null {
  const u = url.trim();
  if (!u) return 'Enter the URL Ollama listens on, usually http://localhost:11434.';
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'Use an http:// or https:// URL.';
    if (parsed.pathname !== '/' && parsed.pathname !== '') return 'Just the origin — no path after the port.';
    return null;
  } catch {
    return 'That is not a valid URL.';
  }
}
