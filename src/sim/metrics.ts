import type { BoundingBox } from '../types';
import type { DigitalBlock, FigureEdge, FigureNode } from '../model/page';

export interface ContainmentExpectation {
  outer: string;
  inner: string;
}

/** Machine-readable expectation for one figure on a reference page (see eval/README.md). */
export interface FigureExpectation {
  id: string;
  type: string;
  labels: string[];
  strokeIds: string[];
  bbox?: BoundingBox;
  /** Node labels when the figure is a diagram with relations. */
  nodes?: string[];
  /** Expected relations, tail → head. */
  edges?: FigureEdge[];
  /** False when the drawn connections have no arrowheads (either direction counts). */
  directed?: boolean;
  /** Ordered steps / stages / numbered messages. */
  sequence?: string[];
  /** Shapes drawn inside other shapes. */
  contains?: ContainmentExpectation[];
}

/** Page-level metadata written by the generator (absent on hand-made references). */
export interface PageMeta {
  kind?: string;
  seed?: number;
  messiness?: string;
  /** Arrows drawn between figures on a notes page, by figure id. */
  links?: { from: string; to: string }[];
}

export interface PageExpectation {
  /** Reference text for the text parts (figures excluded). */
  text: string;
  figures: FigureExpectation[];
  meta: PageMeta;
}

const FIGURES_FENCE = /```json\s*figures\s*\n([\s\S]*?)\n```/;

const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/** Split a reference page into its text and the figure expectations in its ```json figures fence. */
export function parseReferencePage(md: string): PageExpectation {
  const m = FIGURES_FENCE.exec(md);
  const text = md.replace(FIGURES_FENCE, '').replace(HTML_COMMENT, '').trim();
  if (!m) return { text, figures: [], meta: {} };
  const parsed = JSON.parse(m[1]) as (PageMeta & { figures?: FigureExpectation[] }) | FigureExpectation[];
  if (Array.isArray(parsed)) return { text, figures: parsed, meta: {} };
  const { figures = [], ...meta } = parsed;
  return { text, figures, meta };
}

export function formatReferencePage(text: string, figures: FigureExpectation[], meta: PageMeta = {}): string {
  if (figures.length === 0 && Object.keys(meta).length === 0) return text.trim() + '\n';
  // One figure per line keeps reference.md diff-able; stroke id lists would otherwise run to hundreds of lines.
  const body = figures.map((f) => `  ${JSON.stringify(f)}`).join(',\n');
  const head = Object.entries(meta)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `"${k}": ${JSON.stringify(v)}, `)
    .join('');
  return `${text.trim()}\n\n\`\`\`json figures\n{ ${head}"figures": [\n${body}\n] }\n\`\`\`\n`;
}

export const FIGURE_MIN_COVERAGE = 0.8;
export const FIGURE_MAX_FOREIGN = 0.2;

export interface FigureScore {
  id: string;
  type: string;
  /** Share of the figure's strokes inside the best diagram block. */
  coverage: number;
  /** Share of that block's strokes that are not the figure's. */
  foreign: number;
  detected: boolean;
  /** Share of the figure's strokes that landed in non-diagram blocks. */
  leaked: number;
  labels: string[];
  labelsFound: string[];
  caption: string;
}

export interface DiagramMetrics {
  figures: number;
  detected: number;
  /** detected / figures, or null when the page has no figures. */
  figureRecall: number | null;
  /** figure strokes in text blocks / all figure strokes. */
  textLeak: number | null;
  labels: number;
  labelsFound: number;
  labelRecall: number | null;
  /** Diagram blocks that do not correspond to any expected figure (≥ 50 % foreign strokes). */
  spuriousDiagrams: number;
  perFigure: FigureScore[];
}

type BlockLike = Pick<DigitalBlock, 'kind' | 'text' | 'strokeIds'>;

/**
 * Score diagram handling: a figure is detected when some `diagram` block covers ≥ 80 % of its strokes
 * with ≤ 20 % foreign strokes; its labels are looked up (case-insensitively) in that block's caption.
 */
