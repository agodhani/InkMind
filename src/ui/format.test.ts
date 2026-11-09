import { describe, expect, it } from 'vitest';
import { createPage, type Page } from '../model/page';
import { filterPages, openRouterKeyHint, pageExcerpt, plural, relativeTime, urlHint } from './format';

const block = (text: string, kind: Page['blocks'][number]['kind'] = 'paragraph') => ({ id: text, kind, text, bbox: { left: 0, top: 0, right: 1, bottom: 1 }, strokeIds: [], confidence: 1 });

describe('format helpers', () => {
  it('relativeTime buckets', () => {
    const now = 1_800_000_000_000;
    expect(relativeTime(now - 10_000, now)).toBe('just now');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(relativeTime(now - 26 * 3_600_000, now)).toBe('yesterday');
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe('3 days ago');
    expect(relativeTime(now - 30 * 86_400_000, now)).toMatch(/\w/);
  });

  it('plural', () => {
    expect(plural(1, 'stroke')).toBe('1 stroke');
    expect(plural(3, 'stroke')).toBe('3 strokes');
  });

  it('filterPages matches title or transcribed text, case-insensitively', () => {
    const a = { ...createPage('RLHF notes'), blocks: [block('reward model')] };
    const b = { ...createPage('Shopping'), blocks: [block('milk')] };
    expect(filterPages([a, b], '')).toHaveLength(2);
    expect(filterPages([a, b], 'rlhf')).toEqual([a]);
    expect(filterPages([a, b], 'MILK')).toEqual([b]);
    expect(filterPages([a, b], 'zzz')).toEqual([]);
  });

  it('pageExcerpt skips diagrams and strips heading markers', () => {
    const p = { ...createPage('x'), blocks: [block('sketch', 'diagram'), block('# Policy gradient', 'heading'), block('second')] };
    expect(pageExcerpt(p)).toBe('Policy gradient');
    expect(pageExcerpt({ ...createPage('x'), blocks: [block('a'.repeat(100))] }, 20)).toHaveLength(20);
    expect(pageExcerpt(createPage('empty'))).toBe('');
  });

  it('inline validation hints', () => {
    expect(openRouterKeyHint('')).toBeNull();
    expect(openRouterKeyHint('abc')).toMatch(/sk-or-/);
    expect(openRouterKeyHint('sk-or-short')).toMatch(/short/);
    expect(openRouterKeyHint(`sk-or-${'x'.repeat(60)}`)).toBeNull();
    expect(urlHint('http://localhost:11434')).toBeNull();
    expect(urlHint('localhost:11434')).toBeTruthy();
    expect(urlHint('http://192.168.1.20:11434/api')).toMatch(/origin/);
    expect(urlHint('')).toMatch(/11434/);
  });
});
