import type { InkStroke } from '../model/page';
import { InkToolType, StockBrush } from '../types/brush';

/**
 * Synthetic "hand-drawn" strokes for the shape classifier tests and the Ollama smoke
 * script. `wobble` adds deterministic jitter so the shapes are imperfect like real ink.
 */

let counter = 0;
let seed = 1;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
export function resetSynthetic(s = 1) {
  seed = s;
  counter = 0;
}

export function fromPoints(points: { x: number; y: number }[], t = 0, id?: string, wobble = 0): InkStroke {
  const inputs = points.map((p, i) => ({ x: p.x + (rand() - 0.5) * wobble, y: p.y + (rand() - 0.5) * wobble, timeMillis: t + i * 8 }));
  return { id: id ?? `syn${counter++}`, inputs: { tool: InkToolType.STYLUS, inputs }, brush: { stockBrush: StockBrush.BALLPOINT, color: 0xff000000, size: 3 } };
}

export function line(x0: number, y0: number, x1: number, y1: number, t = 0, wobble = 1.5, n = 24): InkStroke {
  return fromPoints(Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (n - 1), y: y0 + ((y1 - y0) * i) / (n - 1) })), t, undefined, wobble);
}

/** Closed ellipse; a circle when rx === ry. `gap` leaves the loop open by that many degrees. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, t = 0, wobble = 2, gap = 8): InkStroke {
  const n = 64;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + ((360 - gap) * (Math.PI / 180) * i) / (n - 1);
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
  return fromPoints(pts, t, undefined, wobble);
}
export const circle = (cx: number, cy: number, r: number, t = 0, wobble = 2) => ellipse(cx, cy, r, r, t, wobble);

/** Polygon through the corners (closed in one stroke), 10 points per side. */
export function polygon(corners: { x: number; y: number }[], t = 0, wobble = 1.5): InkStroke {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    for (let k = 0; k < 10; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / 10, y: a.y + ((b.y - a.y) * k) / 10 });
  }
  pts.push({ x: corners[0].x + 2, y: corners[0].y + 1 });
  return fromPoints(pts, t, undefined, wobble);
}
export const rect = (l: number, tp: number, r: number, b: number, t = 0, wobble = 1.5) => polygon([{ x: l, y: tp }, { x: r, y: tp }, { x: r, y: b }, { x: l, y: b }], t, wobble);

/** Rectangle drawn as four separate line strokes. */
export function rectLines(l: number, tp: number, r: number, b: number, t = 0): InkStroke[] {
  return [line(l, tp, r, tp, t), line(r, tp, r, b, t + 300), line(r, b, l, b, t + 600), line(l, b, l, tp, t + 900)];
}

/** Arrow in one stroke: shaft then a V at the tip. */
export function arrowStroke(x0: number, y0: number, x1: number, y1: number, t = 0, head = 14): InkStroke {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const w1 = { x: x1 - ux * head + px * head * 0.7, y: y1 - uy * head + py * head * 0.7 };
  const w2 = { x: x1 - ux * head - px * head * 0.7, y: y1 - uy * head - py * head * 0.7 };
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 20; i++) pts.push({ x: x0 + (dx * i) / 20, y: y0 + (dy * i) / 20 });
  for (let i = 1; i <= 4; i++) pts.push({ x: x1 + ((w1.x - x1) * i) / 4, y: y1 + ((w1.y - y1) * i) / 4 });
  for (let i = 3; i >= 0; i--) pts.push({ x: x1 + ((w1.x - x1) * i) / 4, y: y1 + ((w1.y - y1) * i) / 4 });
  for (let i = 1; i <= 4; i++) pts.push({ x: x1 + ((w2.x - x1) * i) / 4, y: y1 + ((w2.y - y1) * i) / 4 });
  return fromPoints(pts, t, undefined, 1);
}

/** Arrow as a line plus a separate V-shaped head stroke. */
export function arrowTwoStrokes(x0: number, y0: number, x1: number, y1: number, t = 0, head = 14): InkStroke[] {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const w1 = { x: x1 - ux * head + px * head * 0.7, y: y1 - uy * head + py * head * 0.7 };
  const w2 = { x: x1 - ux * head - px * head * 0.7, y: y1 - uy * head - py * head * 0.7 };
  const vee = fromPoints([...Array.from({ length: 6 }, (_, i) => ({ x: w1.x + ((x1 - w1.x) * i) / 5, y: w1.y + ((y1 - w1.y) * i) / 5 })), ...Array.from({ length: 6 }, (_, i) => ({ x: x1 + ((w2.x - x1) * i) / 5, y: y1 + ((w2.y - y1) * i) / 5 }))], t + 400, undefined, 1);
  return [line(x0, y0, x1, y1, t), vee];
}

/** L-shaped x/y axes as two strokes with the origin bottom-left. */
export function axes(ox: number, oy: number, w: number, h: number, t = 0): InkStroke[] {
  return [line(ox, oy - h, ox, oy, t), line(ox, oy, ox + w, oy, t + 500)];
}

/** Smooth curve y = f(x) sampled across [x0, x1]. */
export function curve(x0: number, x1: number, f: (x: number) => number, t = 0, n = 40): InkStroke {
  return fromPoints(Array.from({ length: n }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    return { x, y: f(x) };
  }), t, undefined, 1);
}

/** Isometric cube: front square, back square offset by (d, -d), and four connecting edges. */
export function cube(x: number, y: number, s: number, d: number, t = 0): InkStroke[] {
  return [
    ...rectLines(x, y, x + s, y + s, t),
    ...rectLines(x + d, y - d, x + s + d, y + s - d, t + 1200),
    line(x, y, x + d, y - d, t + 2400),
    line(x + s, y, x + s + d, y - d, t + 2600),
    line(x + s, y + s, x + s + d, y + s - d, t + 2800),
    line(x, y + s, x + d, y + s - d, t + 3000),
  ];
}

/** Letter-ish marks on a baseline: short zigzag strokes of height `h`, spaced `h * 0.8`. */
export function textLine(x: number, y: number, chars: number, h = 18, t = 0): InkStroke[] {
  const out: InkStroke[] = [];
  for (let i = 0; i < chars; i++) {
    const cx = x + i * h * 0.8;
    const kind = i % 4;
    if (kind === 0) out.push(fromPoints([{ x: cx, y }, { x: cx + h * 0.3, y: y - h }, { x: cx + h * 0.6, y }], t + i * 200, undefined, 1.5));
    else if (kind === 1) out.push(fromPoints([{ x: cx, y: y - h }, { x: cx, y }, { x: cx + h * 0.5, y }], t + i * 200, undefined, 1.5));
    else if (kind === 2) out.push(ellipse(cx + h * 0.3, y - h * 0.3, h * 0.3, h * 0.3, t + i * 200, 1));
    else out.push(fromPoints([{ x: cx, y: y - h * 0.5 }, { x: cx + h * 0.5, y: y - h * 0.5 }, { x: cx + h * 0.25, y: y - h }, { x: cx + h * 0.25, y }], t + i * 200, undefined, 1.5));
  }
  return out;
}