export function diagramMetrics(figures: FigureExpectation[], blocks: BlockLike[]): DiagramMetrics {
  const diagrams = blocks.filter((b) => b.kind === 'diagram');
  const textStrokeIds = new Set(blocks.filter((b) => b.kind !== 'diagram').flatMap((b) => b.strokeIds));
  const matchedDiagrams = new Set<BlockLike>();
  const perFigure: FigureScore[] = figures.map((f) => {
    const own = new Set(f.strokeIds);
    type Candidate = { block: BlockLike; coverage: number; foreign: number; ok: boolean };
    let best = null as Candidate | null;
    for (const d of diagrams) {
      const ids = new Set(d.strokeIds);
      const inter = [...ids].filter((id) => own.has(id)).length;
      if (inter === 0) continue;
      const coverage = inter / own.size;
      const foreign = (ids.size - inter) / ids.size;
      const ok = coverage >= FIGURE_MIN_COVERAGE && foreign <= FIGURE_MAX_FOREIGN;
      // A block that satisfies both thresholds beats any contaminated one, however large its coverage.
      const better = !best || (ok && !best.ok) || (ok === best.ok && (coverage > best.coverage || (coverage === best.coverage && foreign < best.foreign)));
      if (better) best = { block: d, coverage, foreign, ok };
    }
    const detected = !!best?.ok;
    if (best) matchedDiagrams.add(best.block);
    // Labels only count when found in the caption of a block that actually contains figure strokes.
    const caption = best?.block.text ?? '';
    const labelsFound = f.labels.filter((l) => captionHasLabel(caption, l));
    return {
      id: f.id,
      type: f.type,
      coverage: round(best?.coverage ?? 0),
      foreign: round(best?.foreign ?? 0),
      detected,
      leaked: round(own.size ? f.strokeIds.filter((id) => textStrokeIds.has(id)).length / own.size : 0),
      labels: f.labels,
      labelsFound,
      caption,
    };
  });
  const figureStrokes = figures.flatMap((f) => f.strokeIds);
  const leakedStrokes = figureStrokes.filter((id) => textStrokeIds.has(id)).length;
  const labels = perFigure.reduce((n, f) => n + f.labels.length, 0);
  const labelsFound = perFigure.reduce((n, f) => n + f.labelsFound.length, 0);
  const detected = perFigure.filter((f) => f.detected).length;
  const figureIds = new Set(figureStrokes);
  const spuriousDiagrams = diagrams.filter((d) => {
    const foreign = d.strokeIds.filter((id) => !figureIds.has(id)).length;
    return d.strokeIds.length === 0 || foreign / d.strokeIds.length >= 0.5;
  }).length;
  return {
    figures: figures.length,
    detected,
    figureRecall: figures.length ? round(detected / figures.length) : null,
    textLeak: figureStrokes.length ? round(leakedStrokes / figureStrokes.length) : null,
    labels,
    labelsFound,
    labelRecall: labels ? round(labelsFound / labels) : null,
    spuriousDiagrams,
    perFigure,
  };
}

const NUMERIC = /^[-+−]?\d+(\.\d+)?$/;

/** Labels longer than two characters are plain substrings unless they are numbers, which must match whole. */
function needsWordMatch(l: string): boolean {
  return l.length <= 2 || NUMERIC.test(l);
}

/**
 * Regex matching `l` as a whole word — group 1 is the boundary char before it. Numbers must also be whole
 * numbers: not preceded by a sign or decimal point, not followed by a decimal point and more digits.
 */
function wholeLabelRegex(l: string, flags: string): RegExp {
  const esc = l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const numeric = NUMERIC.test(l);
  const before = numeric ? '(^|[^\\p{L}\\p{N}.+\\-−])' : '(^|[^\\p{L}\\p{N}])';
  const after = numeric ? '(?=$|[^\\p{L}\\p{N}.]|\\.(?!\\p{N}))' : '(?=$|[^\\p{L}\\p{N}])';
  return new RegExp(`${before}${esc}${after}`, flags);
}

/**
 * Case-insensitive label lookup; one- and two-character labels must match as whole words ("x" is not in "box"),
 * and numbers must match as whole numbers ("1" is not in "-1", "10" or "0.1").
 */
