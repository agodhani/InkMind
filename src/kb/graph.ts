import type { Concept, ConceptEdge, KbGraph, PageExtraction, Provenance, RelationMention, TermMention } from './model';
import { scanTerms, termKey } from './normalize';

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const provenanceKey = (p: Provenance) => JSON.stringify([p.pageId, p.blockId, p.extractor, p.surface]);
function provenance(items: Provenance[]): Provenance[] {
  const unique = new Map<string, Provenance>();
  for (const p of items) {
    const key = provenanceKey(p), old = unique.get(key);
    unique.set(key, { ...p, strokeIds: [...new Set([...(old?.strokeIds ?? []), ...p.strokeIds])].sort(compare) });
  }
  return [...unique.values()].sort((a, b) => compare(provenanceKey(a), provenanceKey(b)));
}

export function buildGraph(extractions: PageExtraction[], previous?: KbGraph): KbGraph {
  const pages = [...extractions].sort((a, b) => compare(a.pageId, b.pageId));
  const terms = pages.flatMap(p => p.terms), parents = new Map<string, string>();
  const root = (key: string): string => {
    const parent = parents.get(key);
    if (parent === undefined) { parents.set(key, key); return key; }
    if (parent === key) return key;
    const r = root(parent); parents.set(key, r); return r;
  };
  for (const t of terms.filter(t => t.defines)) {
    const keys = [t.term, ...(t.aliases ?? [])].map(termKey).filter(Boolean);
    keys.forEach(k => { const a = root(keys[0]), b = root(k); parents.set(b, a); });
  }
  const groups = new Map<string, TermMention[]>();
  for (const t of terms) {
    const key = termKey(t.term);
    if (!parents.has(key)) continue;
    const r = root(key), group = groups.get(r) ?? [];
    group.push(t); groups.set(r, group);
  }
  const clusters = [...groups.values()].map(group => {
    const defining = group.filter(t => t.defines), surfaces = [...new Set(defining.map(t => t.prov.surface))];
    const count = (s: string) => defining.filter(t => t.prov.surface === s).length;
    const heading = (s: string) => defining.some(t => t.prov.surface === s && t.prov.extractor === 'det:heading') ? 1 : 0;
    surfaces.sort((a, b) => count(b) - count(a) || heading(b) - heading(a) || defining.findIndex(t => t.prov.surface === a) - defining.findIndex(t => t.prov.surface === b));
    const label = surfaces[0];
    const keys = new Set([...parents.keys()].filter(k => root(k) === root(termKey(group[0].term))));
    const aliases: string[] = [], seen = new Set([termKey(label)]);
    for (const s of defining.flatMap(t => [t.term, t.prov.surface, ...(t.aliases ?? [])]).sort(compare)) {
      if (!seen.has(termKey(s))) { aliases.push(s); seen.add(termKey(s)); }
    }
    return { group, label, aliases, keys };
  }).sort((a, b) => compare(termKey(a.label), termKey(b.label)));
  const used = new Set<string>(), byKey = new Map<string, Concept>(), concepts: Concept[] = [];
  for (const cluster of clusters) {
    const candidates = (previous?.concepts ?? []).filter(c => [c.label, ...c.aliases].some(s => cluster.keys.has(termKey(s))))
      .sort((a, b) => Number([b.label, ...b.aliases].some(s => termKey(s) === termKey(cluster.label))) - Number([a.label, ...a.aliases].some(s => termKey(s) === termKey(cluster.label))) || compare(a.id, b.id));
    const base = `c_${termKey(cluster.label).replace(/[^\p{L}\p{N}]+/gu, '-')}`;
    let id = candidates.find(c => !used.has(c.id))?.id ?? base, suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    const c: Concept = { id, label: cluster.label, aliases: cluster.aliases, provenance: cluster.group.map(t => t.prov) };
    concepts.push(c); cluster.keys.forEach(k => byKey.set(k, c));
  }
  const relations: RelationMention[] = pages.flatMap(p => p.relations);
  const matches = [...byKey].filter(([key]) => key.length >= 3).map(([key, value]) => ({ key, value }));
  for (const page of pages) for (const span of page.texts) {
    const heading = page.terms.find(t => t.prov.blockId === span.blockId && t.prov.extractor === 'det:heading');
    const headingKeys = heading ? new Set([heading.term, ...(heading.aliases ?? [])].map(termKey)) : undefined;
    const found = new Set<string>();
    for (const { value: c, surface } of scanTerms(span.text, matches, headingKeys)) {
      if (found.has(c.id)) continue;
      found.add(c.id);
      if (page.terms.some(t => t.prov.blockId === span.blockId && byKey.get(termKey(t.term)) === c)) continue;
      const prov: Provenance = { pageId: page.pageId, blockId: span.blockId, extractor: 'det:mention', surface, strokeIds: [] };
      c.provenance.push(prov);
      if (span.section) relations.push({ from: span.section, to: c.label, kind: 'mentions', prov });
    }
  }
  const edgeMap = new Map<string, ConceptEdge>();
  for (const r of relations) {
    const from = byKey.get(termKey(r.from)), to = byKey.get(termKey(r.to));
    if (!from || !to || from === to) continue;
    const id = `${from.id}|${r.kind}|${to.id}`;
    const edge = edgeMap.get(id) ?? { id, from: from.id, to: to.id, kind: r.kind, labels: [], provenance: [] };
    if (r.label) edge.labels.push(r.label);
    edge.provenance.push(r.prov); edgeMap.set(id, edge);
  }
  concepts.forEach(c => { c.provenance = provenance(c.provenance); });
  const edges = [...edgeMap.values()];
  edges.forEach(e => { e.labels = [...new Set(e.labels)].sort(compare); e.provenance = provenance(e.provenance); });
  return { concepts: concepts.sort((a, b) => compare(a.id, b.id)), edges: edges.sort((a, b) => compare(a.id, b.id)) };
}
