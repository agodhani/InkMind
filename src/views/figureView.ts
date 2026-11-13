import type { FigureEdge, FigureInfo, FigureNode } from '../model/page';

const key = (value: string) => value.trim().toLowerCase();

export function uncoveredFigureLabels(fig: FigureInfo): string[] {
  if (fig.kind === 'mindmap' && !fig.nodes?.length && !fig.edges.length) return [];
  const covered = new Set([
    ...(fig.nodes ?? []).map(node => node.label), ...(fig.cells ?? []).flat(), ...(fig.sequence ?? []),
    ...fig.edges.flatMap(edge => [figureEndpointLabel(fig, edge.from), figureEndpointLabel(fig, edge.to), edge.label ?? '']),
  ].map(key));
  return fig.labels.filter(label => {
    const normalized = key(label);
    if (!normalized || covered.has(normalized)) return false;
    covered.add(normalized);
    return true;
  });
}

export function renameFigureNodes(fig: FigureInfo, labelsById: ReadonlyMap<string, string>, labelsByStep: ReadonlyMap<string, string> = new Map()): FigureInfo {
  if (!labelsById.size && !labelsByStep.size) return fig;
  const stepLabels = new Map([...labelsByStep].map(([old, next]) => [key(old), next]));
  const nodes = fig.nodes ?? [];
  const labelNode = (value: string) => {
    const matches = nodes.filter(node => key(node.label) === key(value));
    return matches.length === 1 ? matches[0] : undefined;
  };
  const label = (node: FigureNode) => labelsById.get(node.id) ?? node.label;
  const renameLabel = (value: string) => {
    const node = labelNode(value);
    return node ? label(node) !== node.label ? label(node) : value : stepLabels.get(key(value)) ?? value;
  };
  const endpoint = (value: string) => {
    const byId = nodes.find(node => key(node.id) === key(value));
    if (byId) return value;
    const node = labelNode(value);
    if (!node) return stepLabels.get(key(value)) ?? value;
    const next = label(node);
    const ambiguous = nodes.some(other => other.id !== node.id && (key(label(other)) === key(next) || key(other.id) === key(next)));
    return ambiguous ? node.id : next !== node.label ? next : value;
  };
  return { ...fig, nodes: nodes.map(node => ({ ...node, label: label(node) })), labels: fig.labels.map(renameLabel), sequence: fig.sequence?.map(renameLabel), edges: fig.edges.map(edge => ({ ...edge, from: endpoint(edge.from), to: endpoint(edge.to) })) };
}

export function renameFigureLabel(fig: FigureInfo, old: string, next: string): FigureInfo {
  const matches = (value: string) => key(value) === key(old);
  const rename = (value: string) => matches(value) ? next : value;
  return {
    ...fig,
    labels: fig.labels.map(rename),
    sequence: fig.sequence?.map(rename),
    nodes: fig.nodes?.map(node => ({ ...node, label: rename(node.label) })),
    edges: fig.edges.map(edge => ({ ...edge, from: rename(edge.from), to: rename(edge.to) })),
  };
}

export function figureCorrectionText(text: string, fig: FigureInfo): string {
  return [text, fig.kind, ...(fig.sequence ?? []).map((step, i) => `${i + 1}. ${step}`),
    ...(fig.nodes ?? []).map(node => `${node.label}${node.shape ? ` (${node.shape})` : ''}`),
    ...fig.edges.map(edge => figureEdgeText(fig, edge)),
    ...(fig.cells ?? []).map(row => row.join(' | ')), ...fig.labels].filter(Boolean).join('\n');
}

export function shapeGlyph(shape?: string): string {
  switch (key(shape ?? '')) {
    case 'rectangle': case 'box': return '▭';
    case 'rounded': return '▢';
    case 'circle': case 'ellipse': case 'oval': return '◯';
    case 'diamond': case 'decision': return '◇';
    case 'parallelogram': return '▱';
    case 'triangle': return '△';
    case 'cylinder': case 'database': return '⛁';
    default: return '•';
  }
}

