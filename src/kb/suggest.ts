import type { DigitalBlock, Page } from '../model/page';
import { conceptMatches, type KbDecisions } from './decisions';
import type { KbGraph } from './model';
import { scanTerms, splitParenAlias, termKey } from './normalize';

export interface LinkSuggestion { blockId: string; conceptId: string; label: string; surface: string; start: number; end: number }
export function suggestLinks(page: Page, graph: KbGraph, decisions: KbDecisions): LinkSuggestion[] {
  return page.blocks.flatMap(block => {
    const heading = splitParenAlias(block.text.replace(/^#+\s*/, '').replace(/:\s*$/, ''));
    const candidates = graph.concepts.filter(c =>
      !(block.kind === 'heading' && [heading.term, ...heading.aliases].some(k => conceptMatches(c, k))) &&
      !decisions.rejected.some(r => r.pageId === page.id && r.blockId === block.id && conceptMatches(c, r.key)) &&
      c.provenance.some(p => p.pageId !== page.id || p.blockId !== block.id));
    const seen = new Set<string>();
    const masked = block.text.replace(/\[\[[\s\S]*?\]\]/g, s => ' '.repeat(s.length));
    const tokens = [...masked.matchAll(/[^\s\-_/·]+/gu)].map(m => {
      const text = m[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      const start = m.index + m[0].indexOf(text);
      return { start, end: start + text.length };
    });
    const ends = new Set(tokens.map(t => t.end)), occupied: { start: number; end: number }[] = [];
    return scanTerms(block.text, candidates.flatMap(c => [c.label, ...c.aliases].map(s => ({ key: termKey(s), value: c })))).flatMap(({ value: c, surface }) => {
      const token = tokens.find(t => masked.slice(t.start, t.start + surface.length) === surface && ends.has(t.start + surface.length) && !occupied.some(r => t.start < r.end && t.start + surface.length > r.start));
      if (!token) return [];
      const range = { start: token.start, end: token.start + surface.length };
      occupied.push(range);
      if (seen.has(c.id)) return [];
      seen.add(c.id);
      return [{ blockId: block.id, conceptId: c.id, label: c.label, surface, ...range }];
    });
  });
}
export function acceptSuggestion(block: DigitalBlock, suggestion: LinkSuggestion): string {
  const { start, end, surface } = suggestion;
  if (block.id !== suggestion.blockId || start < 0 || end <= start || block.text.slice(start, end) !== surface || [...block.text.matchAll(/\[\[[\s\S]*?\]\]/g)].some(m => start < m.index + m[0].length && end > m.index)) return block.text;
  const link = termKey(surface) === termKey(suggestion.label) ? `[[${suggestion.label}]]` : `[[${suggestion.label}|${surface}]]`;
  return block.text.slice(0, start) + link + block.text.slice(end);
}
