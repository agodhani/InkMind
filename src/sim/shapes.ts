import type { BoundingBox, Offset } from '../types';
import type { InkStroke } from '../model/page';
import { strokesBounds } from '../transcribe/regions';
import { layoutText, measureText } from './font';
import { InkWriter, MESS_PROFILES, arcPoints, lerp, quadPoints, type MessProfile } from './ink';
import type { Rng } from './rng';

export type FigureType =
  | 'circle'
  | 'ellipse'
  | 'rectangle'
  | 'square'
  | 'triangle'
  | 'line'
  | 'arrow'
  | 'curved-arrow'
  | 'graph'
  | 'bar-chart'
  | 'cube'
  | 'box-3d'
  | 'flowchart'
  | 'tree'
  | 'flowchart-complex'
  | 'state-machine'
  | 'sequence-diagram'
  | 'timeline'
  | 'tree-deep'
  | 'graph-crossing'
  | 'nested-boxes'
  | 'venn'
  | 'plot-multi'
  | 'bar-values'
  | 'bar-stacked'
  | 'table'
  | 'mind-map'
  | 'number-line'
  | 'unit-circle'
  | 'triangle-labelled';

export interface FigureEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Containment {
  outer: string;
  inner: string;
}

/** What the transcriber is expected to produce for one drawing: one diagram block over these strokes, mentioning these labels. */
export interface Figure {
  id: string;
  type: FigureType;
  /** Hand-written labels inside/around the figure (expected in the caption, case-insensitive). */
  labels: string[];
  strokeIds: string[];
  bbox: BoundingBox;
  /** Human description used in the reference caption. */
  description: string;
  /** Node labels (boxes, states, lifelines, …) when the figure has relations. */
  nodes?: string[];
  /** Drawn connections, tail → head, with the text written on the arrow when any. */
  edges?: FigureEdge[];
  /** False for plain lines without arrowheads (match either direction). */
  directed?: boolean;
  /** Ordered steps (pipeline stages, numbered sequence messages, table headers, …). */
  sequence?: string[];
  /** Shapes drawn inside other shapes, by label. */
  contains?: Containment[];
}

