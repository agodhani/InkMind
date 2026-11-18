import type { Concept, ConceptEdge, ConceptEdgeKind, KbGraph } from './model';

function subset(graph: KbGraph, ids: Set<string>): KbGraph {
  return { concepts: graph.concepts.filter(c => ids.has(c.id)), edges: graph.edges.filter(e => ids.has(e.from) && ids.has(e.to)) };
}
export function neighbourhood(graph: KbGraph, conceptId: string, depth: number): KbGraph {
  const ids = new Set([conceptId]);
  for (let i = 0; i < depth; i++) {
    const next = graph.edges.flatMap(e => ids.has(e.from) || ids.has(e.to) ? [e.from, e.to] : []);
    next.forEach(id => ids.add(id));
  }
  return subset(graph, ids);
}
export function filterGraph(graph: KbGraph, filters: { kinds?: ConceptEdgeKind[]; pageIds?: string[]; query?: string }): KbGraph {
  const query = filters.query?.trim().toLocaleLowerCase();
  const result = subset(graph, new Set(graph.concepts.filter(c =>
    (!query || [c.label, ...c.aliases].some(s => s.toLocaleLowerCase().includes(query))) &&
    (!filters.pageIds?.length || c.provenance.some(p => filters.pageIds!.includes(p.pageId)))) .map(c => c.id)));
  if (filters.kinds?.length) result.edges = result.edges.filter(e => filters.kinds!.includes(e.kind));
  return result;
}
export function groupLinks(graph: KbGraph, conceptId: string): Record<ConceptEdgeKind, { outgoing: { edge: ConceptEdge; concept: Concept }[]; incoming: { edge: ConceptEdge; concept: Concept }[] }> {
  const groups = { contains: { outgoing: [], incoming: [] }, follows: { outgoing: [], incoming: [] }, supports: { outgoing: [], incoming: [] }, mentions: { outgoing: [], incoming: [] } } as ReturnType<typeof groupLinks>;
  const concepts = new Map(graph.concepts.map(c => [c.id, c]));
  for (const edge of graph.edges) {
    const direction = edge.from === conceptId ? 'outgoing' : edge.to === conceptId ? 'incoming' : null;
    const concept = concepts.get(direction === 'outgoing' ? edge.to : edge.from);
    if (direction && concept) groups[edge.kind][direction].push({ edge, concept });
  }
  return groups;
}
export interface Position { x: number; y: number }
export function layoutGraph(graph: KbGraph, { width: outputWidth, height: outputHeight, seed = 1 }: { width: number; height: number; seed?: number }): Record<string, Position> {
  if (!(outputWidth > 0 && outputHeight > 0)) throw new Error('Layout dimensions must be positive');
  const nodes = [...graph.concepts].sort((a, b) => a.id.localeCompare(b.id));
  if (!nodes.length) return {};
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const neighbours = new Map(nodes.map(c => [c.id, new Set<string>()]));
  for (const e of graph.edges) {
    if (!neighbours.has(e.from) || !neighbours.has(e.to)) continue;
    neighbours.get(e.from)!.add(e.to); neighbours.get(e.to)!.add(e.from);
  }
  const visited = new Set<string>();
  const components: Concept[][] = [];
  const byId = new Map(nodes.map(c => [c.id, c]));
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const ids = [node.id]; visited.add(node.id);
    for (let i = 0; i < ids.length; i++) for (const id of neighbours.get(ids[i])!) {
      if (!visited.has(id)) { visited.add(id); ids.push(id); }
    }
    components.push(ids.sort().map(id => byId.get(id)!));
  }
  const boxes = components.map(component => {
    const pageKey = (c: Concept) => c.provenance.map(p => p.pageId).sort()[0] ?? '';
    const pages = [...new Set(component.map(pageKey))].sort();
    const columns = Math.ceil(Math.sqrt(pages.length));
    const counters = new Map<string, number>();
    const p = component.map(c => {
      const key = pageKey(c), page = pages.indexOf(key), i = counters.get(key) ?? 0;
      counters.set(key, i + 1);
      const angle = i * 2.399963 + random() * 0.1, r = 30 * Math.sqrt(i + 1);
      return { x: page % columns * 190 + Math.cos(angle) * r, y: Math.floor(page / columns) * 190 + Math.sin(angle) * r };
    });
    const index = new Map(component.map((c, i) => [c.id, i]));
    const edges = graph.edges.map(e => [index.get(e.from), index.get(e.to)]).filter((e): e is number[] => e[0] !== undefined && e[1] !== undefined);
    for (let step = 0; step < 180; step++) {
      const d = p.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
        const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, r = Math.max(0.01, Math.hypot(dx, dy));
        const f = (7000 / (r * r) + Math.max(0, 48 - r) * 0.8) / r;
        d[i].x += dx * f; d[i].y += dy * f; d[j].x -= dx * f; d[j].y -= dy * f;
      }
      for (const [i, j] of edges) {
        const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, r = Math.max(1, Math.hypot(dx, dy));
        const f = (r - 82) * 0.045 / r;
        d[i].x -= dx * f; d[i].y -= dy * f; d[j].x += dx * f; d[j].y += dy * f;
      }
      for (let i = 0; i < p.length; i++) {
        const length = Math.max(1, Math.hypot(d[i].x, d[i].y)), scale = Math.min(length, 12 * (1 - step / 180) + 0.1) / length;
        p[i].x += d[i].x * scale; p[i].y += d[i].y * scale;
      }
    }
    const minX = Math.min(...p.map(v => v.x)), minY = Math.min(...p.map(v => v.y));
    return { component, p: p.map(v => ({ x: v.x - minX + 28, y: v.y - minY + 28 })), width: Math.max(...p.map(v => v.x)) - minX + 56, height: Math.max(...p.map(v => v.y)) - minY + 56 };
  }).sort((a, b) => b.height - a.height || a.component[0].id.localeCompare(b.component[0].id));
  const rowWidth = Math.max(...boxes.map(b => b.width), Math.sqrt(boxes.reduce((sum, b) => sum + (b.width + 40) * (b.height + 40), 0) * outputWidth / outputHeight));
  const packed: Record<string, Position> = {};
  let x = 0, y = 0, rowHeight = 0, totalWidth = 0;
  for (const box of boxes) {
    if (x && x + box.width > rowWidth) { y += rowHeight + 40; x = 0; rowHeight = 0; }
    box.component.forEach((c, i) => { packed[c.id] = { x: x + box.p[i].x, y: y + box.p[i].y }; });
    totalWidth = Math.max(totalWidth, x + box.width); rowHeight = Math.max(rowHeight, box.height); x += box.width + 40;
  }
  const totalHeight = y + rowHeight, scale = Math.min(outputWidth / totalWidth, outputHeight / totalHeight);
  return Object.fromEntries(nodes.map(c => [c.id, {
    x: (outputWidth - totalWidth * scale) / 2 + packed[c.id].x * scale,
    y: (outputHeight - totalHeight * scale) / 2 + packed[c.id].y * scale,
  }]));
}
export function demoGraph(n = 120): KbGraph {
  const concepts = Array.from({ length: n }, (_, i) => ({ id: `demo-${i}`, label: `Knowledge topic ${i + 1}`, aliases: [], provenance: [{ pageId: `large-${Math.floor(i / 12)}`, blockId: `topic-${i}`, strokeIds: [], extractor: 'fixture', surface: `Knowledge topic ${i + 1}` }] }));
  const edges: ConceptEdge[] = concepts.flatMap((c, i) => [1, 7].filter(offset => i + offset < n).map(offset => ({ id: `${c.id}|mentions|demo-${i + offset}`, from: c.id, to: `demo-${i + offset}`, kind: 'mentions', labels: [], provenance: c.provenance })));
  return { concepts, edges };
}
