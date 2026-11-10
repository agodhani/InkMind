import { FIGURE_KINDS, type FigureEdge, type FigureEdgeKind, type FigureInfo, type FigureKind, type FigureNode } from '../model/page';

/**
 * Lenient parser for the optional `figure` object on diagram blocks. Small vision models produce
 * messy JSON: strings where arrays were asked for, objects for labels, "a -> b" strings for edges,
 * alias keys. Accept all of that; return undefined only when there is nothing usable.
 */
export function normaliseFigure(value: unknown, fallbackKind?: FigureKind): FigureInfo | undefined {
  if (value === null || value === undefined) return undefined;
  const obj = coerceObject(value);
  if (!obj) return undefined;
  const kind = normaliseFigureKind(firstString(obj, ['kind', 'type', 'figure_kind', 'figureKind', 'category']), fallbackKind);
  const shapes = stringList(firstDefined(obj, ['shapes', 'shape', 'elements', 'components', 'objects', 'nodes_shapes']));
  const rawNodes = firstDefined(obj, ['nodes', 'node', 'boxes', 'states', 'vertices']);
  const nodes = nodeList(rawNodes, firstDefined(obj, ['children', 'contains', 'nesting', 'nested', 'containment']));
  // Small models answer with the hint ids ("n2") where a word was asked for: resolve them through the node list.
  const byRef = (ref: string) => ref.replace(/\b(n\d+)\b/gi, (id) => nodes.find((n) => n.id.toLowerCase() === id.toLowerCase())?.label ?? id);
  const labels = dedupeText([
    ...stringList(firstDefined(obj, ['labels', 'label', 'texts', 'text_labels', 'annotations'])).map(byRef),
    ...(nodes.length ? nodes.map((n) => n.label) : stringList(rawNodes)),
  ]).filter((l) => !isGroupRef(l));
  const edges = edgeList(firstDefined(obj, ['edges', 'edge', 'relations', 'relationships', 'connections', 'arrows', 'links', 'transitions']), byRef);
  // "a → b" written as a step is two steps (arrow glyphs only: "ready to ship" is one step).
  const sequence = dedupeText(stringList(firstDefined(obj, ['sequence', 'steps', 'order', 'step_order', 'flow', 'timeline'])).map(byRef).flatMap((step) => step.split(ARROW_GLYPH_RE).map(cleanText).filter(Boolean))).filter((l) => !isGroupRef(l));
  // Cells only describe tables; small models echo the placeholder grid onto every figure.
  const cells = kind === undefined || kind === 'table' ? cellGrid(firstDefined(obj, ['cells', 'rows', 'table', 'grid'])) : [];
  if (!kind && shapes.length === 0 && labels.length === 0 && edges.length === 0 && sequence.length === 0 && cells.length === 0) return undefined;
  const fig: FigureInfo = { kind: kind ?? fallbackKind ?? (cells.length ? 'table' : 'sketch'), shapes, labels, edges };
  if (sequence.length) fig.sequence = sequence;
  if (nodes.length) fig.nodes = nodes;
  if (cells.length) fig.cells = cells;
  return fig;
}

function dedupeText(xs: string[]): string[] {
  const out: string[] = [];
  for (const x of xs) if (x && !out.some((o) => o.toLowerCase() === x.toLowerCase())) out.push(x);
  return out;
}

/**
 * Nodes from: [{id,label,shape,parent,children:[...]}] (children nest recursively), ["label", ...],
 * or {"id": "label"}. `nesting` is a top-level parent→children map or [{parent, child}] list that
 * sets `parent` on the referenced nodes.
 */
