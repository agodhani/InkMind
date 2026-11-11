import type { BoundingBox, Offset } from '../types';
import type { InkStroke } from '../model/page';
import type { FigureEdge, FigureInfo, FigureKind, FigureNode } from '../model/page';

/**
 * Geometric pre-classifier for ink. Pure functions over strokes and stroke groups that
 * recognise the primitives people draw in study notes — closed shapes (circle/ellipse,
 * rectangle/square, triangle, diamond), straight lines, arrows (shaft + V head, single or
 * multi-stroke), plot axes, isometric cubes, box-and-arrow connectivity — and tell text
 * apart from drawings. The output is a set of plain-language hints per stroke group plus
 * figure groupings that are sent to the vision model alongside the image, and that the
 * block reconciler uses to keep a figure in one diagram block.
 *
 * Everything is scale-relative except MIN_SHAPE_SIZE, which separates a drawn circle from
 * the letter "o".
 */

export type StrokeShapeKind =
  | 'dot'
  | 'line'
  | 'polyline'
  | 'vee'
  | 'arrow'
  | 'curve'
  | 'scribble'
  | 'circle'
  | 'ellipse'
  | 'rectangle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'polygon'
  | 'blob';

export interface Segment {
  a: Offset;
  b: Offset;
}

export interface StrokeShape {
  strokeId: string;
  kind: StrokeShapeKind;
  bbox: BoundingBox;
  /** Diagonal of the bbox, the size scale used for every relative threshold. */
  diag: number;
  /** Ink path length. */
  length: number;
  closed: boolean;
  /** Simplified vertices. Closed shapes: the corners, without a repeated closing point. */
  vertices: Offset[];
  /** Straight pieces (lines, polylines, arrow shafts, polygon edges). Empty for round shapes. */
  segments: Segment[];
  start: Offset;
  end: Offset;
  /** Arrow tip and tail (kind === 'arrow'). */
  head?: Offset;
  tail?: Offset;
  /** Arrow whose shaft bends (kind === 'arrow'). */
  curved?: boolean;
}

/** A closed shape, from one stroke or several connected line strokes. */
export interface ClosedShape {
  kind: 'circle' | 'ellipse' | 'rectangle' | 'square' | 'triangle' | 'diamond' | 'polygon' | 'blob';
  strokeIds: string[];
  bbox: BoundingBox;
  corners: Offset[];
  groupIndex: number;
}

export interface Arrow {
  strokeIds: string[];
  tail: Offset;
  head: Offset;
  groupIndex: number;
  /** Index into ClosedShape[] the tail/head touches, when any. */
  from?: number;
  to?: number;
  /** Group index of bare text the tail/head points at when no shape does. */
  fromLabel?: number;
  toLabel?: number;
  /** Group index of the text written beside the middle of the arrow (an edge label). */
  labelGroup?: number;
  /** The shaft bends (curved arrow, loop). */
  curved?: boolean;
  /** Leaves and re-enters the same shape. */
  selfLoop?: boolean;
}

export interface Axes {
  strokeIds: string[];
  origin: Offset;
  xEnd: Offset;
  yEnd: Offset;
  groupIndex: number;
  /** Lines cross at the origin (origin in the middle) rather than meeting at a corner. */
  crossing: boolean;
}

export interface GroupLike {
  index: number;
  strokeIds: string[];
  bbox: BoundingBox;
}

export interface GroupAnalysis {
  index: number;
  bbox: BoundingBox;
  shapes: StrokeShape[];
  closed: ClosedShape[];
  arrows: Arrow[];
  axes: Axes | null;
  /** The straight edges in this group form an isometric cube / 3D box. */
  cube: boolean;
  /** Straight segments not part of a closed shape or an arrow (ticks, cube edges, underlines). */
  looseSegments: Segment[];
  curves: StrokeShape[];
  /** Strokes that look like handwriting (small marks on a baseline). */
  textStrokes: StrokeShape[];
  textLike: boolean;
  /** Contains something drawn (shape, arrow, axes, big curve). Never transcribe as text. */
  graphic: boolean;
  hint: string;
}

export type FigureNodeShape = ClosedShape['kind'] | 'text' | 'lifeline';

/** A node of a figure: a drawn shape (box, circle, diamond…), a lifeline, or a bare piece of text an arrow points at. */
export interface FigureNodeHint {
  /** Short id used in the hints and relations ("n1", "n2", …), numbered in reading order. */
  id: string;
  /** Group holding the drawn shape (or the text itself for a text node). */
  groupIndex: number;
  shape: FigureNodeShape;
  bbox: BoundingBox;
  /** Group whose text is this node's label (written inside the shape, or above a lifeline). */
  labelGroup?: number;
  /** id of the node this one is drawn inside. */
  parent?: string;
  /** A diamond among arrows: a decision / branch point. */
  decision?: boolean;
}

export interface FigureRelationHint {
  from: string;
  to: string;
  kind: 'arrow' | 'line' | 'self-loop';
  /** Group of the text written beside the arrow. */
  labelGroup?: number;
  /** Points against the figure's main flow (a loop back to an earlier step). */
  back?: boolean;
}

export interface FigureHint {
  id: number;
  groupIndices: number[];
  kind: FigureKind;
  shapes: string[];
  /** Group indices of text that belongs to the figure (labels inside shapes, axis labels). */
  labelGroups: number[];
  /** Group index → group index of the shape it is written inside. */
  labelInside: Record<number, number>;
  /** Drawing groups that also contain the text strokes of their own label (shape and label in one group). */
  labelHostGroups: number[];
  /** Connectivity between closed shapes, by group index (arrows only; see `relations` for the full picture). */
  edges: { from: number; to: number }[];
  nodes: FigureNodeHint[];
  relations: FigureRelationHint[];
  /** Node ids in step order: arrow order when arrows exist, else reading order along the layout axis. */
  order: string[];
  /** How `order` was derived ("arrow order", "left→right", "top→bottom", "clockwise from top"). */
  orderBasis: string;
  /** Tables: group index of the text in each cell, row-major; -1 for an empty cell. */
  cells?: number[][];
  summary: string;
}

export interface InkAnalysis {
  groups: GroupAnalysis[];
  figures: FigureHint[];
  /** Hint line per group index, as sent to the model. */
  hints: Map<number, string>;
}

/** Closed loops smaller than this (bbox diagonal, page px) are glyphs (o, 0, D), not drawn shapes. */
export const MIN_SHAPE_SIZE = 36;
/** Lines shorter than this never count as axes, dividers or cube edges. */
export const MIN_LINE_SIZE = 40;

// ---------------------------------------------------------------- geometry helpers

const dist = (a: Offset, b: Offset) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Offset, b: Offset): Offset => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const width = (b: BoundingBox) => b.right - b.left;
const height = (b: BoundingBox) => b.bottom - b.top;
const diagOf = (b: BoundingBox) => Math.hypot(width(b), height(b));
const center = (b: BoundingBox): Offset => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 });
const segLen = (s: Segment) => dist(s.a, s.b);

export function bboxOf(points: Offset[]): BoundingBox {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of points) {
    left = Math.min(left, p.x);
    top = Math.min(top, p.y);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
  }
  return points.length ? { left, top, right, bottom } : { left: 0, top: 0, right: 0, bottom: 0 };
}

function unionBox(a: BoundingBox, b: BoundingBox): BoundingBox {
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

function expand(b: BoundingBox, pad: number): BoundingBox {
  return { left: b.left - pad, top: b.top - pad, right: b.right + pad, bottom: b.bottom + pad };
}

function intersects(a: BoundingBox, b: BoundingBox, pad = 0): boolean {
  return !(a.right + pad < b.left || b.right + pad < a.left || a.bottom + pad < b.top || b.bottom + pad < a.top);
}

function contains(box: BoundingBox, p: Offset, pad = 0): boolean {
  return p.x >= box.left - pad && p.x <= box.right + pad && p.y >= box.top - pad && p.y <= box.bottom + pad;
}

/** Distance from a point to the nearest edge/inside of a box (0 when inside). */
function boxDistance(box: BoundingBox, p: Offset): number {
  const dx = Math.max(box.left - p.x, 0, p.x - box.right);
  const dy = Math.max(box.top - p.y, 0, p.y - box.bottom);
  return Math.hypot(dx, dy);
}

function pointsOf(stroke: InkStroke): Offset[] {
  const out: Offset[] = [];
  for (const p of stroke.inputs.inputs) {
    const q = { x: p.x, y: p.y };
    if (out.length === 0 || dist(out[out.length - 1], q) > 0.3) out.push(q);
  }
  return out;
}

function pathLength(points: Offset[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += dist(points[i - 1], points[i]);
  return n;
}

/** Re-sample a polyline at a fixed arc-length step (keeps the last point). */
export function resample(points: Offset[], step: number): Offset[] {
  if (points.length < 2) return [...points];
  const out: Offset[] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1];
    const b = points[i];
    let d = dist(a, b);
    while (carry + d >= step) {
      const t = (step - carry) / d;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(p);
      a = p;
      d = dist(a, b);
      carry = 0;
    }
    carry += d;
  }
  const last = points[points.length - 1];
  if (dist(out[out.length - 1], last) > step * 0.25) out.push(last);
  return out;
}

/** Light moving-average smoothing that keeps both ends in place. */
function smooth(points: Offset[]): Offset[] {
  if (points.length < 5) return points;
  const out = points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const a = points[i - 1], b = points[i + 1];
    return { x: (a.x + p.x + b.x) / 3, y: (a.y + p.y + b.y) / 3 };
  });
  return out;
}

function perpDistance(p: Offset, a: Offset, b: Offset): number {
  const l = dist(a, b);
  if (l < 1e-6) return dist(p, a);
  return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / l;
}