/** Relations a drawing routine reports back for its Figure. */
export interface Relations {
  labels: string[];
  nodes?: string[];
  edges?: FigureEdge[];
  directed?: boolean;
  sequence?: string[];
  contains?: Containment[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pen {
  w: InkWriter;
  rng: Rng;
  /** Hand steadiness; defaults to the `normal` profile. */
  mess?: MessProfile;
}

export function messOf(pen: Pen): MessProfile {
  return pen.mess ?? MESS_PROFILES.normal;
}

const DEG = Math.PI / 180;

/** Run `draw` (which may return the labels it wrote), then wrap the strokes it produced into a Figure. */
export function figure(pen: Pen, id: string, type: FigureType, description: string, draw: () => string[] | Relations | void): Figure {
  const start = pen.w.strokes.length;
  pen.w.pause(600);
  const out = draw();
  const rel: Relations = Array.isArray(out) ? { labels: out } : (out ?? { labels: [] });
  const strokes = pen.w.strokes.slice(start);
  return {
    id,
    type,
    labels: rel.labels,
    strokeIds: strokes.map((s) => s.id),
    bbox: strokesBounds(strokes) ?? { left: 0, top: 0, right: 0, bottom: 0 },
    description,
    ...(rel.nodes ? { nodes: rel.nodes } : {}),
    ...(rel.edges ? { edges: rel.edges } : {}),
    ...(rel.directed === false ? { directed: false } : {}),
    ...(rel.sequence ? { sequence: rel.sequence } : {}),
    ...(rel.contains ? { contains: rel.contains } : {}),
  };
}

// ---------------------------------------------------------------- text

export interface TextOptions {
  /** Cap height in px. */
  size?: number;
  shake?: number;
  /** Extra space between letters, in multiples of size. */
  tracking?: number;
}

/** Hand-write a line of text (Hershey glyphs, one stroke per pen-down path, per-letter wobble). */
export function writeText(pen: Pen, text: string, x: number, baseline: number, opts: TextOptions = {}): InkStroke[] {
  const size = opts.size ?? 18;
  const { rng, w } = pen;
  const layout = layoutText(text, x, baseline, size, size * (opts.tracking ?? 0.1));
  const out: InkStroke[] = [];
  const m = messOf(pen);
  const slant = rng.range(-0.08, 0.14) * m.slant;
  const drift = rng.range(-0.004, 0.004) * m.slant;
  for (const ch of layout.chars) {
    if (ch.ch === ' ') {
      w.pause(220);
      continue;
    }
    const dy = rng.gauss() * size * 0.035 * m.slant + (ch.x - x) * drift;
    const scale = 1 + rng.gauss() * 0.04 * m.slant;
    const cx = ch.x, cy = baseline;
    for (const path of ch.polylines) {
      const pts = path.map((p) => ({ x: cx + (p.x - cx) * scale + (cy - p.y) * slant, y: cy + (p.y - cy) * scale + dy }));
      const s = w.stroke(pts, { pauseMs: 70, shake: (opts.shake ?? 1) * 0.8 });
      if (s) out.push(s);
    }
    w.pause(60);
  }
  return out;
}

export function textWidth(text: string, size = 18, tracking = 0.1): number {
  return measureText(text, size, size * tracking);
}

// ---------------------------------------------------------------- primitives

export function drawCircle(pen: Pen, cx: number, cy: number, r: number): void {
  drawEllipse(pen, cx, cy, r, r);
}

export function drawEllipse(pen: Pen, cx: number, cy: number, rx: number, ry: number): void {
  const { rng, w } = pen;
  const m = messOf(pen);
  const start = rng.range(-150, -60) * DEG;
  // Overshoot the closing point like a quick hand; a messy hand sometimes stops short instead.
  const sweep = (rng.chance(m.gap) ? 360 - rng.range(6, 24) : 360 + rng.range(8, 40) * m.overshoot) * DEG;
  const squash = 1 + rng.gauss() * 0.04 * Math.sqrt(m.shake);
  const tilt = rng.gauss() * 0.06 * Math.sqrt(m.shake);
  const pts = arcPoints(0, 0, rx * squash, ry / squash, start, start + sweep, 72).map((p) => ({
    x: cx + p.x * Math.cos(tilt) - p.y * Math.sin(tilt),
    y: cy + p.x * Math.sin(tilt) + p.y * Math.cos(tilt),
  }));
  if (rng.chance(0.25)) {
    const half = Math.floor(pts.length / 2);
    w.stroke(pts.slice(0, half + 1));
    w.stroke(pts.slice(half), { pauseMs: 180 });
  } else w.stroke(pts);
}

/** Corner overshoot/undershoot like a quick hand sketch. */
function jitterCorner(pen: Pen, p: Offset, amt = messOf(pen).corner): Offset {
  return { x: p.x + pen.rng.gauss() * amt, y: p.y + pen.rng.gauss() * amt };
}

export function drawPolygon(pen: Pen, corners: Offset[], strokesHint?: 1 | 2 | 'sides'): void {
  const { rng, w } = pen;
  const m = messOf(pen);
  const c = corners.map((p) => jitterCorner(pen, p));
  const mode = strokesHint ?? rng.pick([1, 1, 2, 'sides'] as const);
  // A side either overshoots its corner or (messy hands) stops short of it.
  const end = () => (rng.chance(m.gap) ? 1 - rng.range(0.03, 0.08) : 1 + rng.range(0, 0.05) * m.overshoot);
  const begin = () => (rng.chance(m.gap) ? rng.range(0.02, 0.06) : -0.02 * m.overshoot);
  if (mode === 1) {
    // Close by hand: overshoot the first corner a little, or stop just short of it (a gap).
    w.stroke([...c, lerp(c[c.length - 1], c[0], end())]);
  } else if (mode === 2 && c.length === 4) {
    w.stroke([c[0], c[1], c[2]]);
    w.stroke([lerp(c[2], c[3], begin()), c[3], lerp(c[0], c[3], -0.04 * m.overshoot)], { pauseMs: 200 });
  } else {
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      w.stroke([lerp(a, b, begin()), lerp(a, b, end())], { pauseMs: 160 });
    }
  }
}

export function drawRect(pen: Pen, box: Box, strokesHint?: 1 | 2 | 'sides'): void {
  drawPolygon(
    pen,
    [
      { x: box.x, y: box.y },
      { x: box.x + box.w, y: box.y },
      { x: box.x + box.w, y: box.y + box.h },
      { x: box.x, y: box.y + box.h },
    ],
    strokesHint,
  );
}

export function drawTriangle(pen: Pen, box: Box): void {
  drawPolygon(pen, [
    { x: box.x + box.w / 2 + pen.rng.range(-box.w * 0.1, box.w * 0.1), y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ]);
}

export function drawLine(pen: Pen, a: Offset, b: Offset, opts: { shake?: number; pauseMs?: number; bow?: number } = {}): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const mid = lerp(a, b, 0.5);
  const nx = -(b.y - a.y) / (len || 1), ny = (b.x - a.x) / (len || 1);
  const bow = pen.rng.gauss() * len * 0.012 * messOf(pen).bow * (opts.bow ?? 1);
  pen.w.stroke(quadPoints(a, { x: mid.x + nx * bow * 2, y: mid.y + ny * bow * 2 }, b, Math.max(4, Math.round(len / 10))), { shake: opts.shake, pauseMs: opts.pauseMs });
}

export function drawArrowHead(pen: Pen, tip: Offset, direction: number, size = 12): void {
  const { rng, w } = pen;
  const spread = rng.range(22, 32) * DEG;
  const l = size * rng.range(0.85, 1.2);
  const back = (angle: number): Offset => ({ x: tip.x - Math.cos(direction + angle) * l, y: tip.y - Math.sin(direction + angle) * l });
  if (rng.chance(0.5)) {
    w.stroke([back(spread), tip, back(-spread)], { pauseMs: 120 });
  } else {
    w.stroke([back(spread), tip], { pauseMs: 120 });
    w.stroke([back(-spread), tip], { pauseMs: 110 });
  }
}

export function drawArrow(pen: Pen, from: Offset, to: Offset, opts: { curved?: boolean; bulge?: number } = {}): void {
  const { rng, w } = pen;
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (opts.curved) {
    const mid = lerp(from, to, 0.5);
    const nx = -(to.y - from.y) / (len || 1), ny = (to.x - from.x) / (len || 1);
    const bulge = (opts.bulge ?? rng.pick([-1, 1]) * rng.range(0.25, 0.45)) * len;
    const c = { x: mid.x + nx * bulge, y: mid.y + ny * bulge };
    const pts = quadPoints(from, c, to, Math.max(12, Math.round(len / 6)));
    w.stroke(pts);
    const tail = pts[pts.length - 2];
    drawArrowHead(pen, to, Math.atan2(to.y - tail.y, to.x - tail.x), Math.min(14, 8 + len * 0.03));
  } else {
    drawLine(pen, from, to);
    drawArrowHead(pen, to, Math.atan2(to.y - from.y, to.x - from.x), Math.min(14, 8 + len * 0.03));
  }
}

// ---------------------------------------------------------------- composites

export interface GraphSpec {
  curve: (u: number) => number;
  xTicks: string[];
  yTicks?: string[];
  xLabel: string;
  yLabel: string;
  title?: string;
  /** Second curve, dashed by lifting the pen. */
  curve2?: (u: number) => number;
}

/** x/y axes with arrowheads, tick labels and one or two plotted curves. */
export function drawGraph(pen: Pen, box: Box, spec: GraphSpec, textSize = 16): string[] {
  const { rng, w } = pen;
  const labels: string[] = [];
  const o = { x: box.x + textSize * 2.2, y: box.y + box.h - textSize * 2 };
  const xEnd = { x: box.x + box.w, y: o.y };
  const yEnd = { x: o.x, y: box.y + (spec.title ? textSize * 1.8 : 0) };
  drawLine(pen, { x: o.x, y: o.y + rng.range(0, 6) }, yEnd, { shake: 0.6 });
  drawArrowHead(pen, yEnd, -Math.PI / 2, 10);
  drawLine(pen, { x: o.x - rng.range(0, 6), y: o.y }, xEnd, { shake: 0.6 });
  drawArrowHead(pen, xEnd, 0, 10);
  const plotW = xEnd.x - o.x - 30, plotH = o.y - yEnd.y - 30;
  spec.xTicks.forEach((t, i) => {
    const x = o.x + (plotW * (i + 1)) / spec.xTicks.length;
    w.stroke([{ x, y: o.y - 4 }, { x, y: o.y + 5 }], { pauseMs: 150 });
    writeText(pen, t, x - textWidth(t, textSize * 0.8) / 2, o.y + textSize * 1.3, { size: textSize * 0.8 });
    labels.push(t);
  });
  (spec.yTicks ?? []).forEach((t, i) => {
    const y = o.y - (plotH * (i + 1)) / (spec.yTicks ?? []).length;
    w.stroke([{ x: o.x - 5, y }, { x: o.x + 4, y }], { pauseMs: 150 });
    writeText(pen, t, o.x - 10 - textWidth(t, textSize * 0.8), y + textSize * 0.35, { size: textSize * 0.8 });
    labels.push(t);
  });
  writeText(pen, spec.xLabel, xEnd.x - textWidth(spec.xLabel, textSize), o.y + textSize * 2.6, { size: textSize });
  labels.push(spec.xLabel);
  writeText(pen, spec.yLabel, o.x + 10, yEnd.y + textSize * 0.9, { size: textSize });
  labels.push(spec.yLabel);
  if (spec.title) {
    writeText(pen, spec.title, o.x + plotW / 2 - textWidth(spec.title, textSize) / 2, box.y + textSize, { size: textSize });
    labels.push(spec.title);
  }
  const plot = (f: (u: number) => number, dashed: boolean) => {
    const pts: Offset[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push({ x: o.x + 8 + plotW * u, y: o.y - 8 - plotH * Math.max(0, Math.min(1, f(u))) });
    }
    if (!dashed) w.stroke(pts, { pauseMs: 400 });
    else for (let i = 0; i < pts.length - 2; i += 4) w.stroke(pts.slice(i, i + 3), { pauseMs: 110 });
  };
  plot(spec.curve, false);
  if (spec.curve2) plot(spec.curve2, true);
  return labels;
}

export interface BarChartSpec {
  bars: { label: string; value: number }[];
  title?: string;
  yLabel?: string;
}

export function drawBarChart(pen: Pen, box: Box, spec: BarChartSpec, textSize = 16): string[] {
  const { rng, w } = pen;
  const labels: string[] = [];
  const o = { x: box.x + textSize * 1.5, y: box.y + box.h - textSize * 2 };
  const top = box.y + (spec.title ? textSize * 2 : textSize * 0.5);
  drawLine(pen, { x: o.x, y: o.y + 4 }, { x: o.x, y: top }, { shake: 0.6 });
  drawLine(pen, { x: o.x - 4, y: o.y }, { x: box.x + box.w, y: o.y }, { shake: 0.6 });
  const n = spec.bars.length;
  const slot = (box.x + box.w - o.x - 10) / n;
  const barW = slot * 0.55;
  const maxV = Math.max(...spec.bars.map((b) => b.value), 1e-6);
  spec.bars.forEach((b, i) => {
    const x = o.x + 10 + slot * i + (slot - barW) / 2;
    const h = ((o.y - top - 10) * b.value) / maxV;
    // Bars are drawn open at the bottom (the axis is the base), like a quick sketch.
    const left = { x, y: o.y }, tl = { x, y: o.y - h }, tr = { x: x + barW, y: o.y - h }, right = { x: x + barW, y: o.y };
    const jc = (p: Offset) => jitterCorner(pen, p, messOf(pen).corner * 0.6);
    if (rng.chance(0.5)) w.stroke([left, tl, tr, right].map(jc), { pauseMs: 250 });
    else {
      w.stroke([left, tl].map(jc), { pauseMs: 200 });
      w.stroke([tl, tr].map(jc), { pauseMs: 120 });
      w.stroke([tr, right].map(jc), { pauseMs: 120 });
    }
    writeText(pen, b.label, x + barW / 2 - textWidth(b.label, textSize * 0.85) / 2, o.y + textSize * 1.4, { size: textSize * 0.85 });
    labels.push(b.label);
  });
  if (spec.title) {
    writeText(pen, spec.title, o.x + (box.x + box.w - o.x) / 2 - textWidth(spec.title, textSize) / 2, box.y + textSize, { size: textSize });
    labels.push(spec.title);
  }
  if (spec.yLabel) {
    writeText(pen, spec.yLabel, o.x + 8, top + textSize, { size: textSize * 0.85 });
    labels.push(spec.yLabel);
  }
  return labels;
}

export interface CubeSpec {
  /** Draw hidden edges too (wireframe). */
  wireframe?: boolean;
  /** Letters written next to the three visible edges (e.g. a, b, c). */
  edgeLabels?: [string, string, string];
  /** Front face aspect (width / height); 1 = cube, anything else = 3D box. */
  aspect?: number;
}

/** Isometric-ish cube or box: front face, back face offset up-right, connecting edges. */
export function drawCube(pen: Pen, box: Box, spec: CubeSpec = {}, textSize = 16): string[] {
  const { rng, w } = pen;
  const aspect = spec.aspect ?? 1;
  const d = Math.min(box.w, box.h) * rng.range(0.28, 0.36);
  const fh = Math.min(box.h - d, (box.w - d) / aspect);
  const fw = fh * aspect;
  const fx = box.x, fy = box.y + d;
  const F = [
    { x: fx, y: fy },
    { x: fx + fw, y: fy },
    { x: fx + fw, y: fy + fh },
    { x: fx, y: fy + fh },
  ];
  const B = F.map((p) => ({ x: p.x + d, y: p.y - d }));
  drawPolygon(pen, F, rng.pick([1, 'sides'] as const));
  if (spec.wireframe) {
    drawPolygon(pen, B, 'sides');
    for (let i = 0; i < 4; i++) drawLine(pen, F[i], B[i], { pauseMs: 170 });
  } else {
    drawLine(pen, F[0], B[0], { pauseMs: 170 });
    drawLine(pen, F[1], B[1], { pauseMs: 170 });
    drawLine(pen, F[2], B[2], { pauseMs: 170 });
    drawLine(pen, B[0], B[1], { pauseMs: 170 });
    drawLine(pen, B[1], B[2], { pauseMs: 170 });
  }
  const labels: string[] = [];
  if (spec.edgeLabels) {
    const [a, b, c] = spec.edgeLabels;
    writeText(pen, a, fx + fw / 2 - textWidth(a, textSize) / 2, fy + fh + textSize * 1.4, { size: textSize });
    writeText(pen, b, fx + fw + d + 10, fy + fh / 2, { size: textSize });
    writeText(pen, c, fx + fw + d / 2 + 6, fy - d / 2 + textSize * 0.9 + 6, { size: textSize });
    labels.push(a, b, c);
  }
  w.pause(200);
  return labels;
}

export interface FlowchartSpec {
  nodes: { label: string; shape?: 'box' | 'diamond' | 'rounded' }[];
  direction: 'down' | 'right';
  /** Short labels on the arrows between consecutive nodes. */
  edgeLabels?: (string | undefined)[];
}

export function drawFlowchart(pen: Pen, box: Box, spec: FlowchartSpec, textSize = 15): string[] {
  const labels: string[] = [];
  const n = spec.nodes.length;
  const centers: Offset[] = [];
  const nodeW = Math.min(150, Math.max(70, ...spec.nodes.map((nd) => textWidth(nd.label, textSize) + 30)));
  const nodeH = textSize * 2.6;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    centers.push(
      spec.direction === 'down'
        ? { x: box.x + box.w / 2, y: box.y + nodeH / 2 + (box.h - nodeH) * t }
        : { x: box.x + nodeW / 2 + (box.w - nodeW) * t, y: box.y + box.h / 2 },
    );
  }
  const halfExtent = (i: number): Offset => {
    const shape = spec.nodes[i].shape ?? 'box';
    return shape === 'diamond' ? { x: nodeW * 0.65, y: nodeH * 0.85 } : { x: nodeW / 2, y: nodeH / 2 };
  };
  spec.nodes.forEach((nd, i) => {
    const c = centers[i];
    const e = halfExtent(i);
    const shape = nd.shape ?? 'box';
    if (shape === 'diamond') {
      drawPolygon(pen, [
        { x: c.x, y: c.y - e.y },
        { x: c.x + e.x, y: c.y },
        { x: c.x, y: c.y + e.y },
        { x: c.x - e.x, y: c.y },
      ]);
    } else if (shape === 'rounded') {
      drawEllipse(pen, c.x, c.y, e.x, e.y);
    } else drawRect(pen, { x: c.x - e.x, y: c.y - e.y, w: e.x * 2, h: e.y * 2 });
    writeText(pen, nd.label, c.x - textWidth(nd.label, textSize) / 2, c.y + textSize * 0.4, { size: textSize });
    labels.push(nd.label);
  });
  for (let i = 0; i < n - 1; i++) {
    const a = centers[i], b = centers[i + 1];
    const ea = halfExtent(i), eb = halfExtent(i + 1);
    const from = spec.direction === 'down' ? { x: a.x, y: a.y + ea.y + 3 } : { x: a.x + ea.x + 3, y: a.y };
    const to = spec.direction === 'down' ? { x: b.x, y: b.y - eb.y - 3 } : { x: b.x - eb.x - 3, y: b.y };
    drawArrow(pen, from, to);
    const el = spec.edgeLabels?.[i];
    if (el) {
      const mid = lerp(from, to, 0.5);
      writeText(pen, el, spec.direction === 'down' ? mid.x + 8 : mid.x - textWidth(el, textSize * 0.85) / 2, spec.direction === 'down' ? mid.y + textSize * 0.4 : mid.y - 8, { size: textSize * 0.85 });
      labels.push(el);
    }
  }
  return labels;
}

