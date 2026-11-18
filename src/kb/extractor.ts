import type { Page } from '../model/page';
import type { PageExtraction } from './model';
import { extractPage } from './extract';

export interface Extractor {
  name: string;
  extract(page: Page, ctx: { glossary: string[] }): Promise<{ raw: string }>;
  parse(raw: string): PageExtraction;
}

export const deterministicExtractor: Extractor = {
  name: 'deterministic',
  async extract(page, ctx) { return { raw: JSON.stringify(extractPage(page, ctx)) }; },
  parse(raw) {
    const value = JSON.parse(raw) as PageExtraction;
    if (!value || typeof value.pageId !== 'string' || typeof value.extractor !== 'string' || !Array.isArray(value.terms) || !Array.isArray(value.relations) || !Array.isArray(value.texts)) throw new Error('Invalid page extraction');
    return value;
  },
};
