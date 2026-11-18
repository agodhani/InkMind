import type { KbGraph } from './model';
import { conceptMatches } from './decisions';
import { splitParenAlias } from './normalize';

/** `[[target]]` or `[[target|shown]]` → the concept it names and the words to display. */
export function parseWikilink(link: string): { target: string; shown: string } {
  const inner = link.replace(/^\[\[|\]\]$/g, '');
  const bar = inner.indexOf('|');
  const target = (bar < 0 ? inner : inner.slice(0, bar)).trim();
  const shown = bar < 0 ? '' : inner.slice(bar + 1).trim();
  return { target, shown: shown || target };
}

export function conceptForLink(graph: KbGraph, target: string): string | null {
  const { term } = splitParenAlias(target);
  return graph.concepts.find(c => conceptMatches(c, target) || conceptMatches(c, term))?.id ?? null;
}
