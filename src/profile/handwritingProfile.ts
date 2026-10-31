import type { HandwritingProfile } from '../transcribe/types';

/** One user fix of a transcribed block: the training signal for personalization. */
export interface Correction {
  id: string;
  pageId: string;
  blockId: string;
  /** PNG data URL of the ink that produced the block. */
  imageDataUrl: string;
  modelText: string;
  userText: string;
  createdAt: number;
}

export interface ProfileSettings {
  /** Habits the user typed in themselves ("I write footnotes with * at the bottom"). */
  habits: string[];
  /** Extra vocabulary the user added. */
  glossary: string[];
}

const STOPWORDS = new Set(
  'the a an and or of to in on for with is are was were be this that it as at by from not but if then than so we you i they he she its'.split(' '),
);

/** Terms the user has typed in corrections that the model got wrong: good glossary candidates. */
export function glossaryFromCorrections(corrections: Correction[]): string[] {
  const counts = new Map<string, number>();
  for (const c of corrections) {
    const wrong = new Set(tokenize(c.modelText));
    for (const token of tokenize(c.userText)) {
      if (STOPWORDS.has(token.toLowerCase()) || token.length < 3) continue;
      if (wrong.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}

export function tokenize(text: string): string[] {
  return text
    .replace(/[#*_`>\-[\]()$]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

/**
 * Build the prompt-time profile: glossary + habits + a handful of the most
 * recent corrections as few-shot examples (short ones first, they are cheapest
 * and most informative per token).
 */
export function buildProfile(corrections: Correction[], settings: ProfileSettings, maxExamples = 6): HandwritingProfile {
  const glossary = [...new Set([...settings.glossary, ...glossaryFromCorrections(corrections)])].slice(0, 80);
  const examples = [...corrections]
    .filter((c) => c.userText.trim() && c.imageDataUrl)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, maxExamples * 3)
    .sort((a, b) => a.userText.length - b.userText.length)
    .slice(0, maxExamples)
    .map((c) => ({ imageDataUrl: c.imageDataUrl, text: c.userText }));
  return { glossary, habits: settings.habits, examples };
}

export const EMPTY_PROFILE: HandwritingProfile = { glossary: [], habits: [], examples: [] };