export function nodeList(value: unknown, nesting?: unknown): FigureNode[] {
  const out: FigureNode[] = [];
  const find = (ref: string) => {
    const r = ref.toLowerCase();
    return out.find((n) => n.id.toLowerCase() === r) ?? out.find((n) => n.label.toLowerCase() === r);
  };
  const add = (node: Partial<FigureNode> & { label: string }): FigureNode | undefined => {
    const label = cleanText(node.label);
    if (!label || isGroupRef(label) || out.length >= MAX_ITEMS) return undefined;
    const id = cleanText(node.id ?? '') || label;
    // Two nodes may carry the same word; they stay apart when the model gave them different ids.
    const existing = node.id !== undefined ? out.find((n) => n.id.toLowerCase() === id.toLowerCase()) : find(label);
    if (existing) {
      if (node.shape && !existing.shape) existing.shape = node.shape;
      if (node.parent && !existing.parent) existing.parent = node.parent;
      return existing;
    }
    const n: FigureNode = { id, label };
    if (node.shape) n.shape = node.shape;
    if (node.parent) n.parent = node.parent;
    if (node.group !== undefined) n.group = node.group;
    out.push(n);
    return n;
  };
  const visit = (v: unknown, parent?: string) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string' || typeof v === 'number') {
      for (const part of stringList(v)) add({ label: part, parent });
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, parent));
    else if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const label = firstDefined(o, ['label', 'text', 'name', 'title', 'value']);
      const id = firstDefined(o, ['id', 'key']);
      const shape = firstDefined(o, ['shape', 'type', 'kind', 'form']);
      const own = firstDefined(o, ['parent', 'inside', 'within', 'container']);
      const kids = firstDefined(o, ['children', 'contains', 'nested', 'inner']);
      const groupRaw = firstDefined(o, ['group', 'labelGroup', 'label_group', 'groupIndex', 'group_index']);
      const groupNum = typeof groupRaw === 'number' ? groupRaw : typeof groupRaw === 'string' && /^\D*\d+\s*$/.test(groupRaw) ? Number(groupRaw.replace(/\D+/g, '')) : NaN;
      if (label !== undefined || id !== undefined) {
        const text = typeof label === 'string' || typeof label === 'number' ? String(label) : typeof id === 'string' || typeof id === 'number' ? String(id) : stringList(label)[0];
        if (!text) return;
        const shapeText = typeof shape === 'string' ? cleanText(shape).toLowerCase() : '';
        const node = add({
          id: typeof id === 'string' || typeof id === 'number' ? String(id) : undefined,
          label: text,
          // "box 2" / "shape 1" are the prompt's placeholders, not a shape.
          shape: shapeText && !/^(box|shape|node)\s*\d+$/.test(shapeText) && !isGroupRef(shapeText) ? shapeText : undefined,
          parent: typeof own === 'string' ? cleanText(own) || undefined : parent,
          ...(Number.isInteger(groupNum) && groupNum >= 0 ? { group: groupNum } : {}),
        });
        if (node && kids !== undefined) visit(kids, node.id);
      } else {
        // {"id": "label"} or {"parent": ["child", ...]} maps: values that are arrays nest under the key.
        for (const [k, val] of Object.entries(o)) {
          if (Array.isArray(val) || (val && typeof val === 'object')) {
            const node = add({ id: k, label: k, parent });
            visit(val, node?.id ?? k);
          } else if (typeof val === 'string' || typeof val === 'number') add({ id: k, label: String(val), parent });
        }
      }
    }
  };
  visit(value);
  const nest = (parentRef: unknown, childRef: unknown) => {
    if (typeof parentRef !== 'string' || typeof childRef !== 'string') return;
    const parent = find(cleanText(parentRef)) ?? add({ label: parentRef });
    const child = find(cleanText(childRef)) ?? add({ label: childRef });
    if (parent && child && parent !== child) child.parent = parent.id;
  };
  if (Array.isArray(nesting)) {
    for (const item of nesting) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const parent = firstDefined(o, ['parent', 'outer', 'container', 'from']);
        const kids = firstDefined(o, ['child', 'children', 'inner', 'contains', 'to']);
        if (parent !== undefined) for (const c of stringList(kids)) nest(parent, c);
        else for (const [k, val] of Object.entries(o)) for (const c of stringList(val)) nest(k, c);
      } else if (Array.isArray(item) && item.length === 2) nest(item[0], item[1]);
    }
  } else if (nesting && typeof nesting === 'object') {
    for (const [k, val] of Object.entries(nesting as Record<string, unknown>)) for (const c of stringList(val)) nest(k, c);
  }
  // A node can't contain itself through a cycle or reference a missing parent.
  for (const n of out) {
    if (n.parent !== undefined) {
      const p = find(n.parent);
      if (!p || p === n) delete n.parent;
      else n.parent = p.id;
    }
  }
  for (const n of out) {
    const chain: FigureNode[] = [n];
    let cur = n;
    while (cur.parent !== undefined) {
      const next = find(cur.parent)!;
      if (chain.includes(next)) {
        // A containment cycle (a inside b inside a) is noise: none of its members is nested.
        for (const m of chain.slice(chain.indexOf(next))) delete m.parent;
        break;
      }
      chain.push(next);
      cur = next;
    }
  }
  return out;
}