/** Ramer–Douglas–Peucker simplification. */
export function simplify(points: Offset[], epsilon: number): Offset[] {
  if (points.length < 3) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistance(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx > 0 && maxD > epsilon) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function polygonArea(points: Offset[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Change of direction at v, in degrees: 0 = straight on, 180 = doubles back. */
function turnAngle(prev: Offset, v: Offset, next: Offset): number {
  const a1 = Math.atan2(v.y - prev.y, v.x - prev.x);
  const a2 = Math.atan2(next.y - v.y, next.x - v.x);
  let d = Math.abs(a2 - a1) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/** Orientation of a segment in degrees, 0 = horizontal, 90 = vertical, range [0, 180). */
export function orientation(s: Segment): number {
  const a = (Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) * 180) / Math.PI;
  return ((a % 180) + 180) % 180;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

/** RMS deviation of the loop from the ellipse inscribed in its bbox (0 = perfect ellipse). */
function ellipseFitError(points: Offset[], bbox: BoundingBox): number {
  const c = center(bbox);
  const a = Math.max(1, width(bbox) / 2), b = Math.max(1, height(bbox) / 2);
  let sum = 0;
  for (const p of points) {
    const dx = p.x - c.x, dy = p.y - c.y;
    const theta = Math.atan2(dy, dx);
    const expected = (a * b) / Math.hypot(b * Math.cos(theta), a * Math.sin(theta));
    const ratio = Math.hypot(dx, dy) / expected - 1;
    sum += ratio * ratio;
  }
  return Math.sqrt(sum / Math.max(1, points.length));
}

// ---------------------------------------------------------------- single strokes

export function classifyStroke(stroke: InkStroke): StrokeShape {
  const raw = pointsOf(stroke);
  const bbox = bboxOf(raw);
  const diag = diagOf(bbox);
  const start = raw[0] ?? { x: 0, y: 0 };
  const end = raw[raw.length - 1] ?? start;
  const base = { strokeId: stroke.id, bbox, diag, start, end };
  if (raw.length < 2 || diag < 4) return { ...base, kind: 'dot', length: 0, closed: false, vertices: raw.slice(0, 1), segments: [] };

  const pts = smooth(resample(raw, Math.max(1.5, diag / 80)));
  const length = pathLength(pts);
  const gap = dist(pts[0], pts[pts.length - 1]);
  const closed = gap < Math.max(0.22 * diag, 6) && length > 1.8 * diag;
  return closed ? classifyClosed(base, pts, length) : classifyOpen(base, pts, length);
}

type Base = Pick<StrokeShape, 'strokeId' | 'bbox' | 'diag' | 'start' | 'end'>;

function classifyClosed(base: Base, pts: Offset[], length: number): StrokeShape {
  const { bbox, diag } = base;
  const w = Math.max(1, width(bbox)), h = Math.max(1, height(bbox));
  const c = center(bbox);
  // Start the loop at the point farthest from the centre (a corner, if there is one) so that
  // simplification does not create a fake vertex where the pen happened to start.
  let startIdx = 0, best = -1;
  pts.forEach((p, i) => {
    const d = dist(p, c);
    if (d > best) {
      best = d;
      startIdx = i;
    }
  });
  const rotated = [...pts.slice(startIdx), ...pts.slice(0, startIdx)];
  rotated.push(rotated[0]);
  const simp = simplify(rotated, 0.035 * diag);
  const corners = simp.slice(0, -1);
  const n = corners.length;
  const turns = corners.map((v, i) => turnAngle(corners[(i - 1 + n) % n], v, corners[(i + 1) % n]));
  const sharp = turns.filter((t) => t >= 55);
  const areaRatio = polygonArea(pts) / (w * h);
  const fit = ellipseFitError(pts, bbox);
  const aspect = Math.max(w, h) / Math.min(w, h);
  const sharpCorners = corners.filter((_, i) => turns[i] >= 55);
  const polygon = (kind: StrokeShape['kind'], cs: Offset[]): StrokeShape => ({
    ...base,
    kind,
    length,
    closed: true,
    vertices: cs,
    segments: cs.map((p, i) => ({ a: p, b: cs[(i + 1) % cs.length] })),
  });
  const round = (): StrokeShape => ({ ...base, kind: aspect < 1.3 ? 'circle' : 'ellipse', length, closed: true, vertices: corners, segments: [] });

  if (sharp.length <= 1 && fit < 0.12 && areaRatio > 0.6 && areaRatio < 0.93) return round();
  if (sharp.length === 3 && areaRatio > 0.3) return polygon('triangle', sharpCorners);
  if (sharp.length === 4) {
    const rightAngles = sharp.every((t) => Math.abs(t - 90) <= 28);
    if (rightAngles && areaRatio > 0.72) return polygon(aspect < 1.25 ? 'square' : 'rectangle', sharpCorners);
    const nearMidpoints = sharpCorners.every((p) => Math.min(Math.abs(p.x - c.x) / w, Math.abs(p.y - c.y) / h) < 0.2);
    if (areaRatio > 0.35 && areaRatio < 0.7 && nearMidpoints) return polygon('diamond', sharpCorners);
    return polygon('polygon', sharpCorners);
  }
  if (sharp.length >= 5) return length > 3.5 * diag ? { ...base, kind: 'scribble', length, closed: true, vertices: corners, segments: [] } : polygon('polygon', sharpCorners);
  if (fit < 0.2 && areaRatio > 0.55) return round();
  return { ...base, kind: 'blob', length, closed: true, vertices: corners, segments: [] };
}

function classifyOpen(base: Base, pts: Offset[], length: number): StrokeShape {
  const { diag, start, end } = base;
  const chord = dist(start, end);
  let maxDev = 0;
  for (const p of pts) maxDev = Math.max(maxDev, perpDistance(p, start, end));
  const open = (kind: StrokeShape['kind'], vertices: Offset[], segments: Segment[]): StrokeShape => ({ ...base, kind, length, closed: false, vertices, segments });

  if (chord > 0 && maxDev / chord < 0.07 && length < 1.12 * chord) return open('line', [start, end], [{ a: start, b: end }]);

  const simp = simplify(pts, 0.045 * diag);
  const segs: Segment[] = simp.slice(1).map((p, i) => ({ a: simp[i], b: p }));
  // A long arrow's head is small relative to its shaft: a coarse simplification erases it, so
  // the arrow checks also run on a finer one.
  const fineEps = Math.min(0.045 * diag, 5);
  const fine = fineEps < 0.045 * diag ? simplify(pts, fineEps) : simp;
  const fineSegs: Segment[] = fine === simp ? segs : fine.slice(1).map((p, i) => ({ a: fine[i], b: p }));
  for (const [vs, ss] of [[simp, segs], [fine, fineSegs]] as const) {
    const arrow = singleStrokeArrow(vs, ss, length);
    if (arrow) return { ...open('arrow', vs, [arrow.shaft]), head: arrow.head, tail: arrow.tail };
    const bent = curvedStrokeArrow(vs, ss, length);
    if (bent) return { ...open('arrow', vs, []), head: bent.head, tail: bent.tail, curved: true };
    if (vs === fine) break;
  }

  const turns = simp.slice(1, -1).map((v, i) => turnAngle(simp[i], v, simp[i + 2]));
  const sharpTurns = turns.filter((t) => t >= 40).length;
  if (length > 3 * diag || sharpTurns >= 5) return open('scribble', simp, []);
  const allLong = segs.every((s) => segLen(s) >= 0.12 * length);
  if (segs.length >= 2 && segs.length <= 5 && allLong && turns.every((t) => t >= 35)) {
    if (segs.length === 2 && turns[0] >= 100) return open('vee', simp, segs);
    return open('polyline', simp, segs);
  }
  return open('curve', simp, []);
}

/** A straight shaft with a small V (or bent back) at one end, drawn in one go. */
function singleStrokeArrow(simp: Offset[], segs: Segment[], length: number): { shaft: Segment; head: Offset; tail: Offset } | null {
  if (segs.length < 2 || segs.length > 7) return null;
  let idx = 0;
  segs.forEach((s, i) => {
    if (segLen(s) > segLen(segs[idx])) idx = i;
  });
  const shaft = segs[idx];
  const L = segLen(shaft);
  if (L < 0.5 * length) return null;
  const others = simp.filter((p) => p !== shaft.a && p !== shaft.b);
  if (others.length === 0) return null;
  if (segs.some((s, i) => i !== idx && segLen(s) > 0.45 * L)) return null;
  for (const [tip, tail] of [[shaft.b, shaft.a], [shaft.a, shaft.b]] as const) {
    const nearTip = others.every((p) => dist(p, tip) <= 0.45 * L);
    // Wing points sit a little behind the tip, off the shaft axis, folded back at ≤ 75° (an L corner is 90°).
    const back = { x: tail.x - tip.x, y: tail.y - tip.y };
    const wing = others.some((p) => {
      const d = dist(p, tip);
      if (d < Math.max(4, 0.04 * L) || perpDistance(p, shaft.a, shaft.b) < Math.max(3, 0.03 * L)) return false;
      const v = { x: p.x - tip.x, y: p.y - tip.y };
      const cos = (v.x * back.x + v.y * back.y) / (d * L);
      return cos >= Math.cos((75 * Math.PI) / 180);
    });
    if (nearTip && wing) return { shaft: { a: tail, b: tip }, head: tip, tail };
  }
  return null;
}

/**
 * A bending shaft (arc, S-curve, loop) that ends in a small V: the pen went to the tip, back out
 * along one wing, and back to the tip and out along the other (or just one wing). The last short
 * segments fold back ≥ 100° against the shaft; the shaft itself turns smoothly.
 */
function curvedStrokeArrow(simp: Offset[], segs: Segment[], length: number): { head: Offset; tail: Offset } | null {
  // Letters (f, t, ?, 2) are bent strokes ending in a hook too: only pen paths longer than a drawn line qualify.
  if (segs.length < 3 || segs.length > 12 || length < MIN_LINE_SIZE) return null;
  for (const reversed of [false, true]) {
    const pts = reversed ? [...simp].reverse() : simp;
    const ss = pts.slice(1).map((p, i) => ({ a: pts[i], b: p }));
    const n = ss.length;
    // Wing segments at the end: short, folded back.
    let wings = 0;
    for (let i = n - 1; i >= 1 && wings < 3; i--) {
      if (segLen(ss[i]) > 0.3 * length || segLen(ss[i]) < 3) break;
      const t = turnAngle(ss[i].a === pts[0] ? pts[0] : ss[i - 1].a, ss[i].a, ss[i].b);
      if (t < 95) break;
      wings++;
    }
    if (wings === 0) continue;
    const shaftSegs = ss.slice(0, n - wings);
    if (shaftSegs.length < 2) continue;
    const shaftLen = shaftSegs.reduce((acc, sg) => acc + segLen(sg), 0);
    if (shaftLen < 0.6 * length) continue;
    const shaftPts = pts.slice(0, n - wings + 1);
    const turns = shaftPts.slice(1, -1).map((v, i) => turnAngle(shaftPts[i], v, shaftPts[i + 2]));
    if (turns.some((t) => t >= 80)) continue;
    const head = shaftPts[shaftPts.length - 1];
    const tail = shaftPts[0];
    if (dist(head, tail) < 0.15 * shaftLen && shaftLen < 2.5 * MIN_LINE_SIZE) continue;
    return { head, tail };
  }
  return null;
}

// ---------------------------------------------------------------- groups

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const CLOSED_KINDS = new Set<StrokeShapeKind>(['circle', 'ellipse', 'rectangle', 'square', 'triangle', 'diamond', 'polygon', 'blob']);

function closedFromStroke(s: StrokeShape, groupIndex: number): ClosedShape {
  return { kind: s.kind as ClosedShape['kind'], strokeIds: [s.strokeId], bbox: s.bbox, corners: s.vertices, groupIndex };
}

/** Classify the corners of a closed polygon built from several strokes. */
function classifyCorners(corners: Offset[]): ClosedShape['kind'] {
  const n = corners.length;
  const bbox = bboxOf(corners);
  const w = Math.max(1, width(bbox)), h = Math.max(1, height(bbox));
  const areaRatio = polygonArea(corners) / (w * h);
  if (n === 3) return 'triangle';
  if (n === 4) {
    const turns = corners.map((v, i) => turnAngle(corners[(i - 1 + n) % n], v, corners[(i + 1) % n]));
    if (turns.every((t) => Math.abs(t - 90) <= 28) && areaRatio > 0.72) return Math.max(w, h) / Math.min(w, h) < 1.25 ? 'square' : 'rectangle';
    const c = center(bbox);
    if (areaRatio < 0.7 && corners.every((p) => Math.min(Math.abs(p.x - c.x) / w, Math.abs(p.y - c.y) / h) < 0.2)) return 'diamond';
  }
  return 'polygon';
}

/**
 * Chain straight segments whose endpoints touch into a closed polygon (a box drawn as four
 * separate lines, or two L strokes). Returns the ordered corners, or null.
 */
export function chainSegments(pieces: { strokeId: string; segments: Segment[] }[]): { corners: Offset[]; strokeIds: string[] } | null {
  const segs = pieces.flatMap((p) => p.segments.map((s) => ({ ...s, strokeId: p.strokeId })));
  if (segs.length < 3 || segs.length > 8) return null;
  const tol = Math.max(10, 0.22 * Math.min(...segs.map(segLen)));
  const used = new Set<number>();
  const corners: Offset[] = [segs[0].a];
  let cur = segs[0].b;
  used.add(0);
  while (used.size < segs.length) {
    let found = -1, flip = false;
    for (let i = 0; i < segs.length; i++) {
      if (used.has(i)) continue;
      if (dist(segs[i].a, cur) <= tol) {
        found = i;
        break;
      }
      if (dist(segs[i].b, cur) <= tol) {
        found = i;
        flip = true;
        break;
      }
    }
    if (found < 0) return null;
    used.add(found);
    const s = segs[found];
    corners.push(mid(cur, flip ? s.b : s.a));
    cur = flip ? s.a : s.b;
  }
  if (dist(cur, segs[0].a) > tol) return null;
  corners[0] = mid(corners[0], cur);
  return { corners, strokeIds: [...new Set(segs.map((s) => s.strokeId))] };
}

/** Lines + small marks at one end → arrow. `shafts` are candidate shaft strokes, `marks` are candidate heads. */
const HEAD_KINDS = new Set<StrokeShapeKind>(['vee', 'polyline', 'curve', 'triangle', 'arrow']);

function findCompositeArrows(shafts: StrokeShape[], marks: StrokeShape[], groupIndex: number, minShaft = 25): { arrows: Arrow[]; used: Set<string> } {
  const arrows: Arrow[] = [];
  const used = new Set<string>();
  for (const shaft of shafts) {
    if (shaft.length < minShaft || used.has(shaft.strokeId)) continue;
    if (shaft.kind === 'curve' && shaft.length < 2 * MIN_LINE_SIZE) continue;
    const ends: [Offset, Offset][] = [[shaft.start, shaft.end], [shaft.end, shaft.start]];
    for (const [tip, tail] of ends) {
      const heads = marks.filter((m) => {
        if (used.has(m.strokeId) || m.strokeId === shaft.strokeId) return false;
        if (!HEAD_KINDS.has(m.kind)) return false;
        if (m.diag > 0.45 * shaft.length || m.diag < 3) return false;
        // The shaft tip touches the head, and the head sits on the shaft's axis (straight shafts).
        if (!contains(m.bbox, tip, Math.max(4, 0.05 * shaft.length))) return false;
        if (shaft.kind !== 'curve' && perpDistance(center(m.bbox), shaft.start, shaft.end) > 0.4 * m.diag + 2) return false;
        return dist(center(m.bbox), tip) <= Math.max(14, 0.3 * shaft.length);
      });
      if (heads.length >= 1 && heads.length <= 3) {
        arrows.push({ strokeIds: [shaft.strokeId, ...heads.map((h) => h.strokeId)], tail, head: tip, groupIndex, ...(shaft.kind === 'curve' ? { curved: true } : {}) });
        used.add(shaft.strokeId);
        heads.forEach((h) => used.add(h.strokeId));
        break;
      }
    }
  }
  return { arrows, used };
}

const isHorizontal = (s: Segment) => angleDiff(orientation(s), 0) <= 20;
const isVertical = (s: Segment) => angleDiff(orientation(s), 90) <= 20;

function findAxes(segments: { seg: Segment; strokeId: string }[], groupIndex: number): Axes | null {
  const long = segments.filter((s) => segLen(s.seg) >= MIN_LINE_SIZE);
  const hs = long.filter((s) => isHorizontal(s.seg));
  const vs = long.filter((s) => isVertical(s.seg));
  for (const h of hs) {
    for (const v of vs) {
      if (h.strokeId === v.strokeId && h.seg === v.seg) continue;
      const tol = Math.max(14, 0.15 * Math.min(segLen(h.seg), segLen(v.seg)));
      const hEnds = [h.seg.a, h.seg.b], vEnds = [v.seg.a, v.seg.b];
      for (const he of hEnds) {
        for (const ve of vEnds) {
          if (dist(he, ve) > tol) continue;
          const origin = mid(he, ve);
          const xEnd = hEnds.find((p) => p !== he)!;
          const yEnd = vEnds.find((p) => p !== ve)!;
          const otherEnds = segments.filter((s) => s.seg !== h.seg && s.seg !== v.seg).flatMap((s) => [s.seg.a, s.seg.b]);
          if (otherEnds.some((p) => dist(p, xEnd) <= tol || dist(p, yEnd) <= tol)) continue;
          // Standard orientation: x grows to the right, y grows upward from the corner.
          if (xEnd.x > origin.x && yEnd.y < origin.y) return { strokeIds: [...new Set([h.strokeId, v.strokeId])], origin, xEnd, yEnd, groupIndex, crossing: false };
        }
      }
      // Crossing axes: the two lines intersect well inside both.
      const x = crossing(h.seg, v.seg);
      if (x && Math.min(segLen(h.seg), segLen(v.seg)) >= 1.5 * MIN_LINE_SIZE) {
        return { strokeIds: [...new Set([h.strokeId, v.strokeId])], origin: x, xEnd: h.seg.b.x > h.seg.a.x ? h.seg.b : h.seg.a, yEnd: v.seg.a.y < v.seg.b.y ? v.seg.a : v.seg.b, groupIndex, crossing: true };
      }
    }
  }
  return null;
}

function crossing(p: Segment, q: Segment): Offset | null {
  const d = (p.b.x - p.a.x) * (q.b.y - q.a.y) - (p.b.y - p.a.y) * (q.b.x - q.a.x);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((q.a.x - p.a.x) * (q.b.y - q.a.y) - (q.a.y - p.a.y) * (q.b.x - q.a.x)) / d;
  const u = ((q.a.x - p.a.x) * (p.b.y - p.a.y) - (q.a.y - p.a.y) * (p.b.x - p.a.x)) / d;
  if (t < 0.15 || t > 0.85 || u < 0.15 || u > 0.85) return null;
  return { x: p.a.x + t * (p.b.x - p.a.x), y: p.a.y + t * (p.b.y - p.a.y) };
}

/** ≥ 7 straight edges in exactly three directions (two of them not axis-aligned to each other's perpendicular) → isometric cube / 3D box. */
export function looksLikeCube(segments: Segment[]): boolean {
  const long = segments.filter((s) => segLen(s) >= 12);
  if (long.length < 7) return false;
  const maxLen = Math.max(...long.map(segLen));
  const edges = long.filter((s) => segLen(s) >= 0.25 * maxLen);
  if (edges.length < 7) return false;
  const clusters: { angle: number; n: number }[] = [];
  for (const s of edges) {
    const a = orientation(s);
    const c = clusters.find((k) => angleDiff(k.angle, a) <= 15);
    if (c) c.n++;
    else clusters.push({ angle: a, n: 1 });
  }
  const big = clusters.filter((c) => c.n >= 2);
  return clusters.length === 3 && big.length === 3;
}

export function analyseGroup(group: GroupLike, strokes: InkStroke[]): GroupAnalysis {
  const shapes = strokes.map(classifyStroke);
  const heights = shapes.map((s) => height(s.bbox));
  const medH = median(heights);
  const gw = width(group.bbox), gh = height(group.bbox);

  // A closed loop is a drawn shape only when it is big in absolute terms and relative to its neighbours.
  const bigEnough = (s: StrokeShape) => s.diag >= MIN_SHAPE_SIZE && (shapes.length <= 3 || height(s.bbox) >= 1.6 * median(heights.filter((_, i) => shapes[i] !== s)));
  const closed: ClosedShape[] = shapes.filter((s) => CLOSED_KINDS.has(s.kind) && s.kind !== 'blob' && bigEnough(s)).map((s) => closedFromStroke(s, group.index));
  const usedIds = new Set(closed.flatMap((c) => c.strokeIds));

  // Straight pieces that could form a polygon, axes or cube edges.
  const straight = shapes.filter((s) => !usedIds.has(s.strokeId) && (s.kind === 'line' || s.kind === 'polyline') && s.length >= Math.max(12, 0.8 * medH));
  const straightSegments = straight.flatMap((s) => s.segments);
  const cube = straightSegments.length >= 7 && looksLikeCube(straightSegments);
  if (cube) straight.forEach((s) => usedIds.add(s.strokeId));
  const chained = !cube && straight.length >= 2 ? chainSegments(straight.map((s) => ({ strokeId: s.strokeId, segments: s.segments }))) : null;
  if (chained && diagOf(bboxOf(chained.corners)) >= MIN_SHAPE_SIZE) {
    closed.push({ kind: classifyCorners(chained.corners), strokeIds: chained.strokeIds, bbox: bboxOf(chained.corners), corners: chained.corners, groupIndex: group.index });
    chained.strokeIds.forEach((id) => usedIds.add(id));
  }

  const arrows: Arrow[] = shapes
    .filter((s) => s.kind === 'arrow' && !usedIds.has(s.strokeId) && s.length >= 0.75 * MIN_LINE_SIZE && dist(s.tail!, s.head!) >= 0.5 * MIN_LINE_SIZE && (shapes.length <= 3 || s.length >= 2 * medH))
    .map((s) => ({ strokeIds: [s.strokeId], tail: s.tail!, head: s.head!, groupIndex: group.index, ...(s.curved ? { curved: true } : {}) }));
  arrows.forEach((a) => a.strokeIds.forEach((id) => usedIds.add(id)));
  const shaftCandidates = shapes.filter((s) => !usedIds.has(s.strokeId) && (s.kind === 'line' || s.kind === 'polyline' || s.kind === 'curve'));
  const marks = shapes.filter((s) => !usedIds.has(s.strokeId) && (shapes.length <= 2 || s.diag <= Math.max(2.5 * medH, 0.35 * Math.max(gw, gh))));
  const composite = findCompositeArrows(shaftCandidates, marks, group.index, shapes.length >= 4 ? Math.max(25, 2 * medH) : 25);
  arrows.push(...composite.arrows);
  composite.used.forEach((id) => usedIds.add(id));

  const segmentSources = shapes.filter((s) => !usedIds.has(s.strokeId) && (s.kind === 'line' || s.kind === 'polyline') && s.length >= MIN_LINE_SIZE);
  const axisSegments = [
    ...segmentSources.flatMap((s) => s.segments.map((seg) => ({ seg, strokeId: s.strokeId }))),
    ...arrows.map((a) => ({ seg: { a: a.tail, b: a.head }, strokeId: a.strokeIds[0] })),
  ];
  const axes = findAxes(axisSegments, group.index);
  axes?.strokeIds.forEach((id) => usedIds.add(id));

  const rest = shapes.filter((s) => !usedIds.has(s.strokeId));
  const looseMin = shapes.length <= 2 ? MIN_LINE_SIZE : Math.max(MIN_LINE_SIZE * 0.5, 2 * medH);
  const looseStrokes = cube ? straight : rest.filter((s) => (s.kind === 'line' || s.kind === 'polyline') && s.length >= looseMin);
  const looseSegments = looseStrokes.flatMap((s) => s.segments);
  // Big smooth curves are drawings; angular polylines/vees only when clearly larger than a letter (Λ, L, V are letters too).
  const curves = rest.filter((s) => {
    if (s.kind !== 'curve' && s.kind !== 'polyline' && s.kind !== 'vee') return false;
    const min = s.kind === 'curve' ? MIN_LINE_SIZE : 1.5 * MIN_LINE_SIZE;
    return s.diag >= min && (shapes.length <= 2 ? s.diag >= 1.5 * MIN_LINE_SIZE : height(s.bbox) >= 1.8 * medH);
  });
  const graphicIds = new Set([...usedIds, ...curves.map((c) => c.strokeId)]);
  const textStrokes = shapes.filter((s) => !graphicIds.has(s.strokeId) && !(s.kind === 'line' && s.length >= MIN_LINE_SIZE));
  const textBox = textStrokes.length ? textStrokes.map((s) => s.bbox).reduce(unionBox) : null;
  const textLike = !!textBox && (textStrokes.length >= 3 ? width(textBox) >= 1.2 * height(textBox) || textStrokes.length >= 6 : textStrokes.every((s) => s.diag < MIN_SHAPE_SIZE * 1.5));
  // Letter stems (l, i, t, k) are short straight lines: a text line is only a drawing if its lines are long or it has no text.
  const longLines = looseSegments.filter((seg) => segLen(seg) >= MIN_LINE_SIZE).length;
  const graphic = cube || closed.length > 0 || arrows.length > 0 || !!axes || curves.length > 0 || longLines >= 3 || (looseStrokes.length >= 5 && !textLike);

  const analysis: GroupAnalysis = { index: group.index, bbox: group.bbox, shapes, closed, arrows, axes, cube, looseSegments, curves, textStrokes, textLike, graphic, hint: '' };
  analysis.hint = describeGroup(analysis);
  return analysis;
}

const px = (n: number) => `${Math.round(n)} px`;

export function describeShape(c: ClosedShape): string {
  const w = width(c.bbox), h = height(c.bbox);
  switch (c.kind) {
    case 'circle':
      return `circle ~${px((w + h) / 2)}`;
    case 'ellipse':
      return `ellipse ${px(w)}×${px(h)}`;
    case 'square':
      return `square ~${px((w + h) / 2)}`;
    case 'rectangle':
      return `rectangle ${px(w)}×${px(h)}`;
    case 'triangle':
      return `triangle ${px(w)}×${px(h)}`;
    case 'diamond':
      return `diamond ${px(w)}×${px(h)}`;
    default:
      return `closed ${c.corners.length}-sided shape ${px(w)}×${px(h)}`;
  }
}

function arrowDirection(a: Arrow): string {
  const dx = a.head.x - a.tail.x, dy = a.head.y - a.tail.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? '→ right' : '← left';
  return dy >= 0 ? '↓ down' : '↑ up';
}

function describeGroup(g: GroupAnalysis): string {
  const parts: string[] = [];
  if (g.cube) parts.push(`cube / 3D box drawn with ${g.looseSegments.length} straight edges, ~${px(diagOf(bboxOf(g.looseSegments.flatMap((s) => [s.a, s.b]))))}`);
  for (const c of g.closed) parts.push(`closed shape: ${describeShape(c)}`);
  for (const a of g.arrows) parts.push(`${a.curved ? 'curved arrow' : 'arrow'} ${arrowDirection(a)}, ${px(dist(a.tail, a.head))}`);
  if (g.axes) parts.push(`${g.axes.crossing ? 'crossing axes' : 'axes (L-shaped corner)'}: x-axis ${px(dist(g.axes.origin, g.axes.xEnd))}, y-axis ${px(dist(g.axes.origin, g.axes.yEnd))}`);
  if (g.curves.length) parts.push(`${g.curves.length === 1 ? 'a curved line' : `${g.curves.length} curved lines`} ~${px(Math.max(...g.curves.map((c) => c.diag)))}`);
  if (g.looseSegments.length && !g.cube && g.graphic) {
    const horiz = g.looseSegments.filter(isHorizontal).length, vert = g.looseSegments.filter(isVertical).length;
    parts.push(`${g.looseSegments.length} straight line${g.looseSegments.length > 1 ? 's' : ''}${g.looseSegments.length === 1 ? (horiz ? ' (horizontal)' : vert ? ' (vertical)' : '') : ''}`);
  }
  if (g.textStrokes.length) {
    const inside = g.closed.filter((c) => g.textStrokes.some((s) => contains(c.bbox, center(s.bbox))));
    const n = g.textStrokes.length;
    if (g.graphic) parts.push(`${n} short stroke${n > 1 ? 's' : ''} that look like text${inside.length ? ` written INSIDE the ${inside.map((c) => c.kind).join('/')} (a label)` : ''}`);
    else if (g.textLike) parts.push(`looks like text (${n} short stroke${n > 1 ? 's' : ''} on a baseline)`);
    else parts.push(`${n} stroke${n > 1 ? 's' : ''}`);
  }
  return parts.join('; ');
}

// ---------------------------------------------------------------- figures

class UnionFind {
  private parent = new Map<number, number>();
  find(x: number): number {
    let root = x;
    while (true) {
      const p = this.parent.get(root);
      if (p === undefined) {
        this.parent.set(root, root);
        break;
      }
      if (p === root) break;
      root = p;
    }
    while (x !== root) {
      const next = this.parent.get(x) ?? root;
      this.parent.set(x, root);
      x = next;
    }
    return root;
  }
  union(a: number, b: number) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

const FIGURE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const figureName = (id: number) => `Figure ${FIGURE_LETTERS[id % 26]}${id >= 26 ? Math.floor(id / 26) : ''}`;

/** Node ids in reading order: top-to-bottom rows, left-to-right inside a row. */
function readingOrder<T>(items: T[], box: (t: T) => BoundingBox, rowTol: number): T[] {
  return [...items].sort((a, b) => {
    const ba = box(a), bb = box(b);
    const ca = center(ba), cb = center(bb);
    return Math.abs(ca.y - cb.y) > rowTol ? ca.y - cb.y : ca.x - cb.x;
  });
}

/** Kahn's topological order over the forward edges; ties and disconnected nodes follow `rank`. */
function topologicalOrder(ids: string[], forward: { from: string; to: string }[], rank: Map<string, number>): string[] {
  const indeg = new Map(ids.map((id) => [id, 0]));
  const out = new Map(ids.map((id) => [id, [] as string[]]));
  for (const e of forward) {
    if (!indeg.has(e.from) || !indeg.has(e.to) || e.from === e.to) continue;
    indeg.set(e.to, indeg.get(e.to)! + 1);
    out.get(e.from)!.push(e.to);
  }
  const byRank = (a: string, b: string) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  const ready = ids.filter((id) => indeg.get(id) === 0).sort(byRank);
  const order: string[] = [];
  const done = new Set<string>();
  while (order.length < ids.length) {
    if (ready.length === 0) {
      // A cycle the back-edge detection missed: release the earliest-ranked remaining node.
      const rest = ids.filter((id) => !done.has(id)).sort(byRank);
      ready.push(rest[0]);
    }
    const id = ready.shift()!;
    if (done.has(id)) continue;
    done.add(id);
    order.push(id);
    for (const next of out.get(id)!) {
      indeg.set(next, indeg.get(next)! - 1);
      if (indeg.get(next) === 0 && !done.has(next)) {
        ready.push(next);
        ready.sort(byRank);
      }
    }
  }
  return order;
}

/** Distinct positions (sorted) after clustering values closer than `tol`. */
function clusterPositions(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[][] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last && v - last[last.length - 1] <= tol) last.push(v);
    else out.push([v]);
  }
  return out.map((c) => c.reduce((a, b) => a + b, 0) / c.length);
}

interface Grid {
  xs: number[];
  ys: number[];
  bbox: BoundingBox;
}

/**
 * Horizontal and vertical lines (loose segments plus the sides of drawn rectangles) that form a
 * lattice: every line spans (almost) the whole extent of the perpendicular lines. ≥ 4 cells.
 */
function detectGrid(segments: Segment[]): Grid | null {
  const long = segments.filter((sg) => segLen(sg) >= MIN_LINE_SIZE);
  const hs = long.filter(isHorizontal), vs = long.filter(isVertical);
  if (hs.length < 2 || vs.length < 2) return null;
  const left = Math.min(...vs.map((sg) => (sg.a.x + sg.b.x) / 2)), right = Math.max(...vs.map((sg) => (sg.a.x + sg.b.x) / 2));
  const top = Math.min(...hs.map((sg) => (sg.a.y + sg.b.y) / 2)), bottom = Math.max(...hs.map((sg) => (sg.a.y + sg.b.y) / 2));
  const w = right - left, h = bottom - top;
  if (w < MIN_LINE_SIZE || h < MIN_LINE_SIZE) return null;
  const spansX = (sg: Segment) => Math.min(sg.a.x, sg.b.x) <= left + 0.15 * w && Math.max(sg.a.x, sg.b.x) >= right - 0.15 * w;
  const spansY = (sg: Segment) => Math.min(sg.a.y, sg.b.y) <= top + 0.15 * h && Math.max(sg.a.y, sg.b.y) >= bottom - 0.15 * h;
  if (!hs.every(spansX) || !vs.every(spansY)) return null;
  const ys = clusterPositions(hs.map((sg) => (sg.a.y + sg.b.y) / 2), Math.max(10, 0.08 * h));
  const xs = clusterPositions(vs.map((sg) => (sg.a.x + sg.b.x) / 2), Math.max(10, 0.08 * w));
  const rows = ys.length - 1, cols = xs.length - 1;
  if (rows < 1 || cols < 1 || rows * cols < 4) return null;
  // Interior lines exist (a plain box split once is not a table).
  if (rows + cols - 2 < 2) return null;
  return { xs, ys, bbox: { left, top, right, bottom } };
}

interface Lifeline {
  seg: Segment;
  groupIndex: number;
  x: number;
  top: number;
  bottom: number;
}

const FLOW_TOLERANCE = 0.5;

/**
 * Analyse every stroke group of a region: per-group hints and the figures they form
 * (shapes connected by arrows, axes with their curves and labels, cubes, a shape with the
 * label written inside it, tables, lifelines, mind maps), with each figure's nodes, relations
 * and step order recovered from the geometry.
 */
export function analyseInk(strokes: InkStroke[], groups: GroupLike[]): InkAnalysis {
  const byId = new Map(strokes.map((s) => [s.id, s]));
  const analyses = groups.map((g) => analyseGroup(g, g.strokeIds.map((id) => byId.get(id)).filter((s): s is InkStroke => !!s)));
  const byIndex = new Map(analyses.map((a) => [a.index, a]));
  const closed = analyses.flatMap((a) => a.closed);
  const uf = new UnionFind();
  const edges: { from: number; to: number }[] = [];
  const labelInside: Record<number, number> = {};
  /** Text group → index into `closed` of the (smallest) shape it is written inside. */
  const labelShape = new Map<number, number>();
  /** Text groups pulled into a figure by an arrow or line (node names, edge labels). */
  const attached = new Set<number>();
  const textGroups = analyses.filter((a) => !a.graphic && a.textStrokes.length > 0);
  const shapeArea = (c: ClosedShape) => Math.max(1, width(c.bbox) * height(c.bbox));

  const boxInside = (inner: BoundingBox, outer: BoundingBox, pad = 3) => inner.left >= outer.left - pad && inner.top >= outer.top - pad && inner.right <= outer.right + pad && inner.bottom <= outer.bottom + pad;
  const nearestShape = (p: Offset, exclude: string[]): ClosedShape | undefined => {
    const near = closed
      .filter((c) => !c.strokeIds.some((id) => exclude.includes(id)))
      .map((c) => ({ c, d: boxDistance(c.bbox, p) }))
      .filter(({ c, d }) => d <= Math.max(20, 0.22 * diagOf(c.bbox)))
      .sort((a, b) => a.d - b.d || shapeArea(a.c) - shapeArea(b.c));
    if (near.length === 0) return undefined;
    let best = near[0].c;
    // A point inside a big box is "at distance 0" from it, yet an arrow ending there is aimed at
    // the smaller box drawn inside it that it touches.
    for (const { c } of near) if (c !== best && boxInside(c.bbox, best.bbox) && shapeArea(c) < shapeArea(best)) best = c;
    return best;
  };
  const nearestText = (p: Offset, maxD: number, exclude?: number): GroupAnalysis | undefined => {
    let best: GroupAnalysis | undefined, bestD = Infinity;
    for (const t of textGroups) {
      if (t.index === exclude) continue;
      const d = boxDistance(t.bbox, p);
      if (d <= maxD && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  };
  const arrowBox = (g: GroupAnalysis, a: Arrow) => g.shapes.filter((s) => a.strokeIds.includes(s.strokeId)).map((s) => s.bbox).reduce(unionBox, bboxOf([a.tail, a.head]));

  // Lifelines: long vertical lines with horizontal arrows running between them (sequence diagrams).
  const tall: Lifeline[] = analyses.flatMap((a) =>
    a.looseSegments
      .filter((sg) => isVertical(sg) && segLen(sg) >= 3 * MIN_LINE_SIZE)
      .map((sg) => ({ seg: sg, groupIndex: a.index, x: (sg.a.x + sg.b.x) / 2, top: Math.min(sg.a.y, sg.b.y), bottom: Math.max(sg.a.y, sg.b.y) })),
  );
  const lifelineAt = (p: Offset, len: number) => {
    const tol = Math.max(20, 0.12 * len);
    let best: number | undefined, bestD = Infinity;
    tall.forEach((l, i) => {
      const d = Math.abs(l.x - p.x);
      if (d <= tol && p.y >= l.top - 12 && p.y <= l.bottom + 12 && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  };
  const messages = new Map<Arrow, { from: number; to: number }>();
  const usedLifelines = new Set<number>();
  if (tall.length >= 2) {
    for (const g of analyses) {
      for (const a of g.arrows) {
        if (!isHorizontal({ a: a.tail, b: a.head })) continue;
        const len = dist(a.tail, a.head);
        const from = lifelineAt(a.tail, len), to = lifelineAt(a.head, len);
        if (from === undefined || to === undefined || from === to) continue;
        messages.set(a, { from, to });
        usedLifelines.add(from);
        usedLifelines.add(to);
        uf.union(g.index, tall[from].groupIndex);
        uf.union(g.index, tall[to].groupIndex);
      }
    }
    // Lifelines with no message still belong when they line up with the used ones.
    if (usedLifelines.size >= 2) {
      const ref = [...usedLifelines].map((i) => tall[i]);
      tall.forEach((l, i) => {
        if (usedLifelines.has(i)) return;
        const near = ref.find((r) => Math.abs(r.top - l.top) <= 0.25 * (r.bottom - r.top) && Math.abs(l.x - r.x) <= 4 * (r.bottom - r.top));
        if (near) {
          usedLifelines.add(i);
          uf.union(l.groupIndex, near.groupIndex);
        }
      });
    }
  }
  const lifelineGroups = new Set([...usedLifelines].map((i) => tall[i].groupIndex));
  // Plain lines whose two ends sit on different shapes connect them (graphs, trees, mind maps).
  const lineLinks: { from: number; to: number; toLabel?: number; groupIndex: number }[] = [];
  const linkGroups = new Set<number>();
  for (const g of analyses) {
    if (g.cube || g.axes || g.textLike) continue;
    for (const sg of g.looseSegments) {
      if (segLen(sg) < MIN_LINE_SIZE) continue;
      const from = nearestShape(sg.a, []), to = nearestShape(sg.b, []);
      if (from && to && from !== to) {
        lineLinks.push({ from: closed.indexOf(from), to: closed.indexOf(to), groupIndex: g.index });
        linkGroups.add(g.index);
        uf.union(g.index, from.groupIndex);
        uf.union(g.index, to.groupIndex);
      } else if ((from || to) && !(from && to)) {
        const shape = (from ?? to)!, free = from ? sg.b : sg.a;
        const t = nearestText(free, Math.max(14, 0.15 * segLen(sg)));
        if (t && !contains(shape.bbox, center(t.bbox))) {
          lineLinks.push({ from: closed.indexOf(shape), to: -1, toLabel: t.index, groupIndex: g.index });
          linkGroups.add(g.index);
          attached.add(t.index);
          uf.union(g.index, shape.groupIndex);
          uf.union(g.index, t.index);
        }
      }
    }
  }
  const isDrawing = (a: GroupAnalysis) => a.graphic || lifelineGroups.has(a.index) || linkGroups.has(a.index);

  for (const g of analyses) {
    if (!isDrawing(g)) continue;
    uf.find(g.index);
    for (const a of g.arrows) {
      if (messages.has(a)) continue;
      const box = arrowBox(g, a);
      const span = Math.max(dist(a.tail, a.head), 0.6 * diagOf(box));
      let from = nearestShape(a.tail, a.strokeIds);
      let to = nearestShape(a.head, a.strokeIds);
      if (from && to && from === to) {
        // A curved arrow that leaves and re-enters one shape is a self-loop; a straight arrow can't
        // do that — only its head counts.
        if (a.curved) a.selfLoop = true;
        else from = undefined;
      }
      if (from) {
        a.from = closed.indexOf(from);
        uf.union(g.index, from.groupIndex);
      }
      if (to) {
        a.to = closed.indexOf(to);
        uf.union(g.index, to.groupIndex);
      }
      const textTol = Math.max(16, 0.2 * span);
      if (!from) {
        const t = nearestText(a.tail, textTol);
        if (t && !(a.to !== undefined && contains(closed[a.to].bbox, center(t.bbox)))) {
          a.fromLabel = t.index;
          attached.add(t.index);
          uf.union(g.index, t.index);
        }
      }
      if (!to) {
        const t = nearestText(a.head, textTol, a.fromLabel);
        if (t && !(a.from !== undefined && contains(closed[a.from].bbox, center(t.bbox)))) {
          a.toLabel = t.index;
          attached.add(t.index);
          uf.union(g.index, t.index);
        }
      }
      if (from && to && from !== to) edges.push({ from: from.groupIndex, to: to.groupIndex });
    }
    // Drawn things that overlap each other are one figure (cube faces, axes + curve, nested shapes).
    for (const h of analyses) {
      if (h.index <= g.index) continue;
      if ((isDrawing(h) || h.looseSegments.length > 0) && intersects(g.bbox, h.bbox, 12)) uf.union(g.index, h.index);
    }
  }
  // Text beside the middle of an arrow is that arrow's label ("yes", "no", a message name); each
  // text goes to the arrow it sits closest to, relative to that arrow's size.
  const labelCandidates: { g: GroupAnalysis; a: Arrow; t: GroupAnalysis; score: number }[] = [];
  for (const g of analyses) {
    for (const a of g.arrows) {
      const m = mid(a.tail, a.head);
      const len = Math.max(dist(a.tail, a.head), diagOf(arrowBox(g, a)));
      const tol = Math.max(20, 0.3 * len);
      for (const t of textGroups) {
        if (attached.has(t.index) || width(t.bbox) > Math.max(1.6 * len, 80)) continue;
        const d = boxDistance(t.bbox, m);
        if (d <= tol && !closed.some((c) => contains(c.bbox, center(t.bbox)))) labelCandidates.push({ g, a, t, score: d / tol });
      }
    }
  }
  labelCandidates.sort((p, q) => p.score - q.score);
  for (const { g, a, t } of labelCandidates) {
    if (a.labelGroup !== undefined || attached.has(t.index)) continue;
    a.labelGroup = t.index;
    attached.add(t.index);
    uf.union(g.index, t.index);
  }
  for (const g of analyses) {
    for (const a of g.arrows) {
      if (a.labelGroup !== undefined) continue;
      const m = mid(a.tail, a.head);
      const len = Math.max(dist(a.tail, a.head), diagOf(arrowBox(g, a)));
      // Text strokes clustered into the arrow's own group, beside its middle and outside every shape.
      if (g.textStrokes.length && g.closed.length === 0 && g.arrows.length === 1) {
        const tb = g.textStrokes.map((st) => st.bbox).reduce(unionBox);
        if (boxDistance(tb, m) <= Math.max(20, 0.3 * len) && !closed.some((c) => contains(c.bbox, center(tb)))) a.labelGroup = g.index;
      }
    }
  }
  // Text written inside a shape is that shape's label (the innermost shape when they nest).
  for (const t of textGroups) {
    const c = center(t.bbox);
    const hosts = closed.filter((s) => contains(s.bbox, c) && width(t.bbox) <= 1.1 * width(s.bbox) && height(t.bbox) <= 1.1 * height(s.bbox));
    if (hosts.length === 0) continue;
    const host = hosts.reduce((a, b) => (shapeArea(a) <= shapeArea(b) ? a : b));
    labelShape.set(t.index, closed.indexOf(host));
    labelInside[t.index] = host.groupIndex;
    uf.union(t.index, host.groupIndex);
  }
  for (const g of analyses) {
    for (const c of g.closed) {
      const inside = g.textStrokes.some((s) => contains(c.bbox, center(s.bbox)));
      if (inside && labelInside[g.index] === undefined) labelInside[g.index] = g.index;
    }
  }

  const graphicRoots = new Set(analyses.filter(isDrawing).map((a) => uf.find(a.index)));
  const members = new Map<number, number[]>();
  for (const a of analyses) {
    const r = uf.find(a.index);
    if (!graphicRoots.has(r)) continue;
    if (!isDrawing(a) && !(a.index in labelInside) && !attached.has(a.index) && a.looseSegments.length === 0) continue;
    members.set(r, [...(members.get(r) ?? []), a.index]);
  }

  // Short text next to a figure (axis labels, arrow labels) belongs to it; a line of notes beside it does not.
  const figureBoxes = new Map<number, BoundingBox>();
  for (const [r, idx] of members) figureBoxes.set(r, idx.map((i) => byIndex.get(i)!.bbox).reduce(unionBox));
  const claimed = new Set([...members.values()].flat());
  for (const t of textGroups) {
    if (claimed.has(t.index)) continue;
    for (const [r, box] of figureBoxes) {
      const fw = width(box), fh = height(box);
      const pad = Math.max(24, 0.15 * Math.max(fw, fh));
      if (contains(expand(box, pad), center(t.bbox)) && width(t.bbox) <= 0.8 * fw && height(t.bbox) <= 0.5 * fh) {
        members.get(r)!.push(t.index);
        claimed.add(t.index);
        break;
      }
    }
  }

  const figures: FigureHint[] = [];
  const ordered = [...members.entries()].sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
  ordered.forEach(([, idx], id) => {
    const gs = idx.map((i) => byIndex.get(i)!);
    const groupIndices = [...idx].sort((a, b) => a - b);
    const inFigure = (i: number) => groupIndices.includes(i);
    const figEdges = edges.filter((e) => inFigure(e.from) && inFigure(e.to));
    const closedHere = gs.flatMap((g) => g.closed);
    const rectEdges = closedHere.filter((c) => c.kind === 'rectangle' || c.kind === 'square').flatMap((c) => c.corners.map((p, i) => ({ a: p, b: c.corners[(i + 1) % c.corners.length] })));
    const allSegments = gs.flatMap((g) => [
      ...g.looseSegments,
      ...g.closed.flatMap((c) => c.corners.map((p, i) => ({ a: p, b: c.corners[(i + 1) % c.corners.length] }))),
      ...(g.axes ? [{ a: g.axes.origin, b: g.axes.xEnd }, { a: g.axes.origin, b: g.axes.yEnd }] : []),
    ]);
    const cube = gs.some((g) => g.cube) || (closedHere.every((c) => c.corners.length === 4 || c.kind === 'polygon') && looksLikeCube(allSegments));
    const axes = gs.find((g) => g.axes)?.axes ?? null;
    const arrows = gs.flatMap((g) => g.arrows);
    const curves = gs.flatMap((g) => g.curves);
    const lifelines = tall.map((l, i) => ({ l, i })).filter(({ l, i }) => usedLifelines.has(i) && inFigure(l.groupIndex)).sort((a, b) => a.l.x - b.l.x);
    const grid = !cube && !axes && lifelines.length === 0 ? detectGrid([...gs.flatMap((g) => g.looseSegments), ...rectEdges]) : null;
    const figBox = gs.map((g) => g.bbox).reduce(unionBox);

    // ---- nodes
    const nodes: FigureNodeHint[] = [];
    const nodeOfShape = new Map<number, FigureNodeHint>();
    const nodeOfText = new Map<number, FigureNodeHint>();
    const nodeOfLifeline = new Map<number, FigureNodeHint>();
    const rowTol = Math.max(18, 0.1 * height(figBox));
    if (lifelines.length) {
      for (const { l, i } of lifelines) {
        const own = byIndex.get(l.groupIndex)!;
        // A box sitting on top of the line is the lifeline's head: it names the lifeline rather than being a node.
        const head = closedHere.find((c) => Math.abs(c.bbox.bottom - l.top) <= 16 && Math.abs(center(c.bbox).x - l.x) <= Math.max(12, 0.5 * width(c.bbox)));
        const headLabel = head ? [...labelShape.entries()].find(([, ci]) => closed[ci] === head)?.[0] : undefined;
        const above = textGroups.find((t) => t.bbox.bottom <= l.top + 10 && t.bbox.bottom >= l.top - 90 && Math.abs(center(t.bbox).x - l.x) <= Math.max(30, 0.6 * width(t.bbox)));
        const labelGroup = headLabel ?? (head && labelInside[head.groupIndex] === head.groupIndex ? head.groupIndex : undefined) ?? above?.index ?? (own.textStrokes.length ? own.index : undefined);
        const node: FigureNodeHint = { id: '', groupIndex: l.groupIndex, shape: 'lifeline', bbox: head ? unionBox(head.bbox, bboxOf([l.seg.a, l.seg.b])) : bboxOf([l.seg.a, l.seg.b]) };
        if (labelGroup !== undefined) node.labelGroup = labelGroup;
        nodes.push(node);
        nodeOfLifeline.set(i, node);
        if (head) nodeOfShape.set(closed.indexOf(head), node);
      }
    }
    if (!cube && !grid) {
      for (const c of closedHere) {
        const ci = closed.indexOf(c);
        if (nodeOfShape.has(ci)) continue;
        const node: FigureNodeHint = { id: '', groupIndex: c.groupIndex, shape: c.kind, bbox: c.bbox };
        const inside = [...labelShape.entries()].find(([, idx2]) => idx2 === ci)?.[0];
        if (inside !== undefined) node.labelGroup = inside;
        else if (labelInside[c.groupIndex] === c.groupIndex && byIndex.get(c.groupIndex)!.closed.length === 1) node.labelGroup = c.groupIndex;
        nodes.push(node);
        nodeOfShape.set(ci, node);
      }
    }
    const textNode = (t: number): FigureNodeHint => {
      let node = nodeOfText.get(t);
      if (!node) {
        const g = byIndex.get(t)!;
        node = { id: '', groupIndex: t, shape: 'text', bbox: g.bbox, labelGroup: t };
        nodes.push(node);
        nodeOfText.set(t, node);
      }
      return node;
    };
    for (const a of arrows) {
      if (a.fromLabel !== undefined && inFigure(a.fromLabel)) textNode(a.fromLabel);
      if (a.toLabel !== undefined && inFigure(a.toLabel)) textNode(a.toLabel);
    }
    for (const l of lineLinks) if (inFigure(l.groupIndex) && l.toLabel !== undefined) textNode(l.toLabel);
    // Nesting from bbox containment (innermost enclosing shape = parent); ids in reading order,
    // a container right before the nodes drawn inside it.
    const area = (b: BoundingBox) => Math.max(1, width(b) * height(b));
    const parentOf = new Map<FigureNodeHint, FigureNodeHint>();
    for (const n of nodes) {
      const enclosing = nodes.filter((m) => m !== n && m.shape !== 'text' && m.shape !== 'lifeline' && area(m.bbox) > 1.2 * area(n.bbox) && boxInside(n.bbox, m.bbox));
      if (enclosing.length) parentOf.set(n, enclosing.reduce((a, b) => (area(a.bbox) <= area(b.bbox) ? a : b)));
    }
    const numbered: FigureNodeHint[] = [];
    const assign = (parent: FigureNodeHint | undefined) => {
      for (const n of readingOrder(nodes.filter((m) => parentOf.get(m) === parent), (m) => m.bbox, rowTol)) {
        n.id = `n${numbered.length + 1}`;
        numbered.push(n);
        assign(n);
      }
    };
    assign(undefined);
    for (const n of nodes) {
      if (numbered.includes(n)) continue;
      n.id = `n${numbered.length + 1}`;
      numbered.push(n);
    }
    nodes.splice(0, nodes.length, ...numbered);
    for (const [n, p] of parentOf) n.parent = p.id;

    // ---- relations
    const relations: FigureRelationHint[] = [];
    const endpoint = (a: Arrow, which: 'from' | 'to'): FigureNodeHint | undefined => {
      const msg = messages.get(a);
      if (msg) return nodeOfLifeline.get(msg[which]);
      const shapeIdx = a[which];
      if (shapeIdx !== undefined && nodeOfShape.has(shapeIdx)) return nodeOfShape.get(shapeIdx);
      const t = which === 'from' ? a.fromLabel : a.toLabel;
      return t !== undefined ? nodeOfText.get(t) : undefined;
    };
    const arrowRelations: { rel: FigureRelationHint; a: Arrow }[] = [];
    const seenRel = new Set<string>();
    const pushRel = (rel: FigureRelationHint, a?: Arrow) => {
      const key = `${rel.from}>${rel.to}>${rel.kind}>${rel.labelGroup ?? ''}`;
      if (seenRel.has(key)) return;
      seenRel.add(key);
      relations.push(rel);
      if (a) arrowRelations.push({ rel, a });
    };
    const sortedArrows = lifelines.length ? [...arrows].sort((p, q) => mid(p.tail, p.head).y - mid(q.tail, q.head).y) : arrows;
    for (const a of sortedArrows) {
      const from = endpoint(a, 'from'), to = endpoint(a, 'to');
      if (a.selfLoop && (from ?? to)) {
        const n = (from ?? to)!;
        pushRel({ from: n.id, to: n.id, kind: 'self-loop', ...(a.labelGroup !== undefined ? { labelGroup: a.labelGroup } : {}) }, a);
      } else if (from && to && from !== to) {
        pushRel({ from: from.id, to: to.id, kind: 'arrow', ...(a.labelGroup !== undefined ? { labelGroup: a.labelGroup } : {}) }, a);
      }
    }
    for (const l of lineLinks) {
      if (!inFigure(l.groupIndex)) continue;
      const from = nodeOfShape.get(l.from);
      const to = l.toLabel !== undefined ? nodeOfText.get(l.toLabel) : nodeOfShape.get(l.to);
      if (from && to && from !== to) pushRel({ from: from.id, to: to.id, kind: 'line' });
    }
    // Back-edges: arrows pointing against the main flow direction.
    const directed = arrowRelations.filter((r) => r.rel.kind === 'arrow');
    let flow: Offset | null = null;
    if (directed.length >= 2) {
      const sum = { x: 0, y: 0 };
      for (const { a } of directed) {
        const L = dist(a.tail, a.head) || 1;
        sum.x += (a.head.x - a.tail.x) / L;
        sum.y += (a.head.y - a.tail.y) / L;
      }
      const mag = Math.hypot(sum.x, sum.y);
      // A clear majority direction (two arrows down and one back up still flows down).
      if (mag > 0.3 * directed.length) flow = { x: sum.x / mag, y: sum.y / mag };
    }
    if (flow) {
      for (const { rel, a } of directed) {
        const L = dist(a.tail, a.head) || 1;
        const along = ((a.head.x - a.tail.x) * flow.x + (a.head.y - a.tail.y) * flow.y) / L;
        if (along < -FLOW_TOLERANCE) rel.back = true;
      }
    }
    // Decision diamonds: a diamond with arrows in a flowchart.
    for (const n of nodes) if (n.shape === 'diamond' && relations.some((r) => r.kind === 'arrow' && (r.from === n.id || r.to === n.id))) n.decision = true;

    // ---- kind
    const hub = (() => {
      if (nodes.length < 4 || relations.length < 3) return null;
      const degree = new Map<string, number>();
      for (const r of relations) {
        if (r.kind === 'self-loop') continue;
        degree.set(r.from, (degree.get(r.from) ?? 0) + 1);
        degree.set(r.to, (degree.get(r.to) ?? 0) + 1);
      }
      const [hubId, deg] = [...degree.entries()].sort((a, b) => b[1] - a[1])[0];
      if (deg < 3 || !relations.every((r) => r.kind === 'self-loop' || r.from === hubId || r.to === hubId)) return null;
      const h = nodes.find((n) => n.id === hubId)!;
      const spokes = nodes.filter((n) => n !== h && relations.some((r) => (r.from === hubId && r.to === n.id) || (r.to === hubId && r.from === n.id)));
      const c = center(h.bbox);
      const angles = spokes.map((n) => Math.atan2(center(n.bbox).y - c.y, center(n.bbox).x - c.x));
      const spread = Math.max(...angles) - Math.min(...angles);
      // Spokes all around the hub (not just a fan to one side).
      if (spread < Math.PI * 0.9 && !(angles.some((t) => t > Math.PI / 2) && angles.some((t) => t < -Math.PI / 2))) return null;
      return { h, spokes, angles };
    })();
    const arrowCount = relations.filter((r) => r.kind === 'arrow').length;
    const isTree = (() => {
      if (arrowCount < 2 || nodes.length < 3 || relations.some((r) => r.back || r.kind === 'self-loop')) return false;
      const indeg = new Map<string, number>();
      for (const r of relations) if (r.kind === 'arrow') indeg.set(r.to, (indeg.get(r.to) ?? 0) + 1);
      if ([...indeg.values()].some((d) => d > 1)) return false;
      const roots = nodes.filter((n) => !indeg.has(n.id) && relations.some((r) => r.from === n.id));
      if (roots.length !== 1) return false;
      const branching = relations.filter((r) => r.kind === 'arrow').map((r) => r.from);
      return new Set(branching).size < branching.length && !!flow && flow.y > 0.7;
    })();
    let kind: FigureKind;
    if (cube) kind = 'cube';
    else if (axes) kind = 'plot';
    else if (grid) kind = 'table';
    else if (lifelines.length >= 2) kind = 'sequence';
    else if (hub) kind = 'mindmap';
    else if (isTree) kind = 'tree';
    else if (arrowCount > 0 || figEdges.length > 0) kind = 'flowchart';
    else if (relations.length > 0 && nodes.length >= 2) kind = 'graph';
    else if (closedHere.length === 1 && arrows.length === 0) kind = 'shape';
    else kind = 'sketch';

    // ---- order
    let order: string[] = [];
    let orderBasis = '';
    const rank = new Map<string, number>();
    const horizontalLayout = width(figBox) >= 1.4 * height(figBox);
    nodes.forEach((n) => rank.set(n.id, horizontalLayout ? center(n.bbox).x : center(n.bbox).y * 10 + center(n.bbox).x / 1000));
    if (hub) {
      // Angle from "straight up", clockwise; the small offset keeps a branch drawn exactly above the hub first.
      const spokes = hub.spokes.map((n, i) => ({ n, a: (hub.angles[i] + Math.PI / 2 + 0.05 + 4 * Math.PI) % (2 * Math.PI) })).sort((p, q) => p.a - q.a);
      order = [hub.h.id, ...spokes.map((s) => s.n.id)];
      orderBasis = 'hub first, then clockwise from top';
    } else if (lifelines.length >= 2) {
      order = nodes.filter((n) => n.shape === 'lifeline').map((n) => n.id);
      orderBasis = 'left→right';
    } else if (arrowCount > 0) {
      const forward = relations.filter((r) => r.kind === 'arrow' && !r.back);
      const linked = (n: FigureNodeHint) => relations.some((r) => r.from === n.id || r.to === n.id);
      const container = (n: FigureNodeHint) => nodes.some((m) => m.parent === n.id);
      const stepNodes = nodes.filter((n) => linked(n) || (n.parent === undefined && !container(n)));
      order = topologicalOrder(stepNodes.map((n) => n.id), forward, rank);
      orderBasis = 'arrow order';
    } else if (nodes.length >= 2 && !grid) {
      order = [...nodes].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!).map((n) => n.id);
      orderBasis = horizontalLayout ? 'left→right' : 'top→bottom';
    }

    if (!lifelines.length && order.length) {
      const pos = (id: string) => {
        const i = order.indexOf(id);
        return i < 0 ? order.length + nodes.findIndex((n) => n.id === id) : i;
      };
      relations.sort((a, b) => pos(a.from) - pos(b.from) || (a.kind === 'self-loop' ? 1 : 0) - (b.kind === 'self-loop' ? 1 : 0) || pos(a.to) - pos(b.to));
    }

    // ---- table cells
    let cells: number[][] | undefined;
    if (grid) {
      const cellOf = (p: Offset) => {
        const col = grid.xs.findIndex((x, i) => i < grid.xs.length - 1 && p.x >= x && p.x < grid.xs[i + 1]);
        const row = grid.ys.findIndex((y, i) => i < grid.ys.length - 1 && p.y >= y && p.y < grid.ys[i + 1]);
        return row >= 0 && col >= 0 ? { row, col } : null;
      };
      cells = Array.from({ length: grid.ys.length - 1 }, () => Array<number>(grid.xs.length - 1).fill(-1));
      const place = (groupIndex: number, p: Offset) => {
        const cell = cellOf(p);
        if (cell && cells![cell.row][cell.col] === -1) cells![cell.row][cell.col] = groupIndex;
      };
      for (const t of textGroups) {
        if (!contains(grid.bbox, center(t.bbox))) continue;
        place(t.index, center(t.bbox));
        if (!inFigure(t.index)) {
          groupIndices.push(t.index);
          groupIndices.sort((a, b) => a - b);
          claimed.add(t.index);
        }
      }
      for (const g of gs) if (g.graphic && g.textStrokes.length) place(g.index, center(g.textStrokes.map((s) => s.bbox).reduce(unionBox)));
    }

    const labelGroups = groupIndices.filter((i) => !byIndex.get(i)!.graphic && byIndex.get(i)!.textStrokes.length > 0 && !lifelineGroups.has(i));
    const shapes: string[] = [];
    if (cube) shapes.push('cube / 3D box');
    else closedHere.forEach((c) => shapes.push(describeShape(c)));
    if (axes && !cube) shapes.push(axes.crossing ? 'crossing axes' : 'x/y axes');
    if (grid) shapes.push(`${grid.ys.length - 1}×${grid.xs.length - 1} grid`);
    if (lifelines.length) shapes.push(`${lifelines.length} lifelines`);
    curves.forEach(() => shapes.push('curve'));
    if (!cube) arrows.forEach((a) => shapes.push(a.selfLoop ? 'self-loop arrow' : a.curved ? 'curved arrow' : 'arrow'));

    const labelled = labelGroups.filter((i) => labelInside[i] !== undefined);
    const selfLabelled = groupIndices.filter((i) => byIndex.get(i)!.graphic && labelInside[i] === i);
    const hostGroups = new Set(selfLabelled);
    for (const n of nodes) if (n.labelGroup !== undefined && byIndex.get(n.labelGroup)?.graphic) hostGroups.add(n.labelGroup);
    for (const r of relations) if (r.labelGroup !== undefined && byIndex.get(r.labelGroup)?.graphic) hostGroups.add(r.labelGroup);
    for (const g of gs) if (g.graphic && g.textStrokes.length && grid) hostGroups.add(g.index);
    const nameOf = (n: FigureNodeHint) => {
      const what = n.decision ? 'decision diamond' : n.shape === 'text' ? 'text' : n.shape;
      const where = n.shape === 'text' ? `group ${n.groupIndex}` : `group ${n.groupIndex}${n.labelGroup !== undefined && n.labelGroup !== n.groupIndex ? `, label group ${n.labelGroup}` : n.labelGroup === n.groupIndex ? ', label inside' : ', no label'}`;
      return `${n.id} ${what} (${where})`;
    };
    const relText = (r: FigureRelationHint) => {
      const label = r.labelGroup !== undefined ? ` (label group ${r.labelGroup})` : '';
      if (r.kind === 'self-loop') return `${r.from} ↺ self-loop${label}`;
      if (r.kind === 'line') return `${r.from} — ${r.to}${label}`;
      return `${r.from} → ${r.to}${label}${r.back ? ' (back-edge)' : ''}`;
    };
    const summaryParts: string[] = [];
    if (cube) summaryParts.push(`a cube / 3D box drawn with ${allSegments.length} edges`);
    if (axes && !cube) summaryParts.push(`${axes.crossing ? 'crossing' : 'L-shaped'} x/y axes${curves.length ? ` with ${curves.length} curve${curves.length > 1 ? 's' : ''} plotted` : ''}`);
    if (grid && cells) {
      summaryParts.push(`table grid ${cells.length} rows × ${cells[0].length} columns`);
      summaryParts.push(`cells row by row: ${cells.map((row) => `[${row.map((c) => (c >= 0 ? `group ${c}` : '—')).join(', ')}]`).join(', ')}`);
    } else if (lifelines.length >= 2) {
      summaryParts.push(`lifelines (vertical lines) left→right: ${nodes.filter((n) => n.shape === 'lifeline').map(nameOf).join(', ')}`);
      if (relations.length) summaryParts.push(`messages in time order (top→bottom): ${relations.map(relText).join(', ')}`);
    } else if (!cube && nodes.length) {
      summaryParts.push(`nodes: ${nodes.map(nameOf).join(', ')}`);
      if (hub) summaryParts.push(`hub ${hub.h.id} with ${hub.spokes.length} branches around it (mind map)`);
      if (relations.length) summaryParts.push(`edges: ${relations.map(relText).join(', ')}`);
      const nested = nodes.filter((n) => n.parent !== undefined);
      if (nested.length) summaryParts.push(`nested: ${nested.map((n) => `${n.id} inside ${n.parent}`).join(', ')}`);
      if (order.length >= 2) summaryParts.push(`step order (${orderBasis}): ${order.join(', ')}`);
    }
    const dangling = arrows.filter((a) => a.from === undefined && a.to === undefined && a.fromLabel === undefined && a.toLabel === undefined && !messages.has(a)).length;
    if (dangling && !cube) summaryParts.push(`${dangling} free arrow${dangling > 1 ? 's' : ''}`);
    if (labelled.length) summaryParts.push(`labels written inside shapes: ${labelled.map((i) => `group ${i} inside group ${labelInside[i]}`).join(', ')}`);
    if (selfLabelled.length) summaryParts.push(`text strokes inside the shape in group ${selfLabelled.join(', ')} (labels)`);
    const edgeLabelGroups = new Set(relations.map((r) => r.labelGroup).filter((x): x is number => x !== undefined));
    const nodeLabelGroups = new Set(nodes.map((n) => n.labelGroup).filter((x): x is number => x !== undefined));
    const nearby = labelGroups.filter((i) => labelInside[i] === undefined && !edgeLabelGroups.has(i) && !nodeLabelGroups.has(i) && !(cells && cells.some((row) => row.includes(i))));
    if (nearby.length) summaryParts.push(`nearby labels: group ${nearby.join(', ')}`);

    const fig: FigureHint = {
      id,
      groupIndices,
      kind,
      shapes,
      labelGroups,
      labelInside: Object.fromEntries(labelled.map((i) => [i, labelInside[i]])),
      labelHostGroups: [...hostGroups].sort((a, b) => a - b),
      edges: figEdges,
      nodes,
      relations,
      order,
      orderBasis,
      summary: `${figureName(id)} (${kind}; groups ${groupIndices.join(', ')}): ${summaryParts.join('; ')}`,
    };
    if (cells) fig.cells = cells;
    figures.push(fig);
  });

  const hints = new Map<number, string>();
  for (const a of analyses) {
    const fig = figures.find((f) => f.groupIndices.includes(a.index));
    let hint = a.hint;
    if (fig) {
      const node = fig.nodes.find((n) => n.labelGroup === a.index && n.groupIndex !== a.index);
      const edge = fig.relations.find((r) => r.labelGroup === a.index);
      const role = a.graphic
        ? 'drawing'
        : lifelineGroups.has(a.index)
          ? `drawing (lifeline ${fig.nodes.find((n) => n.groupIndex === a.index)?.id ?? ''})`.replace(/ \)$/, ')')
          : fig.cells?.some((row) => row.includes(a.index))
            ? 'table cell text'
            : labelInside[a.index] !== undefined
              ? `label inside group ${labelInside[a.index]}${node ? ` = name of ${node.id}` : ''}`
              : node
                ? `name of ${node.id}`
                : edge
                  ? `label on the arrow ${edge.from} → ${edge.to}`
                  : 'label';
      hint = `${hint}${hint ? ' — ' : ''}part of ${figureName(fig.id)} (${role})`;
    }
    if (hint) hints.set(a.index, hint);
  }
  return { groups: analyses, figures, hints };
}

/** Group indices the geometry says are drawings: the model must not transcribe them as text. */
export function graphicGroupIndices(analysis: InkAnalysis): Set<number> {
  return new Set(analysis.groups.filter((g) => g.graphic).map((g) => g.index));
}

/** Display name of a geometry node: the text written in/at it, else its shape and group. */
export function nodeName(fig: FigureHint, node: FigureNodeHint, labelFor: (groupIndex: number) => string | undefined): string {
  const fromLabel = node.labelGroup !== undefined ? labelFor(node.labelGroup) : undefined;
  if (fromLabel) return fromLabel;
  const inside = Object.entries(fig.labelInside).find(([, host]) => host === node.groupIndex)?.[0];
  const viaGroup = (inside !== undefined ? labelFor(Number(inside)) : undefined) ?? labelFor(node.groupIndex);
  if (viaGroup) return viaGroup;
  const same = fig.nodes.filter((n) => n.shape === node.shape);
  return same.length > 1 ? `${node.shape} ${same.indexOf(node) + 1}` : node.shape === 'text' ? `text (group ${node.groupIndex})` : node.shape;
}

/**
 * The structured figure the geometry alone supports: named nodes (with shape and nesting),
 * relations as edges, the step order and table cells, using `labelFor` to turn label groups
 * into the words the model read there.
 */
export interface GeometryFigure extends Pick<FigureInfo, 'nodes' | 'edges' | 'sequence' | 'cells'> {
  /** Node names that are shape placeholders ("rectangle 2") because no label text was read for them. */
  unnamed: string[];
}

export function figureFromGeometry(fig: FigureHint, labelFor: (groupIndex: number) => string | undefined): GeometryFigure {
  const names = new Map<string, string>();
  const used = new Map<string, number>();
  const unnamed: string[] = [];
  for (const n of fig.nodes) {
    let name = nodeName(fig, n, labelFor);
    const placeholder = !(n.labelGroup !== undefined && labelFor(n.labelGroup)) && !labelFor(n.groupIndex);
    const count = used.get(name.toLowerCase()) ?? 0;
    used.set(name.toLowerCase(), count + 1);
    if (count > 0) name = `${name} (${count + 1})`;
    names.set(n.id, name);
    if (placeholder) unnamed.push(name);
  }
  const nodes: FigureNode[] = fig.nodes.map((n) => {
    const node: FigureNode = { id: n.id, label: names.get(n.id)!, shape: n.decision ? 'decision diamond' : n.shape };
    if (n.parent !== undefined) node.parent = n.parent;
    if (n.labelGroup !== undefined) node.group = n.labelGroup;
    return node;
  });
  const edges: FigureEdge[] = fig.relations.map((r) => {
    const e: FigureEdge = { from: names.get(r.from)!, to: names.get(r.to)!, kind: r.kind };
    const label = r.labelGroup !== undefined ? labelFor(r.labelGroup) : undefined;
    if (label) e.label = label;
    return e;
  });
  const out: GeometryFigure = { nodes, edges, unnamed };
  if (fig.order.length >= 2) out.sequence = fig.order.map((id) => names.get(id)!).filter((s, i, arr) => arr.indexOf(s) === i);
  if (fig.cells) out.cells = fig.cells.map((row) => row.map((g) => (g >= 0 ? labelFor(g) ?? '' : '')));
  return out;
}

/** Convert geometry edges into named figure edges using label text per group. */
export function namedEdges(fig: FigureHint, labelFor: (groupIndex: number) => string | undefined): FigureEdge[] {
  return figureFromGeometry(fig, labelFor).edges;
}
