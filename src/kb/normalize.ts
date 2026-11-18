const exceptions = new Set(['series', 'species', 'physics', 'mathematics', 'news', 'minimax']);

export function termKey(s: string): string {
  return s.normalize('NFKC').replace(/^\s*(?:\d+[.)]|[-+])\s+/, '')
    .replace(/[_\-/·]/g, ' ').replace(/[*~`#[\]]/g, '').replace(/['’]s\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).map(word => {
      const w = word.toLowerCase();
      if (exceptions.has(w)) return w;
      if (/^[A-Z]{2,}s$/.test(word)) return w.slice(0, -1);
      if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
      if (/(sses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
      return w.length > 3 && w.endsWith('s') && !/(ss|us|is|os)$/.test(w) ? w.slice(0, -1) : w;
    }).join(' ');
}

export function splitParenAlias(s: string): { term: string; aliases: string[] } {
  const match = s.trim().match(/^(.+?)\s*\(([^()]+)\)$/);
  return match && match[2].trim().split(/\s+/).length <= 4
    ? { term: match[1].trim(), aliases: [match[2].trim()] } : { term: s.trim(), aliases: [] };
}

export function isConceptLabel(s: string): boolean {
  const k = termKey(s);
  return k.length > 1 && /\p{L}/u.test(k) && k.split(' ').length <= 8
    && !/^(yes|no|true|false|start|end|stop|circle|box|rectangle|square|ellipse|diamond|arrow|line|node|n\d+|group \d+)$/.test(k);
}

export function scanTerms<T>(text: string, candidates: { key: string; value: T }[], headingKeys?: Set<string>): { value: T; surface: string }[] {
  const masked = text.replace(/\[\[[\s\S]*?\]\]/g, s => ' '.repeat(s.length));
  const written = [...masked.matchAll(/[^\s\-_/·]+/gu)].flatMap(m => {
    const trimmed = m[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const key = termKey(trimmed);
    return key ? [{ key, start: m.index + m[0].indexOf(trimmed), end: m.index + m[0].indexOf(trimmed) + trimmed.length }] : [];
  });
  const occupied = new Set<number>(), result: { value: T; surface: string }[] = [];
  const sorted = [...candidates].filter(c => c.key && (!headingKeys || headingKeys.has(c.key)))
    .sort((a, b) => b.key.split(' ').length - a.key.split(' ').length || b.key.length - a.key.length || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const { key, value } of sorted) {
    const words = key.split(' ');
    for (let i = 0; i <= written.length - words.length; i++) {
      if (!words.every((w, j) => w === written[i + j].key && !occupied.has(i + j))) continue;
      if (/\[\[/.test(text.slice(written[i].start, written[i + words.length - 1].end))) continue;
      words.forEach((_, j) => occupied.add(i + j));
      result.push({ value, surface: text.slice(written[i].start, written[i + words.length - 1].end) });
    }
  }
  return result;
}
