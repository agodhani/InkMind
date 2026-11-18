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
export function layoutGraph(graph: KbGraph, { width, height, seed = 1 }: { width: number; height: number; seed?: number }): Record<string, Position> {
  if (!(width > 0 && height > 0)) throw new Error('Layout dimensions must be positive');
  const nodes = [...graph.concepts].sort((a, b) => a.id.localeCompare(b.id));
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const p = nodes.map(() => ({ x: random() * width, y: random() * height }));
  const index = new Map(nodes.map((c, i) => [c.id, i]));
  const edges = graph.edges.map(e => [index.get(e.from), index.get(e.to)]).filter((e): e is number[] => e[0] !== undefined && e[1] !== undefined);
  const k = Math.sqrt(width * height / Math.max(1, nodes.length));
  for (let step = 0; step < 200; step++) {
    const d = p.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
      const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, r2 = Math.max(0.01, dx * dx + dy * dy), f = k * k / r2;
      d[i].x += dx * f; d[i].y += dy * f; d[j].x -= dx * f; d[j].y -= dy * f;
    }
    for (const [i, j] of edges) {
      const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, f = Math.hypot(dx, dy) / k;
      d[i].x -= dx * f; d[i].y -= dy * f; d[j].x += dx * f; d[j].y += dy * f;
    }
    const temperature = Math.min(width, height) * 0.1 * (1 - step / 200);
    for (let i = 0; i < p.length; i++) {
      const length = Math.max(1, Math.hypot(d[i].x, d[i].y)), scale = Math.min(length, temperature) / length;
      p[i].x = Math.max(0, Math.min(width, p[i].x + d[i].x * scale));
      p[i].y = Math.max(0, Math.min(height, p[i].y + d[i].y * scale));
    }
  }
  return Object.fromEntries(nodes.map((c, i) => [c.id, p[i]]));
}
export function demoGraph(n = 120): KbGraph {
  const concepts = Array.from({ length: n }, (_, i) => ({ id: `demo-${i}`, label: `Knowledge topic ${i + 1}`, aliases: [], provenance: [{ pageId: `large-${Math.floor(i / 12)}`, blockId: `topic-${i}`, strokeIds: [], extractor: 'fixture', surface: `Knowledge topic ${i + 1}` }] }));
  const edges: ConceptEdge[] = concepts.flatMap((c, i) => [1, 7].filter(offset => i + offset < n).map(offset => ({ id: `${c.id}|mentions|demo-${i + offset}`, from: c.id, to: `demo-${i + offset}`, kind: 'mentions', labels: [], provenance: c.provenance })));
  return { concepts, edges };
}