/** Table cells from: [["a","b"],["c","d"]], ["a | b", "c | d"], [{col: val}], or a Markdown table string. */
export function cellGrid(value: unknown): string[][] {
  if (value === null || value === undefined) return [];
  const rows: string[][] = [];
  const pushRow = (cells: string[], keepEmpty = false) => {
    const cleaned = cells.map(cleanText);
    if ((keepEmpty || cleaned.some(Boolean)) && rows.length < MAX_ITEMS) rows.push(cleaned);
  };
  const splitRow = (s: string) => {
    const t = s.trim().replace(/^\|/, '').replace(/\|$/, '');
    if (/^[\s:|-]+$/.test(t)) return null;
    if (t.includes('|')) return t.split('|');
    if (t.includes('\t')) return t.split('\t');
    if (/\s{2,}/.test(t)) return t.split(/\s{2,}/);
    if (t.includes(',')) return t.split(/,\s*/);
    return t.split(/\s+/);
  };
  if (typeof value === 'string') {
    for (const line of value.split(/\n+/)) {
      const cells = splitRow(line);
      if (cells) pushRow(cells);
    }
  } else if (Array.isArray(value)) {
    let headers: string[] | null = null;
    for (const row of value) {
      if (Array.isArray(row)) pushRow(row.map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : stringList(c)[0] ?? '')), true);
      else if (typeof row === 'string' || typeof row === 'number') {
        const cells = splitRow(String(row));
        if (cells) pushRow(cells);
      } else if (row && typeof row === 'object') {
        const o = row as Record<string, unknown>;
        const inner = firstDefined(o, ['cells', 'row', 'values', 'columns']);
        if (Array.isArray(inner)) pushRow(inner.map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : stringList(c)[0] ?? '')));
        else {
          if (!headers) {
            headers = Object.keys(o);
            pushRow(headers);
          }
          pushRow(headers.map((h) => (o[h] === undefined || o[h] === null ? '' : typeof o[h] === 'object' ? stringList(o[h]).join(' ') : String(o[h]))));
        }
      }
    }
  } else if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const inner = firstDefined(o, ['rows', 'cells', 'data']);
    if (inner !== undefined) return cellGrid(inner);
    for (const [k, val] of Object.entries(o)) pushRow([k, ...stringList(val)]);
  }
  const width = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
}

const KIND_SYNONYMS: [RegExp, FigureKind][] = [
  [/flow|process|pipeline|state|box.*arrow|block diagram/, 'flowchart'],
  [/mind ?map|radial|spider/, 'mindmap'],
  [/sequence|lifeline|swim ?lane|timeline/, 'sequence'],
  [/tree|hierarch|org ?chart/, 'tree'],
  [/plot|chart|axis|axes|curve|histogram|function|graph of|line graph|bar graph|coordinate/, 'plot'],
  [/cube|3d|three.dim|isometric|prism|cuboid/, 'cube'],
  [/table|grid|matrix/, 'table'],
  [/network|graph|node/, 'graph'],
  [/shape|circle|ellipse|oval|rect|square|triangle|polygon|diamond|geometr/, 'shape'],
  [/sketch|draw|diagram|figure|illustration|picture|doodle/, 'sketch'],
];

export function normaliseFigureKind(raw: string | undefined, fallback?: FigureKind): FigureKind | undefined {
  if (!raw) return fallback;
  const s = raw.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if ((FIGURE_KINDS as string[]).includes(s)) return s as FigureKind;
  for (const [re, kind] of KIND_SYNONYMS) if (re.test(s)) return kind;
  return fallback ?? 'other';
}

function coerceObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return { shapes: value };
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return null;
    if (t.startsWith('{')) {
      try {
        return coerceObject(JSON.parse(t));
      } catch {
        /* fall through */
      }
    }
    return { kind: t };
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function firstDefined(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  const v = firstDefined(obj, keys);
  return typeof v === 'string' ? v : undefined;
}