export function captionHasLabel(caption: string, label: string): boolean {
  const c = caption.toLowerCase(), l = label.trim().toLowerCase();
  if (!l) return false;
  if (!needsWordMatch(l)) return c.includes(l);
  return wholeLabelRegex(l, 'u').test(c);
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

// ---------------------------------------------------------------- relations / sequences / containment

type RelBlockLike = Pick<DigitalBlock, 'kind' | 'text' | 'strokeIds' | 'figure'>;

/** Lower-case, trim, unify arrows (`->`, `=>`, `→`) and whitespace so labels/edges compare loosely. */
export function normLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/(->|=>|-->|→|⇒)/g, '→')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`([{]+|[\s"'`)\]}.,;:]+$/g, '')
    .trim();
}

function labelsMatch(a: string, b: string): boolean {
  const x = normLabel(a), y = normLabel(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Labels may be quoted with extra words ("read input" vs "read input box"); short ones must match whole words.
  return captionHasLabel(x, y) || captionHasLabel(y, x);
}

/** Edges stated in a caption as "A → B", "A -> B (label)", separated by commas/semicolons. */
export function edgesFromCaption(caption: string): FigureEdge[] {
  const out: FigureEdge[] = [];
  const text = caption.replace(/(->|=>|-->|⇒)/g, '→');
  if (!text.includes('→')) return out;
  for (const chunk of text.split(/[,;\n]|\.\s/)) {
    const parts = chunk.split('→').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    for (let i = 0; i < parts.length - 1; i++) {
      const from = parts[i].replace(/^.*?:\s*/, '').replace(/\s*\(.*\)$/, '');
      const m = /^(.*?)\s*\(([^)]*)\)\s*\.?\s*$/.exec(parts[i + 1]);
      const to = (m ? m[1] : parts[i + 1]).replace(/\.$/, '').trim();
      if (!from || !to || from.length > 40 || to.length > 40) continue;
      out.push({ from, to, ...(m?.[2] ? { label: m[2] } : {}) });
    }
  }
  return out;
}

/** All relations a set of blocks claims: structured `figure.edges` first, else edges parsed from the caption. */
export function predictedEdges(blocks: RelBlockLike[]): FigureEdge[] {
  const out: FigureEdge[] = [];
  for (const b of blocks) {
    if (b.kind !== 'diagram') continue;
    const structured = b.figure?.edges ?? [];
    out.push(...(structured.length ? structured : edgesFromCaption(b.text)));
  }
  return out;
}

/** Endpoints must match; when both sides carry an edge label (e.g. state-machine transitions) the labels must match too. */
export function edgeMatches(expected: FigureEdge, got: FigureEdge, directed = true): boolean {
  if (expected.label && got.label && !labelsMatch(expected.label, got.label)) return false;
  const fwd = labelsMatch(expected.from, got.from) && labelsMatch(expected.to, got.to);
  if (fwd) return true;
  return !directed && labelsMatch(expected.from, got.to) && labelsMatch(expected.to, got.from);
}

/** Containment claims in a caption: "a inside b", "b contains a", "a within b", "a nested in b", "a in b". */
export function containmentFromCaption(caption: string): ContainmentExpectation[] {
  const out: ContainmentExpectation[] = [];
  const text = caption.replace(/\s+/g, ' ');
  const word = '([\\p{L}\\p{N}_∩/-]+(?: [\\p{L}\\p{N}_∩/-]+)?)';
  const push = (inner: string, outer: string) => out.push({ inner: inner.trim(), outer: outer.trim() });
  for (const m of text.matchAll(new RegExp(`${word} (?:is |are |sits |drawn )?(?:inside|within|nested in|in the middle of|contained in|in) (?:the |a |an )?${word}`, 'giu'))) push(m[1], m[2]);
  for (const m of text.matchAll(new RegExp(`${word} (?:contains|containing|encloses|enclosing|surrounds|wraps) (?:the |a |an )?${word}`, 'giu'))) push(m[2], m[1]);
  return out;
}

/** Kendall tau-b style agreement in [-1, 1] between an expected order and the positions found; null when < 2 items were found. */
export function kendallTau(positions: (number | null)[]): number | null {
  const found = positions.map((p, i) => ({ p, i })).filter((x): x is { p: number; i: number } => x.p !== null);
  if (found.length < 2) return null;
  let concordant = 0, discordant = 0;
  for (let a = 0; a < found.length; a++) {
    for (let b = a + 1; b < found.length; b++) {
      const d = Math.sign(found[b].p - found[a].p);
      if (d > 0) concordant++;
      else if (d < 0) discordant++;
    }
  }
  const pairs = concordant + discordant;
  return pairs ? round((concordant - discordant) / pairs) : null;
}

