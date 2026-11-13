import type { FigureInfo, FigureNode } from '../model/page';

const key = (value: string) => value.trim().toLowerCase();

export function renameFigureNodes(fig: FigureInfo, labelsById: ReadonlyMap<string, string>): FigureInfo {
  if (!labelsById.size) return fig;
  const nodes = fig.nodes ?? [];
  const labelNode = (value: string) => {
    const matches = nodes.filter(node => key(node.label) === key(value));
    return matches.length === 1 ? matches[0] : undefined;
  };
  const label = (node: FigureNode) => labelsById.get(node.id) ?? node.label;
  const renameLabel = (value: string) => {
    const node = labelNode(value);
    return node ? label(node) : value;
  };
  const endpoint = (value: string) => {
    const byId = nodes.find(node => key(node.id) === key(value));
    if (byId) return value;
    const node = labelNode(value);
    if (!node) return value;
    const next = label(node);
    const ambiguous = nodes.some(other => other.id !== node.id && (key(label(other)) === key(next) || key(other.id) === key(next)));
    return ambiguous ? node.id : next;
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
    ...fig.edges.map(edge => `${edge.from} ${edge.kind === 'line' ? '—' : '→'} ${edge.to}${edge.label ? ` (${edge.label})` : ''}`),
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

export interface MindMapBranch { label: string; children: string[] }
export function mindMapLayout(fig: FigureInfo): { hub: string; spokes: MindMapBranch[] } | null {
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
  const spokeIds = [...neighbours.get(hub)!], placed = new Set([hub, ...spokeIds]);
  return { hub: labels.get(hub)!, spokes: spokeIds.map(id => ({ label: labels.get(id)!, children: [...neighbours.get(id)!].filter(child => {
    if (placed.has(child)) return false;
    placed.add(child);
    return true;
  }).map(child => labels.get(child)!) })) };
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
