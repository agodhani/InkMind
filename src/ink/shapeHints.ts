import type { BoundingBox, Offset } from '../types';
import type { InkStroke } from '../model/page';
import type { FigureEdge, FigureKind } from '../model/page';

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

export interface FigureHint {
  id: number;
  groupIndices: number[];
  kind: FigureKind;
  shapes: string[];
  /** Group indices of text that belongs to the figure (labels inside shapes, axis labels). */
  labelGroups: number[];
  /** Group index → group index of the shape it is written inside. */
  labelInside: Record<number, number>;
  /** Connectivity between closed shapes, by group index. */
  edges: { from: number; to: number }[];
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
  const arrow = singleStrokeArrow(simp, segs, length);
  if (arrow) return { ...open('arrow', simp, [arrow.shaft]), head: arrow.head, tail: arrow.tail };

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
const HEAD_KINDS = new Set<StrokeShapeKind>(['vee', 'polyline', 'curve', 'triangle', 'line', 'arrow']);

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
        if (m.diag > (m.kind === 'line' ? 0.3 : 0.45) * shaft.length || m.diag < 3) return false;
        // The shaft tip touches the head, and the head sits on the shaft's axis.
        if (!contains(m.bbox, tip, Math.max(4, 0.05 * shaft.length))) return false;
        if (perpDistance(center(m.bbox), shaft.start, shaft.end) > 0.4 * m.diag + 2) return false;
        return dist(center(m.bbox), tip) <= Math.max(14, 0.3 * shaft.length);
      });
      if (heads.length >= 1 && heads.length <= 3) {
        arrows.push({ strokeIds: [shaft.strokeId, ...heads.map((h) => h.strokeId)], tail, head: tip, groupIndex });
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
    .filter((s) => s.kind === 'arrow' && !usedIds.has(s.strokeId) && s.length >= 0.75 * MIN_LINE_SIZE && (shapes.length <= 3 || s.length >= 2 * medH))
    .map((s) => ({ strokeIds: [s.strokeId], tail: s.tail!, head: s.head!, groupIndex: group.index }));
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
  const looseSegments = cube ? straightSegments : rest.filter((s) => (s.kind === 'line' || s.kind === 'polyline') && s.length >= Math.max(MIN_LINE_SIZE * 0.5, 2 * medH)).flatMap((s) => s.segments);
  const curves = rest.filter((s) => (s.kind === 'curve' || s.kind === 'polyline' || s.kind === 'vee') && s.diag >= MIN_LINE_SIZE && (shapes.length <= 2 || height(s.bbox) >= 1.8 * medH));
  const graphicIds = new Set([...usedIds, ...curves.map((c) => c.strokeId)]);
  const textStrokes = shapes.filter((s) => !graphicIds.has(s.strokeId) && !(s.kind === 'line' && s.length >= MIN_LINE_SIZE));
  const textBox = textStrokes.length ? textStrokes.map((s) => s.bbox).reduce(unionBox) : null;
  const textLike = !!textBox && (textStrokes.length >= 3 ? width(textBox) >= 1.2 * height(textBox) || textStrokes.length >= 6 : textStrokes.every((s) => s.diag < MIN_SHAPE_SIZE * 1.5));
  const graphic = cube || closed.length > 0 || arrows.length > 0 || !!axes || curves.length > 0 || looseSegments.length >= 5;

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
  for (const a of g.arrows) parts.push(`arrow ${arrowDirection(a)}, ${px(dist(a.tail, a.head))}`);
  if (g.axes) parts.push(`${g.axes.crossing ? 'crossing axes' : 'axes (L-shaped corner)'}: x-axis ${px(dist(g.axes.origin, g.axes.xEnd))}, y-axis ${px(dist(g.axes.origin, g.axes.yEnd))}`);
  if (g.curves.length) parts.push(`${g.curves.length === 1 ? 'a curved line' : `${g.curves.length} curved lines`} ~${px(Math.max(...g.curves.map((c) => c.diag)))}`);
  if (g.looseSegments.length && !g.cube) {
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

/**
 * Analyse every stroke group of a region: per-group hints and the figures they form
 * (shapes connected by arrows, axes with their curves and labels, cubes, a shape with the
 * label written inside it).
 */
export function analyseInk(strokes: InkStroke[], groups: GroupLike[]): InkAnalysis {
  const byId = new Map(strokes.map((s) => [s.id, s]));
  const analyses = groups.map((g) => analyseGroup(g, g.strokeIds.map((id) => byId.get(id)).filter((s): s is InkStroke => !!s)));
  const byIndex = new Map(analyses.map((a) => [a.index, a]));
  const closed = analyses.flatMap((a) => a.closed);
  const uf = new UnionFind();
  const edges: { from: number; to: number }[] = [];
  const labelInside: Record<number, number> = {};

  const nearestShape = (p: Offset, exclude: string[]): ClosedShape | undefined => {
    let best: ClosedShape | undefined, bestD = Infinity;
    for (const c of closed) {
      if (c.strokeIds.some((id) => exclude.includes(id))) continue;
      const d = boxDistance(c.bbox, p);
      const tol = Math.max(18, 0.2 * diagOf(c.bbox));
      if (d <= tol && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  };

  for (const g of analyses) {
    if (!g.graphic) continue;
    uf.find(g.index);
    for (const a of g.arrows) {
      const from = nearestShape(a.tail, a.strokeIds);
      const to = nearestShape(a.head, a.strokeIds);
      if (from) {
        a.from = closed.indexOf(from);
        uf.union(g.index, from.groupIndex);
      }
      if (to) {
        a.to = closed.indexOf(to);
        uf.union(g.index, to.groupIndex);
      }
      if (from && to && from !== to) edges.push({ from: from.groupIndex, to: to.groupIndex });
    }
    // Drawn things that overlap each other are one figure (cube faces, axes + curve, nested shapes).
    for (const h of analyses) {
      if (h.index <= g.index) continue;
      if ((h.graphic || h.looseSegments.length > 0) && intersects(g.bbox, h.bbox, 12)) uf.union(g.index, h.index);
    }
  }
  // Text written inside a shape is that shape's label.
  for (const t of analyses) {
    if (t.graphic || t.textStrokes.length === 0) continue;
    const c = center(t.bbox);
    const host = closed.find((s) => contains(s.bbox, c) && width(t.bbox) <= 1.1 * width(s.bbox) && height(t.bbox) <= 1.1 * height(s.bbox));
    if (host) {
      labelInside[t.index] = host.groupIndex;
      uf.union(t.index, host.groupIndex);
    }
  }
  for (const g of analyses) {
    for (const c of g.closed) {
      const inside = g.textStrokes.some((s) => contains(c.bbox, center(s.bbox)));
      if (inside && labelInside[g.index] === undefined) labelInside[g.index] = g.index;
    }
  }

  const graphicRoots = new Set(analyses.filter((a) => a.graphic).map((a) => uf.find(a.index)));
  const members = new Map<number, number[]>();
  for (const a of analyses) {
    const r = uf.find(a.index);
    if (!graphicRoots.has(r)) continue;
    if (!a.graphic && !(a.index in labelInside) && a.looseSegments.length === 0) continue;
    members.set(r, [...(members.get(r) ?? []), a.index]);
  }

  // Short text next to a figure (axis labels, arrow labels) belongs to it; a line of notes beside it does not.
  const figureBoxes = new Map<number, BoundingBox>();
  for (const [r, idx] of members) figureBoxes.set(r, idx.map((i) => byIndex.get(i)!.bbox).reduce(unionBox));
  for (const t of analyses) {
    if (t.graphic || t.textStrokes.length === 0 || members.has(uf.find(t.index)) && members.get(uf.find(t.index))!.includes(t.index)) continue;
    for (const [r, box] of figureBoxes) {
      const fw = width(box), fh = height(box);
      if (contains(expand(box, 24), center(t.bbox)) && width(t.bbox) <= 0.8 * fw && height(t.bbox) <= 0.5 * fh) {
        members.get(r)!.push(t.index);
        break;
      }
    }
  }

  const figures: FigureHint[] = [];
  const ordered = [...members.entries()].sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
  ordered.forEach(([, idx], id) => {
    const gs = idx.map((i) => byIndex.get(i)!);
    const groupIndices = [...idx].sort((a, b) => a - b);
    const labelGroups = groupIndices.filter((i) => !byIndex.get(i)!.graphic && byIndex.get(i)!.textStrokes.length > 0);
    const figEdges = edges.filter((e) => groupIndices.includes(e.from) && groupIndices.includes(e.to));
    const allSegments = gs.flatMap((g) => [
      ...g.looseSegments,
      ...g.closed.flatMap((c) => c.corners.map((p, i) => ({ a: p, b: c.corners[(i + 1) % c.corners.length] }))),
      ...(g.axes ? [{ a: g.axes.origin, b: g.axes.xEnd }, { a: g.axes.origin, b: g.axes.yEnd }] : []),
    ]);
    const closedHere = gs.flatMap((g) => g.closed);
    const cube = gs.some((g) => g.cube) || (closedHere.every((c) => c.corners.length === 4 || c.kind === 'polygon') && looksLikeCube(allSegments));
    const axes = gs.find((g) => g.axes)?.axes ?? null;
    const arrows = gs.flatMap((g) => g.arrows);
    const curves = gs.flatMap((g) => g.curves);
    let kind: FigureKind;
    if (cube) kind = 'cube';
    else if (axes && !cube) kind = 'plot';
    else if (figEdges.length > 0) kind = 'flowchart';
    else if (closedHere.length === 1 && arrows.length === 0) kind = 'shape';
    else kind = 'sketch';

    const shapes: string[] = [];
    if (cube) shapes.push('cube / 3D box');
    else closedHere.forEach((c) => shapes.push(describeShape(c)));
    if (axes && !cube) shapes.push(axes.crossing ? 'crossing axes' : 'x/y axes');
    curves.forEach(() => shapes.push('curve'));
    if (!cube) arrows.forEach(() => shapes.push('arrow'));

    const summaryParts: string[] = [];
    if (cube) summaryParts.push(`a cube / 3D box drawn with ${allSegments.length} edges`);
    if (axes && !cube) summaryParts.push(`${axes.crossing ? 'crossing' : 'L-shaped'} x/y axes${curves.length ? ` with ${curves.length} curve${curves.length > 1 ? 's' : ''} plotted` : ''}`);
    if (!cube) {
      const named = closedHere.map((c) => `${c.kind} (group ${c.groupIndex})`);
      if (named.length) summaryParts.push(named.join(', '));
    }
    if (figEdges.length) summaryParts.push(`arrows: ${figEdges.map((e) => `group ${e.from} → group ${e.to}`).join(', ')}`);
    const dangling = arrows.filter((a) => a.from === undefined && a.to === undefined).length;
    if (dangling && !cube) summaryParts.push(`${dangling} free arrow${dangling > 1 ? 's' : ''}`);
    const labelled = labelGroups.filter((i) => labelInside[i] !== undefined);
    if (labelled.length) summaryParts.push(`labels written inside shapes: ${labelled.map((i) => `group ${i} inside group ${labelInside[i]}`).join(', ')}`);
    const selfLabelled = groupIndices.filter((i) => byIndex.get(i)!.graphic && labelInside[i] === i);
    if (selfLabelled.length) summaryParts.push(`text strokes inside the shape in group ${selfLabelled.join(', ')} (labels)`);
    const nearby = labelGroups.filter((i) => labelInside[i] === undefined);
    if (nearby.length) summaryParts.push(`nearby labels: group ${nearby.join(', ')}`);

    figures.push({ id, groupIndices, kind, shapes, labelGroups, labelInside: Object.fromEntries(labelled.map((i) => [i, labelInside[i]])), edges: figEdges, summary: `${figureName(id)} (${kind}; groups ${groupIndices.join(', ')}): ${summaryParts.join('; ')}` });
  });

  const hints = new Map<number, string>();
  for (const a of analyses) {
    const fig = figures.find((f) => f.groupIndices.includes(a.index));
    let hint = a.hint;
    if (fig) {
      const role = a.graphic ? 'drawing' : labelInside[a.index] !== undefined ? `label inside group ${labelInside[a.index]}` : 'label';
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

/** Convert geometry edges (group → group) into named figure edges using label text per group. */
export function namedEdges(fig: FigureHint, labelFor: (groupIndex: number) => string | undefined): FigureEdge[] {
  const nameOf = (g: number) => {
    const inside = Object.entries(fig.labelInside).find(([, host]) => host === g)?.[0];
    return (inside !== undefined ? labelFor(Number(inside)) : undefined) ?? labelFor(g) ?? `shape (group ${g})`;
  };
  return fig.edges.map((e) => ({ from: nameOf(e.from), to: nameOf(e.to) }));
}