/**
 * Assign each step the first position `find(from)` yields after the previous step (so repeated tokens resolve in
 * order), wrapping around to the start when nothing follows; a position is used by at most one step so two
 * steps can never tie (which Kendall tau would otherwise ignore).
 */
function assignPositions(steps: string[], find: (step: string, from: number) => number, width: (step: string) => number): (number | null)[] {
  const used = new Set<number>();
  let cursor = 0;
  return steps.map((s) => {
    const next = (from: number) => {
      let at = from;
      for (;;) {
        const idx = find(s, at);
        if (idx < 0 || !used.has(idx)) return idx;
        at = idx + 1;
      }
    };
    let idx = next(cursor);
    if (idx < 0) idx = next(0);
    if (idx < 0) return null;
    used.add(idx);
    cursor = idx + width(s);
    return idx;
  });
}

/** Position of each step in `text` (first whole-word-ish occurrence), or null when absent. */
export function stepPositions(steps: string[], text: string): (number | null)[] {
  const t = text.toLowerCase();
  const find = (l: string, from: number) => {
    if (!l) return -1;
    if (!needsWordMatch(l)) return t.indexOf(l, from);
    const re = wholeLabelRegex(l, 'gu');
    re.lastIndex = from;
    const m = re.exec(t);
    return m ? m.index + m[1].length : -1;
  };
  return assignPositions(steps.map(normLabel), find, (l) => Math.max(1, l.length));
}

/** Position of each step in a structured `figure.sequence` (first entry matching the step after the previous one), or null when absent. */
export function stepPositionsInSequence(steps: string[], sequence: string[]): (number | null)[] {
  return assignPositions(steps, (s, from) => sequence.findIndex((x, i) => i >= from && labelsMatch(x, s)), () => 1);
}

export interface SequencePositions {
  positions: (number | null)[];
  /** True when the steps were looked up in the structured `figure.sequence` rather than the caption text. */
  structured: boolean;
}

/**
 * Where each expected step sits in what a block says: the structured `figure.sequence` when the model /
 * reconciler produced one that names at least one of the steps, otherwise the caption text.
 */
export function stepPositionsFor(steps: string[], source: { text: string; figure?: { sequence?: string[] } }): SequencePositions {
  const seq = source.figure?.sequence;
  if (seq?.length) {
    const positions = stepPositionsInSequence(steps, seq);
    if (positions.some((p) => p !== null)) return { positions, structured: true };
  }
  return { positions: stepPositions(steps, source.text), structured: false };
}

/** "inner inside outer" pairs stated by structured `figure.nodes` (`parent` is the id — or label — of the enclosing node). */
export function containmentFromNodes(nodes: FigureNode[]): ContainmentExpectation[] {
  const out: ContainmentExpectation[] = [];
  for (const n of nodes) {
    const parent = n.parent;
    if (!parent) continue;
    const p = nodes.find((x) => x.id === parent) ?? nodes.find((x) => x !== n && labelsMatch(x.label, parent));
    if (p && p !== n) out.push({ inner: n.label, outer: p.label });
  }
  return out;
}

export interface SequenceScore extends SequencePositions {
  /** Figure id. */
  id: string;
}

export interface RelationMetrics {
  /** Expected edges across all figures on the page. */
  edges: number;
  edgesFound: number;
  /** Edges the blocks claim, and how many of those match an expected edge. */
  predicted: number;
  predictedMatched: number;
  edgeRecall: number | null;
  edgePrecision: number | null;
  /** Ordered step lists: how many figures had one, how many were reproduced in exact order. */
  sequences: number;
  sequencesExact: number;
  steps: number;
  stepsFound: number;
  /** Mean Kendall tau over figures with a sequence (null when none scored). */
  sequenceTau: number | null;
  /** Figures whose order was scored against a structured `figure.sequence` (the rest fell back to caption text). */
  sequencesStructured: number;
  perSequence: SequenceScore[];
  /** True when containment was scored against structured `figure.nodes` parents rather than caption phrases. */
  containsStructured: boolean;
  contains: number;
  containsFound: number;
  containmentRecall: number | null;
  /** Expected figures vs diagram blocks produced. */
  expectedFigures: number;
  diagramBlocks: number;
  figureCountExact: boolean;
}