const MAX_ITEMS = 24;
const MAX_LEN = 80;

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim().slice(0, MAX_LEN);
}

/** Strings from: an array of strings/objects, a single string (split on , ; | or newlines), or an object's values. */
export function stringList(value: unknown): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = cleanText(s);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase()) && out.length < MAX_ITEMS) out.push(t);
  };
  const visit = (v: unknown) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      v.split(/[\n;|]+/).flatMap((part) => part.split(/,\s*/)).forEach(push);
    } else if (typeof v === 'number' || typeof v === 'boolean') push(String(v));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const named = firstDefined(o, ['text', 'label', 'name', 'value', 'shape', 'type', 'kind', 'description']);
      if (named !== undefined) visit(named);
      else Object.values(o).forEach(visit);
    }
  };
  visit(value);
  return out;
}

const ARROW_RE = /\s*(?:->|-->|→|⇒|=>|—>|–>|,)\s*|\s+to\s+/i;
const ARROW_GLYPH_RE = /\s*(?:->|-->|→|⇒|=>|—>|–>)\s*/;

/** Small models echo the prompt's stroke-group ids ("group 3", "Figure A") instead of the words written. */
export function isGroupRef(value: unknown): boolean {
  return typeof value === 'string' && /^\s*(?:(group|grp|g|figure|fig|node)\s*[A-Z0-9]+|n\d+)\s*$/i.test(value);
}

/** An edge "label" that only restates the edge ("n1 → n2", "a -> b", "arrow from A to B") carries no written word. */
function isEdgeEcho(label: string, from: string, to: string): boolean {
  const l = label.trim().toLowerCase();
  if (/(^|\s)(->|-->|→|⇒|=>|—|–|<->|↔)(\s|$)/.test(l)) return true;
  if (/^arrow( from)?\b/.test(l)) return true;
  return l === from.trim().toLowerCase() || l === to.trim().toLowerCase();
}

/** Edges from: objects {from,to,label}, [from,to,label] arrays, or "a -> b (label)" / "a → b: label" strings. */
export function edgeList(value: unknown, resolve: (ref: string) => string = (r) => r): FigureEdge[] {
  const out: FigureEdge[] = [];
  const add = (from: unknown, to: unknown, label?: unknown, kind?: unknown, inferred?: unknown) => {
    const f0 = typeof from === 'string' || typeof from === 'number' ? resolve(cleanText(String(from))) : stringList(from)[0];
    const t0 = typeof to === 'string' || typeof to === 'number' ? resolve(cleanText(String(to))) : stringList(to)[0];
    if (isGroupRef(f0) || isGroupRef(t0)) return;
    const f = f0 && cleanText(f0), t = t0 && cleanText(t0);
    if (!f || !t || out.length >= MAX_ITEMS) return;
    const cleaned = typeof label === 'string' ? cleanText(label) : undefined;
    const l = cleaned && /[\p{L}\p{N}]/u.test(cleaned) && !isEdgeEcho(cleaned, f, t) && !isGroupRef(cleaned) ? cleaned : undefined;
    const k = f.toLowerCase() === t.toLowerCase() ? 'self-loop' : normaliseEdgeKind(kind);
    if (out.some((e) => e.from === f && e.to === t && (e.label ?? '') === (l ?? '') && (e.kind ?? 'arrow') === (k ?? 'arrow'))) return;
    const e: FigureEdge = { from: f, to: t };
    if (l) e.label = l;
    if (k) e.kind = k;
    if (inferred === true) e.inferred = true;
    out.push(e);
  };
  const visit = (v: unknown) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      for (const part of v.split(/[\n;]+/)) {
        const m = part.match(/^(.*?)\s*(?:\((.*?)\)|:\s*(.*?))?\s*$/);
        const body = m?.[1] ?? part;
        const label = m?.[2] ?? m?.[3];
        const undirected = !/->|-->|→|⇒|=>|—>|–>|\bto\b/i.test(body) && /(^|\s)(—|–|-|—)(\s|$)/.test(body);
        const pieces = body.split(undirected ? /\s+[—–-]+\s+/ : ARROW_RE).filter((p) => p.trim());
        for (let i = 0; i + 1 < pieces.length; i++) add(pieces[i], pieces[i + 1], label, undirected ? 'line' : undefined);
      }
    } else if (Array.isArray(v)) {
      if (v.length >= 2 && v.every((x) => typeof x === 'string' || typeof x === 'number') && v.length <= 3) add(v[0], v[1], v[2]);
      else v.forEach(visit);
    } else if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const from = firstDefined(o, ['from', 'source', 'src', 'start', 'a', 'tail']);
      const to = firstDefined(o, ['to', 'target', 'dst', 'dest', 'end', 'b', 'head']);
      const label = firstDefined(o, ['label', 'text', 'name', 'relation']);
      const kind = firstDefined(o, ['kind', 'type', 'style', 'arrow']);
      if (from !== undefined && to !== undefined) add(from, to, label, kind, o.inferred);
      else if (typeof label === 'string' && Object.keys(o).length === 1) visit(label);
      else {
        // {"A": "B"} or {"A": ["B", "C"]} adjacency form.
        for (const [k, val] of Object.entries(o)) {
          if (typeof val === 'string') add(k, val);
          else if (Array.isArray(val)) val.forEach((t) => add(k, t));
        }
      }
    }
  };
  visit(value);
  return out;
}

