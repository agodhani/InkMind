// Complex, relation-bearing drawings (flowcharts with branches/loops, state machines, sequence
// diagrams, tables, mind maps, math sketches, …). Each routine draws like a hand would and returns
// the ground truth — labels, nodes, edges, ordered steps, containment — for scoring.
import type { Offset } from '../types';
import { arcPoints, lerp, quadPoints } from './ink';
import {
  drawArrow,
  drawArrowHead,
  drawCircle,
  drawEllipse,
  drawLine,
  drawPolygon,
  drawRect,
  messOf,
  textWidth,
  writeText,
  type Box,
  type Containment,
  type FigureEdge,
  type Pen,
  type Relations,
} from './shapes';

const DEG = Math.PI / 180;

export type NodeShape = 'box' | 'diamond' | 'rounded' | 'circle';

export interface FlowNode {
  id: string;
  label?: string;
  shape?: NodeShape;
  /** Grid position (column, row). */
  col: number;
  row: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface FlowSpec {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface Placed {
  c: Offset;
  ex: number;
  ey: number;
  shape: NodeShape;
  label: string;
}

/** Point on a node's outline in the direction of `toward`. */
function border(n: Placed, toward: Offset, pad = 3): Offset {
  const dx = toward.x - n.c.x, dy = toward.y - n.c.y;
  if (dx === 0 && dy === 0) return n.c;
  let t: number;
  if (n.shape === 'circle' || n.shape === 'rounded') {
    t = 1 / Math.hypot(dx / n.ex, dy / n.ey);
  } else if (n.shape === 'diamond') {
    t = 1 / (Math.abs(dx) / n.ex + Math.abs(dy) / n.ey);
  } else {
    t = Math.min(n.ex / Math.abs(dx || 1e-9), n.ey / Math.abs(dy || 1e-9));
  }
  const len = Math.hypot(dx, dy);
  return { x: n.c.x + dx * t + (dx / len) * pad, y: n.c.y + dy * t + (dy / len) * pad };
}

function drawNodeShape(pen: Pen, n: Placed): void {
  const { c, ex, ey } = n;
  if (n.shape === 'diamond') {
    drawPolygon(pen, [
      { x: c.x, y: c.y - ey },
      { x: c.x + ex, y: c.y },
      { x: c.x, y: c.y + ey },
      { x: c.x - ex, y: c.y },
    ]);
  } else if (n.shape === 'rounded') drawEllipse(pen, c.x, c.y, ex, ey);
  else if (n.shape === 'circle') drawCircle(pen, c.x, c.y, Math.min(ex, ey));
  else drawRect(pen, { x: c.x - ex, y: c.y - ey, w: ex * 2, h: ey * 2 });
}

function label(pen: Pen, text: string, c: Offset, size: number): void {
  writeText(pen, text, c.x - textWidth(text, size) / 2, c.y + size * 0.4, { size });
}

/**
 * Flowchart on a grid: decision diamonds, branch labels on the arrows, merges, and back-edges
 * (loops) routed around the nodes with right angles.
 */
export function drawFlowchartComplex(pen: Pen, box: Box, spec: FlowSpec, textSize = 16): Relations {
  const cols = Math.max(...spec.nodes.map((n) => n.col)) + 1;
  const rows = Math.max(...spec.nodes.map((n) => n.row)) + 1;
  const cellW = box.w / cols, cellH = box.h / rows;
  const labels: string[] = [];
  const nodeW = Math.min(cellW * 0.62, Math.max(70, ...spec.nodes.map((n) => textWidth(n.label ?? n.id, textSize) + 28)));
  const nodeH = Math.min(cellH * 0.45, textSize * 2.8);
  const placed = new Map<string, Placed>();
  for (const n of spec.nodes) {
    const shape = n.shape ?? 'box';
    const c = { x: box.x + cellW * (n.col + 0.5) + pen.rng.gauss() * 3, y: box.y + cellH * (n.row + 0.5) + pen.rng.gauss() * 3 };
    const p: Placed = { c, shape, label: n.label ?? n.id, ex: shape === 'diamond' ? nodeW * 0.6 : nodeW / 2, ey: shape === 'diamond' ? nodeH * 0.95 : nodeH / 2 };
    placed.set(n.id, p);
    drawNodeShape(pen, p);
    label(pen, p.label, c, textSize);
    labels.push(p.label);
  }
  const edges: FigureEdge[] = [];
  for (const e of spec.edges) {
    const a = placed.get(e.from)!, b = placed.get(e.to)!;
    const upward = b.c.y < a.c.y - cellH * 0.5;
    const adjacentAbove = upward && Math.abs(b.c.x - a.c.x) < cellW * 0.5 && a.c.y - b.c.y < cellH * 1.5;
    const sameRowBack = Math.abs(b.c.y - a.c.y) < cellH * 0.5 && b.c.x < a.c.x - cellW * 1.5;
    const size = textSize * 0.85;
    if ((upward && !adjacentAbove) || sameRowBack) {
      // Loop: leave the node, run along a free rail (beside or below the nodes), come back in.
      let p0: Offset, p1: Offset, p2: Offset, p3: Offset, at: Offset;
      if (sameRowBack) {
        const railY = Math.min(box.y + box.h - 6, a.c.y + cellH * 0.48);
        p0 = border(a, { x: a.c.x, y: a.c.y + 1000 });
        p1 = { x: a.c.x, y: railY };
        p2 = { x: b.c.x, y: railY };
        p3 = border(b, { x: b.c.x, y: b.c.y + 1000 });
        at = { x: (p1.x + p2.x) / 2 - (e.label ? textWidth(e.label, size) / 2 : 0), y: railY + size * 1.3 };
      } else {
        const side = a.c.x >= box.x + box.w / 2 ? 1 : -1;
        const edgeX = side > 0 ? Math.max(a.c.x, b.c.x) : Math.min(a.c.x, b.c.x);
        const railX = Math.max(box.x + 6, Math.min(box.x + box.w - 6, edgeX + side * cellW * 0.5));
        p0 = border(a, { x: a.c.x + side * 1000, y: a.c.y });
        p1 = { x: railX, y: a.c.y };
        p2 = { x: railX, y: b.c.y };
        p3 = border(b, { x: b.c.x + side * 1000, y: b.c.y });
        at = { x: railX + side * 8 - (side < 0 && e.label ? textWidth(e.label, size) : 0), y: (p1.y + p2.y) / 2 + size * 0.4 };
      }
      drawLine(pen, p0, p1, { pauseMs: 220 });
      drawLine(pen, p1, p2, { pauseMs: 150 });
      drawArrow(pen, p2, p3);
      if (e.label) writeText(pen, e.label, at.x, at.y, { size });
    } else {
      const from = border(a, b.c), to = border(b, a.c);
      const curved = Math.abs(a.c.x - b.c.x) > cellW * 0.4 && Math.abs(a.c.y - b.c.y) > cellH * 0.4 && pen.rng.chance(0.4);
      drawArrow(pen, from, to, curved ? { curved: true, bulge: 0.18 } : {});
      const mid = lerp(from, to, 0.5);
      const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
      if (e.label) {
        if (horizontal) writeText(pen, e.label, mid.x - textWidth(e.label, size) / 2, mid.y - 8, { size });
        else writeText(pen, e.label, mid.x + 8, mid.y + size * 0.4, { size });
      }
    }
    if (e.label) labels.push(e.label);
    edges.push({ from: a.label, to: b.label, ...(e.label ? { label: e.label } : {}) });
  }
  return { labels, nodes: spec.nodes.map((n) => n.label ?? n.id), edges };
}

export interface StateSpec {
  states: { id: string; accept?: boolean }[];
  start: string;
  transitions: { from: string; to: string; label: string }[];
}

/** Finite-state machine: circles, a start arrow, double circles for accepting states, labelled (curved) transitions and self-loops. */
export function drawStateMachine(pen: Pen, box: Box, spec: StateSpec, textSize = 14): Relations {
  const { rng } = pen;
  const n = spec.states.length;
  const r = Math.min(30, box.w / (n * 3.2), box.h / 5);
  const twoRows = n > 4;
  const perRow = twoRows ? Math.ceil(n / 2) : n;
  const centers = new Map<string, Offset>();
  const labels: string[] = [];
  spec.states.forEach((s, i) => {
    const row = twoRows ? Math.floor(i / perRow) : 0;
    const col = i % perRow;
    const x = box.x + r * 2.2 + ((box.w - r * 4.4) * (perRow === 1 ? 0.5 : col / (perRow - 1)));
    const y = twoRows ? box.y + box.h * (row === 0 ? 0.28 : 0.74) : box.y + box.h * 0.55;
    const c = { x: x + rng.gauss() * 3, y: y + rng.gauss() * 3 };
    centers.set(s.id, c);
    drawCircle(pen, c.x, c.y, r);
    if (s.accept) drawCircle(pen, c.x, c.y, r * 0.78);
    label(pen, s.id, c, textSize);
    labels.push(s.id);
  });
  const start = centers.get(spec.start)!;
  drawArrow(pen, { x: start.x - r * 2.6, y: start.y - r * 0.9 }, { x: start.x - r - 3, y: start.y - r * 0.3 });
  const edges: FigureEdge[] = [];
  const seen = new Set<string>();
  for (const t of spec.transitions) {
    const a = centers.get(t.from)!, b = centers.get(t.to)!;
    const size = textSize * 0.85;
    if (t.from === t.to) {
      // Self-loop above the state.
      const pts = arcPoints(a.x, a.y - r * 1.15, r * 0.7, r * 0.7, 150 * DEG, (150 + 250) * DEG, 30);
      pen.w.stroke(pts, { pauseMs: 200 });
      const tail = pts[pts.length - 2], tip = pts[pts.length - 1];
      drawArrowHead(pen, tip, Math.atan2(tip.y - tail.y, tip.x - tail.x), 9);
      writeText(pen, t.label, a.x - textWidth(t.label, size) / 2, a.y - r * 2.15, { size });
    } else {
      const reverse = seen.has(`${t.to}->${t.from}`);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      const from = { x: a.x + (dx / len) * (r + 3), y: a.y + (dy / len) * (r + 3) };
      const to = { x: b.x - (dx / len) * (r + 3), y: b.y - (dy / len) * (r + 3) };
      const bulge = reverse || Math.abs(dx) > box.w * 0.4 ? 0.22 : rng.chance(0.5) ? 0.12 : 0;
      drawArrow(pen, from, to, bulge ? { curved: true, bulge } : {});
      const mid = lerp(from, to, 0.5);
      const nx = -dy / len, ny = dx / len;
      const off = (bulge ? bulge * len * 0.5 : 0) + 11;
      const lx = mid.x + nx * off, ly = mid.y + ny * off;
      writeText(pen, t.label, lx - textWidth(t.label, size) / 2, ly + (ny > 0 ? size : 0), { size });
    }
    seen.add(`${t.from}->${t.to}`);
    labels.push(t.label);
    edges.push({ from: t.from, to: t.to, label: t.label });
  }
  return { labels, nodes: spec.states.map((s) => s.id), edges };
}

export interface SequenceSpec {
  actors: string[];
  messages: { from: string; to: string; label: string }[];
}

/** UML-style sequence diagram: named lifeline boxes, dashed vertical lifelines, numbered horizontal arrows. */
export function drawSequenceDiagram(pen: Pen, box: Box, spec: SequenceSpec, textSize = 14): Relations {
  const labels: string[] = [];
  const n = spec.actors.length;
  const xs = spec.actors.map((_, i) => box.x + (box.w * (i + 0.5)) / n);
  const headH = textSize * 2.4;
  const headW = Math.min(box.w / n - 16, Math.max(70, ...spec.actors.map((a) => textWidth(a, textSize) + 24)));
  spec.actors.forEach((a, i) => {
    drawRect(pen, { x: xs[i] - headW / 2, y: box.y, w: headW, h: headH });
    label(pen, a, { x: xs[i], y: box.y + headH / 2 }, textSize);
    labels.push(a);
    // Dashed lifeline.
    const bottom = box.y + box.h;
    for (let y = box.y + headH + 6; y < bottom - 10; y += 22) pen.w.stroke([{ x: xs[i], y }, { x: xs[i], y: Math.min(bottom, y + 12) }], { pauseMs: 90 });
  });
  const edges: FigureEdge[] = [];
  const sequence: string[] = [];
  const top = box.y + headH + 30;
  const gap = (box.h - headH - 50) / Math.max(1, spec.messages.length);
  spec.messages.forEach((m, k) => {
    const ia = spec.actors.indexOf(m.from), ib = spec.actors.indexOf(m.to);
    const y = top + gap * (k + 0.5);
    const from = { x: xs[ia] + (ib > ia ? 6 : -6), y }, to = { x: xs[ib] - (ib > ia ? 6 : -6), y };
    drawArrow(pen, from, to);
    const text = `${k + 1}. ${m.label}`;
    const size = textSize * 0.9;
    writeText(pen, text, (from.x + to.x) / 2 - textWidth(text, size) / 2, y - 7, { size });
    labels.push(m.label);
    sequence.push(m.label);
    edges.push({ from: m.from, to: m.to, label: m.label });
  });
  return { labels, nodes: spec.actors, edges, sequence };
}

export interface TimelineSpec {
  steps: string[];
  numbered?: boolean;
  /** Snake onto two rows when there are many steps. */
  rows?: 1 | 2;
}

/** Pipeline / timeline: ordered boxes joined by arrows, step numbers above each box. */
export function drawTimeline(pen: Pen, box: Box, spec: TimelineSpec, textSize = 14): Relations {
  const labels: string[] = [];
  const rows = spec.rows ?? (spec.steps.length > 4 ? 2 : 1);
  const perRow = Math.ceil(spec.steps.length / rows);
  const slot = box.w / perRow;
  const bw = Math.min(slot * 0.72, Math.max(70, ...spec.steps.map((s) => textWidth(s, textSize) + 24)));
  const bh = textSize * 2.6;
  const centers: Offset[] = spec.steps.map((_, i) => {
    const row = Math.floor(i / perRow);
    const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow);
    return { x: box.x + slot * (col + 0.5), y: box.y + (rows === 1 ? box.h / 2 : box.h * (row === 0 ? 0.3 : 0.75)) };
  });
  spec.steps.forEach((s, i) => {
    const c = centers[i];
    drawRect(pen, { x: c.x - bw / 2, y: c.y - bh / 2, w: bw, h: bh });
    label(pen, s, c, textSize);
    labels.push(s);
    if (spec.numbered !== false) {
      const num = String(i + 1);
      writeText(pen, num, c.x - textWidth(num, textSize * 0.9) / 2, c.y - bh / 2 - 8, { size: textSize * 0.9 });
      labels.push(num);
    }
  });
  const edges: FigureEdge[] = [];
  for (let i = 0; i < spec.steps.length - 1; i++) {
    const a = centers[i], b = centers[i + 1];
    if (Math.abs(a.y - b.y) < 1) {
      const dir = Math.sign(b.x - a.x);
      drawArrow(pen, { x: a.x + dir * (bw / 2 + 3), y: a.y }, { x: b.x - dir * (bw / 2 + 3), y: b.y });
    } else {
      // Row change: down, then across into the next row.
      drawArrow(pen, { x: a.x, y: a.y + bh / 2 + 3 }, { x: b.x, y: b.y - bh / 2 - 3 }, { curved: true, bulge: 0.15 });
    }
    edges.push({ from: spec.steps[i], to: spec.steps[i + 1] });
  }
  return { labels, nodes: spec.steps, edges, sequence: spec.steps };
}

export interface TreeNode {
  label: string;
  children?: TreeNode[];
}

function leafCount(n: TreeNode): number {
  return n.children?.length ? n.children.reduce((s, c) => s + leafCount(c), 0) : 1;
}

function depthOf(n: TreeNode): number {
  return 1 + Math.max(0, ...(n.children ?? []).map(depthOf));
}

/** Tree of arbitrary depth: parent above children, boxes or circles, plain lines (no arrowheads). */
export function drawTreeDeep(pen: Pen, box: Box, root: TreeNode, textSize = 13): Relations {
  const labels: string[] = [];
  const edges: FigureEdge[] = [];
  const depth = depthOf(root);
  const leaves = leafCount(root);
  const slotW = box.w / leaves;
  const r = Math.min(22, slotW * 0.42, box.h / (depth * 3));
  const rowY = (d: number) => box.y + r + ((box.h - 2 * r) * d) / Math.max(1, depth - 1);
  const useBoxes = pen.rng.chance(0.4);
  const place = (n: TreeNode, d: number, slot0: number): Offset => {
    const w = leafCount(n);
    const c = { x: box.x + slotW * (slot0 + w / 2) + pen.rng.gauss() * 2, y: rowY(d) + pen.rng.gauss() * 2 };
    if (useBoxes) drawRect(pen, { x: c.x - r * 1.15, y: c.y - r * 0.8, w: r * 2.3, h: r * 1.6 });
    else drawCircle(pen, c.x, c.y, r);
    label(pen, n.label, c, textSize);
    labels.push(n.label);
    let s = slot0;
    for (const ch of n.children ?? []) {
      const cc = place(ch, d + 1, s);
      drawLine(pen, { x: c.x + (cc.x - c.x) * 0.08, y: c.y + r * 0.85 }, { x: cc.x, y: cc.y - r * 0.85 - 2 }, { pauseMs: 200 });
      edges.push({ from: n.label, to: ch.label });
      s += leafCount(ch);
    }
    return c;
  };
  place(root, 0, 0);
  return { labels, nodes: [...labels], edges, directed: false };
}

export interface GraphSpec {
  nodes: string[];
  edges: { from: string; to: string; label?: string }[];
  directed?: boolean;
  layout?: 'ring' | 'grid';
}

/** Small graph whose edges cross: nodes on a ring (or grid), straight edges (chords cross) with optional arrowheads/labels. */
export function drawGraphCrossing(pen: Pen, box: Box, spec: GraphSpec, textSize = 14): Relations {
  const { rng } = pen;
  const n = spec.nodes.length;
  const r = Math.min(24, box.w / (n * 2.6));
  const centers = new Map<string, Offset>();
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const R = Math.min(box.w, box.h) / 2 - r - 4;
  spec.nodes.forEach((id, i) => {
    let c: Offset;
    if ((spec.layout ?? 'ring') === 'ring') {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
      c = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    } else {
      const cols = Math.ceil(Math.sqrt(n));
      c = { x: box.x + r + ((box.w - 2 * r) * (i % cols)) / Math.max(1, cols - 1), y: box.y + r + ((box.h - 2 * r) * Math.floor(i / cols)) / Math.max(1, Math.ceil(n / cols) - 1) };
    }
    c = { x: c.x + rng.gauss() * 3, y: c.y + rng.gauss() * 3 };
    centers.set(id, c);
    drawCircle(pen, c.x, c.y, r);
    label(pen, id, c, textSize);
  });
  const labels = [...spec.nodes];
  const edges: FigureEdge[] = [];
  for (const e of spec.edges) {
    const a = centers.get(e.from)!, b = centers.get(e.to)!;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const from = { x: a.x + (dx / len) * (r + 3), y: a.y + (dy / len) * (r + 3) };
    const to = { x: b.x - (dx / len) * (r + 3), y: b.y - (dy / len) * (r + 3) };
    if (spec.directed) drawArrow(pen, from, to);
    else drawLine(pen, from, to, { pauseMs: 200 });
    if (e.label) {
      const mid = lerp(from, to, 0.5);
      const size = textSize * 0.85;
      writeText(pen, e.label, mid.x - textWidth(e.label, size) / 2 + 10, mid.y - 6, { size });
      labels.push(e.label);
    }
    edges.push({ from: e.from, to: e.to, ...(e.label ? { label: e.label } : {}) });
  }
  return { labels, nodes: spec.nodes, edges, directed: !!spec.directed };
}

export interface NestedSpec {
  label: string;
  shape?: 'box' | 'circle';
  children?: NestedSpec[];
}

/** Shapes drawn inside shapes (box in box, circle in box …), each labelled near its top-left / top. */
export function drawNested(pen: Pen, box: Box, spec: NestedSpec, textSize = 14): Relations {
  const labels: string[] = [];
  const contains: Containment[] = [];
  const nodes: string[] = [];
  const draw = (s: NestedSpec, b: Box, depth: number) => {
    const size = Math.max(11, textSize - depth);
    if ((s.shape ?? 'box') === 'circle') {
      drawEllipse(pen, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.46, b.h * 0.44);
      writeText(pen, s.label, b.x + b.w / 2 - textWidth(s.label, size) / 2, b.y + size * 2.2, { size });
    } else {
      drawRect(pen, b);
      writeText(pen, s.label, b.x + 10, b.y + size * 1.5, { size });
    }
    labels.push(s.label);
    nodes.push(s.label);
    const kids = s.children ?? [];
    if (!kids.length) return;
    const inner = { x: b.x + b.w * 0.1, y: b.y + size * 2.4, w: b.w * 0.8, h: b.h - size * 2.4 - b.h * 0.1 };
    const gap = 14;
    const w = (inner.w - gap * (kids.length - 1)) / kids.length;
    kids.forEach((k, i) => {
      contains.push({ outer: s.label, inner: k.label });
      draw(k, { x: inner.x + i * (w + gap), y: inner.y, w, h: inner.h }, depth + 1);
    });
  };
  draw(spec, box, 0);
  return { labels, nodes, contains };
}

export interface VennSpec {
  sets: string[];
  /** Label written in the overlap of all sets. */
  overlap: string;
  /** Items written inside single sets (outside the overlap). */
  members?: string[][];
}

/** Two or three overlapping circles with set names outside and a label in the shared region. */
export function drawVenn(pen: Pen, box: Box, spec: VennSpec, textSize = 14): Relations {
  const labels: string[] = [];
  const contains: Containment[] = [];
  const n = spec.sets.length;
  const r = n === 2 ? Math.min(box.h / 2.2, box.w / 3.1) : Math.min(box.h / 3.3, box.w / 3.1);
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2 + (n === 3 ? r * 0.2 : 0);
  const centers: Offset[] = n === 2 ? [{ x: cx - r * 0.55, y: cy }, { x: cx + r * 0.55, y: cy }] : [{ x: cx - r * 0.6, y: cy + r * 0.3 }, { x: cx + r * 0.6, y: cy + r * 0.3 }, { x: cx, y: cy - r * 0.7 }];
  centers.forEach((c, i) => {
    drawCircle(pen, c.x, c.y, r);
    const name = spec.sets[i];
    const outward = { x: c.x - cx, y: c.y - cy };
    const ol = Math.hypot(outward.x, outward.y) || 1;
    const lx = c.x + (outward.x / ol) * r * 0.75 - textWidth(name, textSize) / 2;
    const ly = c.y + (outward.y / ol) * r * 0.75 + textSize * 0.4;
    writeText(pen, name, lx, ly, { size: textSize });
    labels.push(name);
    const items = spec.members?.[i] ?? [];
    items.forEach((it, k) => {
      const size = textSize * 0.8;
      writeText(pen, it, c.x + (outward.x / ol) * r * 0.35 - textWidth(it, size) / 2, c.y + (outward.y / ol) * r * 0.35 + size * (k + 0.4) * 1.4 - size * 0.6, { size });
      labels.push(it);
      contains.push({ outer: name, inner: it });
    });
  });
  const ox = centers.reduce((s, c) => s + c.x, 0) / n, oy = centers.reduce((s, c) => s + c.y, 0) / n;
  const size = textSize * 0.85;
  writeText(pen, spec.overlap, ox - textWidth(spec.overlap, size) / 2, oy + size * 0.4, { size });
  labels.push(spec.overlap);
  for (const s of spec.sets) contains.push({ outer: s, inner: spec.overlap });
  return { labels, nodes: spec.sets, contains };
}

export interface MultiPlotSpec {
  title?: string;
  xLabel: string;
  yLabel: string;
  xTicks: string[];
  yTicks?: string[];
  curves: { name: string; f: (u: number) => number; style: 'solid' | 'dashed' | 'dotted' }[];
}

/** Axes with titles, 2–3 curves in different line styles and a legend box naming them. */
export function drawPlotMulti(pen: Pen, box: Box, spec: MultiPlotSpec, textSize = 14): Relations {
  const { rng, w } = pen;
  const labels: string[] = [];
  const o = { x: box.x + textSize * 2.6, y: box.y + box.h - textSize * 2.2 };
  const xEnd = { x: box.x + box.w, y: o.y };
  const yEnd = { x: o.x, y: box.y + (spec.title ? textSize * 2 : 4) };
  drawLine(pen, { x: o.x, y: o.y + rng.range(0, 6) }, yEnd, { shake: 0.6, bow: 0.3 });
  drawArrowHead(pen, yEnd, -Math.PI / 2, 10);
  drawLine(pen, { x: o.x - rng.range(0, 6), y: o.y }, xEnd, { shake: 0.6, bow: 0.3 });
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
  writeText(pen, spec.xLabel, o.x + plotW / 2 - textWidth(spec.xLabel, textSize) / 2, o.y + textSize * 2.7, { size: textSize });
  labels.push(spec.xLabel);
  writeText(pen, spec.yLabel, o.x + 10, yEnd.y + textSize * 1.1, { size: textSize });
  labels.push(spec.yLabel);
  if (spec.title) {
    writeText(pen, spec.title, o.x + plotW / 2 - textWidth(spec.title, textSize) / 2, box.y + textSize, { size: textSize });
    labels.push(spec.title);
  }
  const strokeStyle = (pts: Offset[], style: MultiPlotSpec['curves'][number]['style']) => {
    if (style === 'solid') w.stroke(pts, { pauseMs: 400 });
    else if (style === 'dashed') for (let i = 0; i < pts.length - 2; i += 4) w.stroke(pts.slice(i, i + 3), { pauseMs: 110 });
    else for (let i = 0; i < pts.length; i += 3) w.stroke([pts[i], { x: pts[i].x + 1, y: pts[i].y + 0.8 }], { pauseMs: 90 });
  };
  for (const c of spec.curves) {
    const pts: Offset[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      pts.push({ x: o.x + 8 + plotW * u, y: o.y - 8 - plotH * Math.max(0, Math.min(1, c.f(u))) });
    }
    strokeStyle(pts, c.style);
  }
  // Legend: box in the top-right with a line sample and the curve's name.
  const lsize = textSize * 0.8;
  const lw = Math.max(...spec.curves.map((c) => textWidth(c.name, lsize))) + 44;
  const lh = spec.curves.length * lsize * 1.7 + 10;
  const lx = xEnd.x - lw - 6, ly = yEnd.y + 8;
  drawRect(pen, { x: lx, y: ly, w: lw, h: lh });
  spec.curves.forEach((c, i) => {
    const y = ly + 8 + lsize * (i * 1.7 + 0.8);
    const sample: Offset[] = [];
    for (let k = 0; k <= 6; k++) sample.push({ x: lx + 6 + k * 4, y });
    strokeStyle(sample, c.style);
    writeText(pen, c.name, lx + 36, y + lsize * 0.4, { size: lsize });
    labels.push(c.name);
  });
  return { labels, sequence: spec.curves.map((c) => c.name) };
}

export interface BarValuesSpec {
  title?: string;
  bars: { label: string; value: number; value2?: number }[];
  /** Value text written above each bar (or inside each stacked segment). */
  stacked?: boolean;
  unit?: string;
}

/** Bar chart with the values written on it; `stacked` draws two segments per bar with a value in each. */
export function drawBarValues(pen: Pen, box: Box, spec: BarValuesSpec, textSize = 14): Relations {
  const { rng, w } = pen;
  const labels: string[] = [];
  const o = { x: box.x + textSize * 1.5, y: box.y + box.h - textSize * 2 };
  const top = box.y + (spec.title ? textSize * 2.2 : textSize * 1.2);
  drawLine(pen, { x: o.x, y: o.y + 4 }, { x: o.x, y: top }, { shake: 0.6, bow: 0.3 });
  drawLine(pen, { x: o.x - 4, y: o.y }, { x: box.x + box.w, y: o.y }, { shake: 0.6, bow: 0.3 });
  const n = spec.bars.length;
  const slot = (box.x + box.w - o.x - 10) / n;
  const barW = slot * 0.55;
  const maxV = Math.max(...spec.bars.map((b) => b.value + (spec.stacked ? (b.value2 ?? 0) : 0)), 1e-6);
  const scale = (o.y - top - textSize * 1.4) / maxV;
  const fmt = (v: number) => `${v}${spec.unit ?? ''}`;
  spec.bars.forEach((b, i) => {
    const x = o.x + 10 + slot * i + (slot - barW) / 2;
    const h1 = b.value * scale;
    const jc = (p: Offset) => ({ x: p.x + rng.gauss() * messOf(pen).corner * 0.6, y: p.y + rng.gauss() * messOf(pen).corner * 0.6 });
    w.stroke([{ x, y: o.y }, { x, y: o.y - h1 }, { x: x + barW, y: o.y - h1 }, { x: x + barW, y: o.y }].map(jc), { pauseMs: 250 });
    const vsize = textSize * 0.8;
    if (spec.stacked && b.value2 !== undefined) {
      const h2 = b.value2 * scale;
      w.stroke([{ x, y: o.y - h1 }, { x, y: o.y - h1 - h2 }, { x: x + barW, y: o.y - h1 - h2 }, { x: x + barW, y: o.y - h1 }].map(jc), { pauseMs: 250 });
      // Hatch the top segment with 45° lines so the two parts read differently.
      const yB = o.y - h1;
      for (let c = 10; c < barW + h2; c += 12) {
        const s0 = Math.max(0, c - h2), s1 = Math.min(barW, c);
        if (s1 - s0 < 3) continue;
        w.stroke([{ x: x + s0, y: yB - Math.min(c, h2) }, { x: x + s1, y: yB - Math.max(0, c - barW) }], { pauseMs: 70 });
      }
      const t1 = fmt(b.value), t2 = fmt(b.value2);
      writeText(pen, t1, x + barW / 2 - textWidth(t1, vsize) / 2, o.y - h1 / 2 + vsize * 0.4, { size: vsize });
      writeText(pen, t2, x + barW / 2 - textWidth(t2, vsize) / 2, o.y - h1 - h2 - 6, { size: vsize });
      labels.push(t1, t2);
    } else {
      const t = fmt(b.value);
      writeText(pen, t, x + barW / 2 - textWidth(t, vsize) / 2, o.y - h1 - 6, { size: vsize });
      labels.push(t);
    }
    writeText(pen, b.label, x + barW / 2 - textWidth(b.label, textSize * 0.85) / 2, o.y + textSize * 1.4, { size: textSize * 0.85 });
    labels.push(b.label);
  });
  if (spec.title) {
    writeText(pen, spec.title, o.x + (box.x + box.w - o.x) / 2 - textWidth(spec.title, textSize) / 2, box.y + textSize, { size: textSize });
    labels.push(spec.title);
  }
  return { labels, sequence: spec.bars.map((b) => b.label) };
}

export interface TableSpec {
  /** Column headers; the first is the corner cell (may be ''). */
  columns: string[];
  rows: { header: string; cells: string[] }[];
}

/** Table / matrix: ruled grid, header row + header column, values in the cells. */
export function drawTable(pen: Pen, box: Box, spec: TableSpec, textSize = 14): Relations {
  const labels: string[] = [];
  const cols = spec.columns.length, rows = spec.rows.length + 1;
  const cw = box.w / cols, rh = Math.min(box.h / rows, textSize * 2.8);
  const h = rh * rows;
  for (let r = 0; r <= rows; r++) drawLine(pen, { x: box.x - 2, y: box.y + rh * r }, { x: box.x + box.w + 2, y: box.y + rh * r }, { shake: 0.7, pauseMs: 220 });
  for (let c = 0; c <= cols; c++) drawLine(pen, { x: box.x + cw * c, y: box.y - 2 }, { x: box.x + cw * c, y: box.y + h + 2 }, { shake: 0.7, pauseMs: 220 });
  const cell = (text: string, c: number, r: number, size = textSize) => {
    if (!text) return;
    writeText(pen, text, box.x + cw * (c + 0.5) - textWidth(text, size) / 2, box.y + rh * (r + 0.5) + size * 0.4, { size });
    labels.push(text);
  };
  spec.columns.forEach((t, c) => cell(t, c, 0));
  spec.rows.forEach((row, r) => {
    cell(row.header, 0, r + 1);
    row.cells.forEach((v, c) => cell(v, c + 1, r + 1, textSize * 0.9));
  });
  return { labels, sequence: spec.columns.filter(Boolean) };
}

export interface MindMapSpec {
  center: string;
  branches: { label: string; leaves?: string[] }[];
}

/** Mind map: central ellipse, curved branches radiating to labels, short twigs to leaves. */
export function drawMindMap(pen: Pen, box: Box, spec: MindMapSpec, textSize = 14): Relations {
  const { rng } = pen;
  const labels: string[] = [spec.center];
  const edges: FigureEdge[] = [];
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const rx = Math.max(40, textWidth(spec.center, textSize + 2) / 2 + 16), ry = textSize * 1.6;
  drawEllipse(pen, cx, cy, rx, ry);
  label(pen, spec.center, { x: cx, y: cy }, textSize + 2);
  const n = spec.branches.length;
  const Rx = box.w / 2 - 150, Ry = box.h / 2 - 40;
  spec.branches.forEach((b, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / n + rng.range(-0.12, 0.12);
    const end = { x: cx + Math.cos(a) * Rx, y: cy + Math.sin(a) * Ry };
    const start = { x: cx + Math.cos(a) * rx * 1.05, y: cy + Math.sin(a) * ry * 1.05 };
    const mid = lerp(start, end, 0.5);
    const bend = { x: mid.x - Math.sin(a) * rng.range(-25, 25), y: mid.y + Math.cos(a) * rng.range(-25, 25) };
    pen.w.stroke(quadPoints(start, bend, end, 14), { pauseMs: 300 });
    const dir = Math.cos(a) >= -0.05 ? 1 : -1;
    const bw = textWidth(b.label, textSize);
    const lx = dir > 0 ? end.x + 6 : end.x - 6 - bw;
    writeText(pen, b.label, lx, end.y + textSize * 0.4, { size: textSize });
    labels.push(b.label);
    edges.push({ from: spec.center, to: b.label });
    const leaves = b.leaves ?? [];
    leaves.forEach((leaf, k) => {
      const size = textSize * 0.85;
      const ly = end.y + (k - (leaves.length - 1) / 2) * size * 2 + (Math.sin(a) >= 0 ? size * 1.6 : -size * 1.6);
      const twigStart = { x: dir > 0 ? lx + bw + 6 : lx - 6, y: end.y };
      const twigEnd = { x: twigStart.x + dir * 34, y: ly - size * 0.3 };
      drawLine(pen, twigStart, twigEnd, { pauseMs: 200 });
      writeText(pen, leaf, dir > 0 ? twigEnd.x + 4 : twigEnd.x - 4 - textWidth(leaf, size), ly + size * 0.3, { size });
      labels.push(leaf);
      edges.push({ from: b.label, to: leaf });
    });
  });
  return { labels, nodes: [...labels], edges, directed: false };
}

export interface NumberLineSpec {
  ticks: string[];
  /** Index of a tick to mark with a dot and a letter. */
  mark?: { index: number; label: string };
}

/** Number line with arrowheads at both ends, labelled ticks and an optional marked point. */
export function drawNumberLine(pen: Pen, box: Box, spec: NumberLineSpec, textSize = 15): Relations {
  const { w } = pen;
  const y = box.y + box.h / 2;
  const a = { x: box.x, y }, b = { x: box.x + box.w, y };
  drawLine(pen, a, b, { shake: 0.6, bow: 0.3 });
  drawArrowHead(pen, b, 0, 10);
  drawArrowHead(pen, a, Math.PI, 10);
  const labels: string[] = [];
  const n = spec.ticks.length;
  const xs = spec.ticks.map((_, i) => box.x + 30 + ((box.w - 60) * i) / Math.max(1, n - 1));
  spec.ticks.forEach((t, i) => {
    w.stroke([{ x: xs[i], y: y - 8 }, { x: xs[i], y: y + 8 }], { pauseMs: 160 });
    writeText(pen, t, xs[i] - textWidth(t, textSize) / 2, y + textSize * 1.9, { size: textSize });
    labels.push(t);
  });
  if (spec.mark) {
    const x = xs[spec.mark.index];
    const dot: Offset[] = [];
    for (let k = 0; k <= 16; k++) dot.push({ x: x + Math.cos(k * 0.8) * (1 + k * 0.18), y: y + Math.sin(k * 0.8) * (1 + k * 0.18) });
    w.stroke(dot, { pauseMs: 300 });
    writeText(pen, spec.mark.label, x - textWidth(spec.mark.label, textSize) / 2, y - textSize * 1.1, { size: textSize });
    labels.push(spec.mark.label);
  }
  return { labels, sequence: spec.ticks };
}

export interface UnitCircleSpec {
  angleDeg: number;
  angleLabel: string;
  pointLabel?: string;
  radiusLabel?: string;
}

/** Unit circle on axes: a radius at the given angle, the angle arc with its label, the point's coordinates. */
export function drawUnitCircle(pen: Pen, box: Box, spec: UnitCircleSpec, textSize = 15): Relations {
  const { w } = pen;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const r = Math.min(box.w, box.h) / 2 - textSize * 2.2;
  drawLine(pen, { x: cx - r - 24, y: cy }, { x: cx + r + 24, y: cy }, { shake: 0.6, bow: 0.3 });
  drawArrowHead(pen, { x: cx + r + 24, y: cy }, 0, 9);
  drawLine(pen, { x: cx, y: cy + r + 24 }, { x: cx, y: cy - r - 24 }, { shake: 0.6, bow: 0.3 });
  drawArrowHead(pen, { x: cx, y: cy - r - 24 }, -Math.PI / 2, 9);
  drawCircle(pen, cx, cy, r);
  const labels = ['x', 'y'];
  writeText(pen, 'x', cx + r + 10, cy + textSize * 1.4, { size: textSize });
  writeText(pen, 'y', cx + 10, cy - r - 14, { size: textSize });
  const a = -spec.angleDeg * DEG;
  const p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  drawLine(pen, { x: cx, y: cy }, p, { pauseMs: 300 });
  // Drop a dashed vertical from the point to the x axis.
  for (let y = p.y + 8; y < cy - 4; y += 14) w.stroke([{ x: p.x, y }, { x: p.x, y: Math.min(cy - 2, y + 7) }], { pauseMs: 90 });
  w.stroke(arcPoints(cx, cy, r * 0.32, r * 0.32, a, 0, 14), { pauseMs: 250 });
  const mid = a / 2;
  writeText(pen, spec.angleLabel, cx + Math.cos(mid) * r * 0.46 - textWidth(spec.angleLabel, textSize) / 2, cy + Math.sin(mid) * r * 0.46 + textSize * 0.4, { size: textSize });
  labels.push(spec.angleLabel);
  if (spec.pointLabel) {
    const pw = textWidth(spec.pointLabel, textSize * 0.9);
    const px = p.x >= cx ? Math.min(p.x + 10, box.x + box.w - pw) : Math.max(box.x, p.x - 10 - pw);
    writeText(pen, spec.pointLabel, px, p.y - 8, { size: textSize * 0.9 });
    labels.push(spec.pointLabel);
  }
  if (spec.radiusLabel) {
    const m = lerp({ x: cx, y: cy }, p, 0.55);
    writeText(pen, spec.radiusLabel, m.x - textSize * 1.1, m.y - 6, { size: textSize * 0.9 });
    labels.push(spec.radiusLabel);
  }
  return { labels };
}

export interface TriangleSpec {
  vertices: [string, string, string];
  sides: [string, string, string];
  rightAngle?: boolean;
  angleLabel?: string;
}

/** Triangle with vertex letters at the corners and side labels along the edges; optional right-angle mark and angle label. */
export function drawTriangleLabelled(pen: Pen, box: Box, spec: TriangleSpec, textSize = 15): Relations {
  const { w, rng } = pen;
  const pad = textSize * 1.6;
  const A: Offset = { x: box.x + pad, y: box.y + box.h - pad };
  const B: Offset = { x: box.x + box.w - pad, y: box.y + box.h - pad };
  const C: Offset = spec.rightAngle ? { x: A.x, y: box.y + pad } : { x: box.x + box.w * rng.range(0.35, 0.65), y: box.y + pad };
  drawPolygon(pen, [A, B, C]);
  const labels: string[] = [];
  const [la, lb, lc] = spec.vertices;
  writeText(pen, la, A.x - textSize * 1.3, A.y + textSize * 0.9, { size: textSize });
  writeText(pen, lb, B.x + textSize * 0.4, B.y + textSize * 0.9, { size: textSize });
  writeText(pen, lc, C.x - textWidth(lc, textSize) / 2 + (spec.rightAngle ? -textSize : 0), C.y - textSize * 0.5, { size: textSize });
  labels.push(la, lb, lc);
  const sideLabel = (p: Offset, q: Offset, text: string, out: Offset) => {
    const m = lerp(p, q, 0.5);
    writeText(pen, text, m.x + out.x - textWidth(text, textSize) / 2, m.y + out.y + textSize * 0.4, { size: textSize });
    labels.push(text);
  };
  sideLabel(A, B, spec.sides[0], { x: 0, y: textSize * 1.3 });
  sideLabel(B, C, spec.sides[1], { x: textSize * 1.2, y: 0 });
  sideLabel(C, A, spec.sides[2], { x: -textSize * 1.2, y: 0 });
  if (spec.rightAngle) {
    const s = 14;
    w.stroke([{ x: A.x, y: A.y - s }, { x: A.x + s, y: A.y - s }, { x: A.x + s, y: A.y }], { pauseMs: 250 });
  }
  if (spec.angleLabel) {
    const dirC = { x: C.x - B.x, y: C.y - B.y }, dirA = { x: A.x - B.x, y: A.y - B.y };
    const a0 = Math.atan2(dirC.y, dirC.x);
    let a1 = Math.atan2(dirA.y, dirA.x);
    if (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
    if (a0 - a1 > Math.PI) a1 += Math.PI * 2;
    w.stroke(arcPoints(B.x, B.y, 26, 26, a0, a1, 10), { pauseMs: 220 });
    const mid = (a0 + a1) / 2;
    writeText(pen, spec.angleLabel, B.x + Math.cos(mid) * 42 - textWidth(spec.angleLabel, textSize) / 2, B.y + Math.sin(mid) * 42 + textSize * 0.4, { size: textSize });
    labels.push(spec.angleLabel);
  }
  return { labels, nodes: [...spec.vertices] };
}