/**
 * Score relations on a page: edge recall/precision by endpoint labels (case-insensitive, `→` == `->`,
 * either direction for undirected figures), sequence order (Kendall tau + exact order of the step list
 * in the structured `figure.sequence`, else as it appears in the caption), containment recall (structured
 * `figure.nodes` parents, else caption phrases such as "ui inside frontend") and whether the number of
 * diagram blocks equals the number of expected figures.
 */
export function relationMetrics(figures: FigureExpectation[], blocks: RelBlockLike[]): RelationMetrics {
  const diagrams = blocks.filter((b) => b.kind === 'diagram');
  const got = predictedEdges(diagrams);
  const captionAll = diagrams.map((b) => b.text).join('\n');
  const strokeIndex = new Map<string, RelBlockLike>();
  for (const b of diagrams) for (const id of b.strokeIds) strokeIndex.set(id, b);
  // The diagram block holding most of a figure's strokes; all diagram blocks pooled when none does.
  const pooled: RelBlockLike = { kind: 'diagram', text: captionAll, strokeIds: [], figure: { kind: 'other', shapes: [], labels: [], edges: [], sequence: diagrams.flatMap((b) => b.figure?.sequence ?? []) } };
  const blockFor = (f: FigureExpectation): RelBlockLike => {
    const counts = new Map<RelBlockLike, number>();
    for (const id of f.strokeIds) {
      const b = strokeIndex.get(id);
      if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    let best: RelBlockLike | null = null, bestN = 0;
    for (const [b, n] of counts) if (n > bestN) { best = b; bestN = n; }
    return best && bestN >= f.strokeIds.length * 0.5 ? best : pooled;
  };

  let edges = 0, edgesFound = 0;
  const matchedPredicted = new Set<number>();
  for (const f of figures) {
    for (const e of f.edges ?? []) {
      edges++;
      let hit = false;
      got.forEach((g, i) => {
        if (edgeMatches(e, g, f.directed !== false)) {
          hit = true;
          matchedPredicted.add(i);
        }
      });
      if (hit) edgesFound++;
    }
  }

  let sequences = 0, sequencesExact = 0, steps = 0, stepsFound = 0, sequencesStructured = 0;
  const taus: number[] = [];
  const perSequence: SequenceScore[] = [];
  for (const f of figures) {
    if (!f.sequence?.length) continue;
    sequences++;
    const { positions: pos, structured } = stepPositionsFor(f.sequence, blockFor(f));
    perSequence.push({ id: f.id, positions: pos, structured });
    if (structured) sequencesStructured++;
    steps += f.sequence.length;
    const found = pos.filter((p) => p !== null).length;
    stepsFound += found;
    const tau = kendallTau(pos);
    if (tau !== null) taus.push(tau);
    if (found === f.sequence.length && tau === 1) sequencesExact++;
  }

  let contains = 0, containsFound = 0;
  const fromNodes = diagrams.flatMap((b) => containmentFromNodes(b.figure?.nodes ?? []));
  const containsStructured = fromNodes.length > 0;
  const claimed = containsStructured ? fromNodes : containmentFromCaption(captionAll);
  for (const b of diagrams) for (const e of b.figure?.edges ?? []) {
    if (e.label && /contain|inside|within|nested/i.test(e.label)) claimed.push({ outer: e.from, inner: e.to });
  }
  for (const f of figures) {
    for (const c of f.contains ?? []) {
      contains++;
      if (claimed.some((k) => labelsMatch(k.inner, c.inner) && labelsMatch(k.outer, c.outer))) containsFound++;
    }
  }

  return {
    edges,
    edgesFound,
    predicted: got.length,
    predictedMatched: matchedPredicted.size,
    edgeRecall: edges ? round(edgesFound / edges) : null,
    edgePrecision: got.length ? round(matchedPredicted.size / got.length) : null,
    sequences,
    sequencesExact,
    steps,
    stepsFound,
    sequenceTau: taus.length ? round(taus.reduce((a, b) => a + b, 0) / taus.length) : null,
    sequencesStructured,
    perSequence,
    contains,
    containsStructured,
    containsFound,
    containmentRecall: contains ? round(containsFound / contains) : null,
    expectedFigures: figures.length,
    diagramBlocks: diagrams.length,
    figureCountExact: diagrams.length === figures.length,
  };
}