export interface TreeSpec {
  root: string;
  children: { label: string; children?: string[] }[];
}

/** Root node on top, children below, grandchildren below that; circles with a label inside, straight edges. */
export function drawTree(pen: Pen, box: Box, spec: TreeSpec, textSize = 15): string[] {
  const labels: string[] = [];
  const r = Math.min(26, box.w / (spec.children.length * 4));
  const hasGrand = spec.children.some((c) => c.children?.length);
  const rows = hasGrand ? 3 : 2;
  const rowY = (i: number) => box.y + r + ((box.h - 2 * r) * i) / (rows - 1);
  const node = (label: string, c: Offset) => {
    if (pen.rng.chance(0.3)) drawRect(pen, { x: c.x - r * 1.1, y: c.y - r * 0.8, w: r * 2.2, h: r * 1.6 });
    else drawCircle(pen, c.x, c.y, r);
    writeText(pen, label, c.x - textWidth(label, textSize) / 2, c.y + textSize * 0.4, { size: textSize });
    labels.push(label);
  };
  const root = { x: box.x + box.w / 2, y: rowY(0) };
  node(spec.root, root);
  const leafSlots = spec.children.map((c) => Math.max(1, c.children?.length ?? 1));
  const totalSlots = leafSlots.reduce((a, b) => a + b, 0);
  let slotStart = 0;
  spec.children.forEach((ch, i) => {
    const slotW = box.w / totalSlots;
    const c = { x: box.x + slotW * (slotStart + leafSlots[i] / 2), y: rowY(1) };
    drawLine(pen, { x: root.x + (c.x - root.x) * 0.12, y: root.y + r }, { x: c.x, y: c.y - r - 2 }, { pauseMs: 200 });
    node(ch.label, c);
    (ch.children ?? []).forEach((g, j) => {
      const gc = { x: box.x + slotW * (slotStart + j + 0.5), y: rowY(2) };
      drawLine(pen, { x: c.x + (gc.x - c.x) * 0.1, y: c.y + r }, { x: gc.x, y: gc.y - r - 2 }, { pauseMs: 200 });
      node(g, gc);
    });
    slotStart += leafSlots[i];
  });
  return labels;
}