function resolver(fig: FigureInfo) {
  const nodes = fig.nodes ?? [];
  const nodeKey = (node: FigureNode) => `node:${nodes.indexOf(node)}`;
  const resolve = (value: string) => {
    const byId = nodes.find(node => key(node.id) === key(value));
    if (byId) return nodeKey(byId);
    const matches = nodes.filter(node => key(node.label) === key(value));
    return matches.length === 1 ? nodeKey(matches[0]) : `label:${key(value)}`;
  };
  return { resolve, nodeKey };
}

export function figureEndpointLabel(fig: FigureInfo, value: string): string {
  const { resolve, nodeKey } = resolver(fig);
  const id = resolve(value);
  return fig.nodes?.find(node => nodeKey(node) === id)?.label ?? value;
}

export function figureEdgeText(fig: FigureInfo, edge: FigureEdge): string {
  const { resolve } = resolver(fig);
  const from = figureEndpointLabel(fig, edge.from), to = figureEndpointLabel(fig, edge.to);
  const label = edge.label ? ` (${edge.label})` : '';
  if (edge.kind === 'self-loop' || resolve(edge.from) === resolve(edge.to)) return `${from} ↺${label}`;
  return `${from} ${edge.kind === 'line' ? '—' : '→'} ${to}${label}`;
}

export function stepNode(fig: FigureInfo, step: string): FigureNode | undefined {
  return fig.nodes?.find(node => key(node.label) === key(step));
}

export function edgeMarks(fig: FigureInfo): ('self-loop' | 'back' | null)[] {
  const { resolve } = resolver(fig);
  const sequence = (fig.sequence ?? []).map(resolve);
  const marks: ('self-loop' | 'back' | null)[] = fig.edges.map(e => {
    if (e.kind === 'self-loop' || resolve(e.from) === resolve(e.to)) return 'self-loop';
    const from = sequence.indexOf(resolve(e.from)), to = sequence.indexOf(resolve(e.to));
    return from >= 0 && to >= 0 && to < from ? 'back' : null;
  });
  const visited = new Set<string>(), active = new Set<string>();
  const visit = (node: string) => {
    visited.add(node);
    active.add(node);
    fig.edges.forEach((edge, i) => {
      if (edge.kind === 'line' || resolve(edge.from) !== node || marks[i] === 'self-loop') return;
      const to = resolve(edge.to);
      if (active.has(to) && (sequence.indexOf(node) < 0 || sequence.indexOf(to) < 0)) marks[i] = 'back';
      if (!visited.has(to)) visit(to);
    });
    active.delete(node);
  };
  fig.edges.forEach(e => { if (!visited.has(resolve(e.from))) visit(resolve(e.from)); });
  return marks;
}

