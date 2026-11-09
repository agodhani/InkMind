import { FIGURE_KINDS, type FigureEdge, type FigureInfo, type FigureKind } from '../model/page';

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
  const labels = stringList(firstDefined(obj, ['labels', 'label', 'nodes', 'texts', 'text_labels', 'annotations'])).filter((l) => !isGroupRef(l));
  const edges = edgeList(firstDefined(obj, ['edges', 'edge', 'relations', 'relationships', 'connections', 'arrows', 'links']));
  if (!kind && shapes.length === 0 && labels.length === 0 && edges.length === 0) return undefined;
  return { kind: kind ?? fallbackKind ?? 'sketch', shapes, labels, edges };
}

const KIND_SYNONYMS: [RegExp, FigureKind][] = [
  [/flow|process|pipeline|state|box.*arrow|block diagram/, 'flowchart'],
  [/tree|hierarch|org ?chart|mind ?map/, 'tree'],
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

const ARROW_RE = /\s*(?:->|-->|→|⇒|=>|—>|–>|to|,)\s*/i;

/** Small models echo the prompt's stroke-group ids ("group 3", "Figure A") instead of the words written. */
export function isGroupRef(value: unknown): boolean {
  return typeof value === 'string' && /^\s*(group|grp|g|figure|fig)\s*[A-Z0-9]+\s*$/i.test(value);
}

/** Edges from: objects {from,to,label}, [from,to,label] arrays, or "a -> b (label)" / "a → b: label" strings. */
export function edgeList(value: unknown): FigureEdge[] {
  const out: FigureEdge[] = [];
  const add = (from: unknown, to: unknown, label?: unknown) => {
    if (isGroupRef(from) || isGroupRef(to)) return;
    const f = typeof from === 'string' || typeof from === 'number' ? cleanText(String(from)) : stringList(from)[0];
    const t = typeof to === 'string' || typeof to === 'number' ? cleanText(String(to)) : stringList(to)[0];
    if (!f || !t || out.length >= MAX_ITEMS) return;
    const cleaned = typeof label === 'string' ? cleanText(label) : undefined;
    const l = cleaned && /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : undefined;
    if (out.some((e) => e.from === f && e.to === t && (e.label ?? '') === (l ?? ''))) return;
    out.push(l ? { from: f, to: t, label: l } : { from: f, to: t });
  };
  const visit = (v: unknown) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      for (const part of v.split(/[\n;]+/)) {
        const m = part.match(/^(.*?)\s*(?:\((.*?)\)|:\s*(.*?))?\s*$/);
        const body = m?.[1] ?? part;
        const label = m?.[2] ?? m?.[3];
        const pieces = body.split(ARROW_RE).filter((p) => p.trim());
        for (let i = 0; i + 1 < pieces.length; i++) add(pieces[i], pieces[i + 1], label);
      }
    } else if (Array.isArray(v)) {
      if (v.length >= 2 && v.every((x) => typeof x === 'string' || typeof x === 'number') && v.length <= 3) add(v[0], v[1], v[2]);
      else v.forEach(visit);
    } else if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const from = firstDefined(o, ['from', 'source', 'src', 'start', 'a', 'tail']);
      const to = firstDefined(o, ['to', 'target', 'dst', 'dest', 'end', 'b', 'head']);
      const label = firstDefined(o, ['label', 'text', 'name', 'relation']);
      if (from !== undefined && to !== undefined) add(from, to, label);
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

/** "Shape: … Labels: … Relations: a → b" caption for a figure with no usable model caption. */
export function figureCaption(fig: FigureInfo): string {
  const parts: string[] = [];
  if (fig.shapes.length) parts.push(`Shape: ${fig.shapes.join(', ')}.`);
  else if (fig.kind !== 'other') parts.push(`Shape: ${fig.kind}.`);
  if (fig.labels.length) parts.push(`Labels: ${fig.labels.join(', ')}.`);
  if (fig.edges.length) parts.push(`Relations: ${fig.edges.map((e) => `${e.from} → ${e.to}${e.label ? ` (${e.label})` : ''}`).join(', ')}.`);
  return parts.join(' ');
}