export function normaliseEdgeKind(raw: unknown): FigureEdgeKind | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (/self|loop|cycle|return/.test(s)) return 'self-loop';
  if (/^(line|undirected|plain|edge|connection|link|bidirectional|dashed|solid|none|false|no)$/.test(s) || /no ?arrow|without/.test(s)) return 'line';
  if (/arrow|directed|true|yes|->|→/.test(s)) return 'arrow';
  return undefined;
}

/** "a → b (label)", "a — b" for plain lines, "a ↺ (label)" for self-loops. */
export function edgeText(e: FigureEdge): string {
  const label = e.label ? ` (${e.label})` : '';
  if (e.kind === 'self-loop' || e.from === e.to) return `${e.from} ↺${label}`;
  return `${e.from} ${e.kind === 'line' ? '—' : '→'} ${e.to}${label}`;
}

/** Nodes in display order: parents before their children, children right after their parent, with depth. */
export function nodeTree(nodes: FigureNode[]): { node: FigureNode; depth: number }[] {
  const ids = new Set(nodes.map((n) => n.id));
  const out: { node: FigureNode; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | undefined, depth: number) => {
    for (const n of nodes) {
      const p = n.parent !== undefined && ids.has(n.parent) ? n.parent : undefined;
      if (p !== parent || seen.has(n.id)) continue;
      seen.add(n.id);
      out.push({ node: n, depth });
      if (depth < 8) walk(n.id, depth + 1);
    }
  };
  walk(undefined, 0);
  for (const n of nodes) if (!seen.has(n.id)) out.push({ node: n, depth: 0 });
  return out;
}

export function hasNesting(fig: FigureInfo): boolean {
  return !!fig.nodes?.some((n) => n.parent !== undefined);
}

/** "Shape: … Labels: … Steps: … Relations: a → b" caption for a figure with no usable model caption. */
export function figureCaption(fig: FigureInfo): string {
  const parts: string[] = [];
  if (fig.shapes.length) parts.push(`Shape: ${fig.shapes.join(', ')}.`);
  else if (fig.kind !== 'other') parts.push(`Shape: ${fig.kind}.`);
  if (fig.cells?.length) parts.push(`Table: ${fig.cells.length} row${fig.cells.length > 1 ? 's' : ''} × ${fig.cells[0].length} column${fig.cells[0].length > 1 ? 's' : ''}.`);
  if (fig.labels.length) parts.push(`Labels: ${fig.labels.join(', ')}.`);
  if (fig.sequence?.length) parts.push(`Steps: ${fig.sequence.join(' → ')}.`);
  if (hasNesting(fig)) {
    const nested = nodeTree(fig.nodes!).filter((n) => n.depth > 0).map((n) => `${n.node.label} inside ${fig.nodes!.find((p) => p.id === n.node.parent)?.label ?? n.node.parent}`);
    parts.push(`Nested: ${nested.join(', ')}.`);
  }
  if (fig.edges.length) parts.push(`Relations: ${fig.edges.map(edgeText).join(', ')}.`);
  return parts.join(' ');
}