export interface MindMapBranch { label: string; children: MindMapBranch[] }
export function mindMapLayout(fig: FigureInfo): { hub: string; spokes: MindMapBranch[]; other: MindMapBranch[]; remainingEdges: number[] } | null {
  const { resolve, nodeKey } = resolver(fig), labels = new Map<string, string>(), neighbours = new Map<string, Set<string>>();
  const add = (label: string) => {
    const id = resolve(label);
    if (!labels.has(id)) labels.set(id, fig.nodes?.find(n => nodeKey(n) === id)?.label ?? label);
    if (!neighbours.has(id)) neighbours.set(id, new Set());
    return id;
  };
  (fig.nodes ?? []).forEach(n => { labels.set(nodeKey(n), n.label); neighbours.set(nodeKey(n), new Set()); });
  if (!fig.nodes?.length && !fig.edges.length) fig.labels.forEach(add);
  const link = (a: string, b: string) => {
    const from = add(a), to = add(b);
    if (from === to) return;
    neighbours.get(from)!.add(to);
    neighbours.get(to)!.add(from);
  };
  fig.edges.forEach(e => link(e.from, e.to));
  fig.nodes?.forEach(n => { if (n.parent) link(n.parent, n.id); });
  const roots = fig.nodes?.filter(n => !n.parent).map(nodeKey) ?? [];
  const candidates = roots.length ? roots : [...labels.keys()];
  const hub = candidates.reduce<string | undefined>((best, id) => best === undefined || (neighbours.get(id)?.size ?? 0) > (neighbours.get(best)?.size ?? 0) ? id : best, undefined);
  if (hub === undefined) return null;
  const spokeIds = [...(neighbours.get(hub) ?? [])], placed = new Set([hub, ...spokeIds]);
  const pair = (a: string, b: string) => JSON.stringify([a, b].sort());
  const treeLinks = new Set(spokeIds.map(id => pair(hub, id)));
  const branch = (id: string): MindMapBranch => {
    const children: MindMapBranch[] = [];
    for (const child of neighbours.get(id) ?? []) {
      if (placed.has(child)) continue;
      placed.add(child);
      treeLinks.add(pair(id, child));
      children.push(branch(child));
    }
    return { label: labels.get(id)!, children };
  };
  const spokes = spokeIds.map(branch), reachable = new Set(placed), other: MindMapBranch[] = [];
  for (const id of labels.keys()) {
    if (placed.has(id)) continue;
    placed.add(id);
    other.push(branch(id));
  }
  const remainingEdges = fig.edges.flatMap((edge, i) => {
    const from = resolve(edge.from), to = resolve(edge.to);
    return !reachable.has(from) || !reachable.has(to) || !treeLinks.has(pair(from, to)) || edge.label ? [i] : [];
  });
  return { hub: labels.get(hub)!, spokes, other, remainingEdges };
}

export function figureToMermaid(fig: FigureInfo): string | null {
  if (['table', 'plot', 'sketch', 'cube', 'shape'].includes(fig.kind)) return null;
  if (!fig.edges.length && !fig.nodes?.some(n => n.parent)) return null;
  const { resolve, nodeKey } = resolver(fig);
  const nodes = new Map<string, { id: string; label: string; shape?: string; parent?: string }>();
  const add = (label: string, node?: FigureNode) => {
    const name = node ? nodeKey(node) : resolve(label);
    if (!nodes.has(name)) nodes.set(name, { id: `n${nodes.size + 1}`, label: node?.label ?? label, shape: node?.shape, parent: node?.parent ? resolve(node.parent) : undefined });
  };
  fig.nodes?.forEach(n => add(n.label, n));
  fig.edges.forEach(e => { add(e.from); add(e.to); });
  fig.sequence?.forEach(s => add(s));
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/[<>|`\r\n[\]{}()\\]/g, c => `&#${c.charCodeAt(0)};`);
  const lines = [`flowchart ${fig.kind === 'sequence' ? 'LR' : 'TD'}`];
  const emitted = new Set<string>();
  const emit = (name: string, depth: number) => {
    if (emitted.has(name)) return;
    emitted.add(name);
    const n = nodes.get(name)!, children = [...nodes].filter(([child, value]) => child !== name && value.parent === name);
    const pad = '  '.repeat(depth);
    if (children.length) {
      lines.push(`${pad}subgraph ${n.id}["${escape(n.label)}"]`);
      children.forEach(([child]) => emit(child, depth + 1));
      lines.push(`${pad}end`);
    } else {
      const glyph = shapeGlyph(n.shape);
      const [open, close] = glyph === '◇' ? ['{', '}'] : glyph === '◯' ? ['((', '))'] : glyph === '▢' ? ['(', ')'] : ['[', ']'];
      lines.push(`${pad}${n.id}${open}"${escape(n.label)}"${close}`);
    }
  };
  for (const [name, n] of nodes) if (!n.parent || !nodes.has(n.parent)) emit(name, 1);
  for (const name of nodes.keys()) emit(name, 1);
  for (const e of fig.edges) {
    const from = nodes.get(resolve(e.from))!, to = nodes.get(resolve(e.to))!;
    const arrow = e.kind === 'line' ? '---' : '-->';
    lines.push(`  ${from.id} ${arrow}${e.label ? `|"${escape(e.label)}"|` : ''} ${to.id}`);
  }
  return lines.join('\n');
}
