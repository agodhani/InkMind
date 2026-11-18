import type { DigitalBlock, Page } from '../model/page';
import { conceptMatches, type KbDecisions } from './decisions';
import type { KbGraph } from './model';
import { scanTerms, splitParenAlias, termKey } from './normalize';

export interface LinkSuggestion { blockId: string; conceptId: string; label: string; surface: string }
export function suggestLinks(page: Page, graph: KbGraph, decisions: KbDecisions): LinkSuggestion[] {
  return page.blocks.flatMap(block => {
    const heading = splitParenAlias(block.text.replace(/^#+\s*/, '').replace(/:\s*$/, ''));
    const candidates = graph.concepts.filter(c =>
      !(block.kind === 'heading' && [heading.term, ...heading.aliases].some(k => conceptMatches(c, k))) &&
      !decisions.rejected.some(r => r.pageId === page.id && r.blockId === block.id && conceptMatches(c, r.key)) &&
      c.provenance.some(p => p.pageId !== page.id || p.blockId !== block.id));
    const seen = new Set<string>();
    return scanTerms(block.text, candidates.flatMap(c => [c.label, ...c.aliases].map(s => ({ key: termKey(s), value: c })))).flatMap(({ value: c, surface }) => {
      if (seen.has(c.id)) return [];
      seen.add(c.id);
      return [{ blockId: block.id, conceptId: c.id, label: c.label, surface }];
    });
  });
}
export function acceptSuggestion(block: DigitalBlock, suggestion: LinkSuggestion): string {
  const surface = scanTerms(block.text, [{ key: termKey(suggestion.surface), value: true }])[0]?.surface;
  if (!surface) return block.text;
  const link = termKey(surface) === termKey(suggestion.label) ? `[[${suggestion.label}]]` : `[[${suggestion.label}|${surface}]]`;
  const parts = block.text.split(/(\[\[[\s\S]*?\]\])/g);
  for (let i = 0; i < parts.length; i += 2) {
    const matches = scanTerms(parts[i], [{ key: termKey(surface), value: true }]);
    if (matches.length) {
      const found = matches[0].surface;
      let at = parts[i].indexOf(found);
      while (at >= 0 && ((at > 0 && /[\p{L}\p{N}]/u.test(parts[i][at - 1])) || /[\p{L}\p{N}]/u.test(parts[i][at + found.length] ?? ''))) at = parts[i].indexOf(found, at + 1);
      if (at >= 0) { parts[i] = parts[i].slice(0, at) + link + parts[i].slice(at + found.length); break; }
    }
  }
  return parts.join('');
}
