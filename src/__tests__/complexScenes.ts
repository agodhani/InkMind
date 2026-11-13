import type { InkStroke } from '../model/page';
import { measureText } from '../sim/font';
import { DEFAULT_INK_STYLE, InkWriter } from '../sim/ink';
import { Rng } from '../sim/rng';
import { writeText, type Pen } from '../sim/shapes';
import { arrowStroke, circle, fromPoints, line, polygon, rect, rectLines } from './shapes';

/**
 * Synthetic multi-shape scenes for the relation/order geometry tests and the local-model smoke
 * script: flowchart with a back-edge, state machine with a self-loop, nested boxes, lifelines,
 * a table grid, a mind map, arrows between bare words, two figures on one page. Elements are
 * written ≥ 5 s apart so the clusterer keeps shapes, arrows and labels in separate groups
 * (as happens when a person draws the boxes first and writes the words afterwards).
 */

const STEP = 6000;
let t = 0;
const next = () => (t += STEP);
let pen: Pen;
export const resetScenes = () => {
  t = 0;
  const rng = new Rng('complex-scenes');
  pen = { rng, w: new InkWriter(rng.fork('ink'), 'w', { ...DEFAULT_INK_STYLE }) };
};
resetScenes();

/** Hand-written word (simulator Hershey glyphs) centred on (cx, cy); `size` is the cap height. */
export function word(text: string, cx: number, cy: number, size = 14): InkStroke[] {
  pen.w.pause(STEP);
  const w = measureText(text, size, size * 0.1);
  return writeText(pen, text, cx - w / 2, cy + size / 2, { size, shake: 0.4 });
}
export const wordWidth = (text: string, size = 14) => measureText(text, size, size * 0.1);

/** Arrow whose shaft follows `path` (≥ 3 points), ending in a V head at the last point. */
export function curvedArrow(path: { x: number; y: number }[], time = next(), head = 12): InkStroke {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1];
    for (let k = 0; k < 8; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / 8, y: a.y + ((b.y - a.y) * k) / 8 });
  }
  const end = path[path.length - 1], prev = path[path.length - 2];
  const dx = end.x - prev.x, dy = end.y - prev.y, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const w1 = { x: end.x - ux * head + px * head * 0.7, y: end.y - uy * head + py * head * 0.7 };
  const w2 = { x: end.x - ux * head - px * head * 0.7, y: end.y - uy * head - py * head * 0.7 };
  pts.push(end);
  for (let i = 1; i <= 3; i++) pts.push({ x: end.x + ((w1.x - end.x) * i) / 3, y: end.y + ((w1.y - end.y) * i) / 3 });
  for (let i = 2; i >= 0; i--) pts.push({ x: end.x + ((w1.x - end.x) * i) / 3, y: end.y + ((w1.y - end.y) * i) / 3 });
  for (let i = 1; i <= 3; i++) pts.push({ x: end.x + ((w2.x - end.x) * i) / 3, y: end.y + ((w2.y - end.y) * i) / 3 });
  return fromPoints(pts, time, undefined, 1);
}

/** Arc of a circle from `a0` to `a1` degrees (screen coords, clockwise positive), as path points. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number, n = 12) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

export const diamond = (cx: number, cy: number, w: number, h: number, time = next()) =>
  polygon([{ x: cx, y: cy - h / 2 }, { x: cx + w / 2, y: cy }, { x: cx, y: cy + h / 2 }, { x: cx - w / 2, y: cy }], time);

export interface Scene {
  name: string;
  strokes: InkStroke[];
  /** Stroke ids of the written labels, by name, for mapping back in tests. */
  labels: Record<string, string[]>;
}

const label = (labels: Record<string, string[]>, name: string, strokes: InkStroke[]) => {
  labels[name] = strokes.map((s) => s.id);
  return strokes;
};

/** start → decision → end, with a back-edge from end to start and "yes" written on the decision → end arrow. */
export function flowchartWithLoop(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const strokes = [
    rect(100, 100, 220, 160, next()),
    diamond(160, 260, 120, 70),
    rect(100, 360, 220, 420, next()),
    arrowStroke(160, 165, 160, 220, next()),
    arrowStroke(160, 300, 160, 355, next()),
    arrowStroke(240, 385, 240, 135, next()),
    ...label(labels, 'start', word('start', 160, 130)),
    ...label(labels, 'ok?', word('ok?', 160, 260, 12)),
    ...label(labels, 'end', word('end', 160, 390)),
    ...label(labels, 'yes', word('yes', 190, 328, 11)),
  ];
  return { name: 'flowchart-loop', strokes, labels };
}

/** Two states; idle → run; run loops on itself with a curved arrow. */
export function stateMachine(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const strokes = [
    circle(150, 200, 40, next()),
    circle(350, 200, 40, next()),
    arrowStroke(195, 200, 305, 200, next()),
    curvedArrow(arcPath(350, 130, 36, 65, -245), next()),
    ...label(labels, 'idle', word('idle', 150, 200)),
    ...label(labels, 'run', word('run', 350, 200)),
  ];
  return { name: 'state-machine', strokes, labels };
}

/** A big box titled at the top with two boxes inside it, connected by an arrow. */
export function nestedBoxes(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const strokes = [
    rect(100, 100, 400, 300, next()),
    rect(120, 160, 210, 260, next()),
    rect(290, 160, 380, 260, next()),
    arrowStroke(215, 210, 285, 210, next()),
    ...label(labels, 'system', word('system', 250, 128)),
    ...label(labels, 'in', word('in', 165, 210)),
    ...label(labels, 'out', word('out', 335, 210)),
  ];
  return { name: 'nested-boxes', strokes, labels };
}

/** Two lifelines with a name above each and two messages (one each way). */
export function sequenceDiagram(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const strokes = [
    line(150, 120, 150, 400, next()),
    line(350, 120, 350, 400, next()),
    ...label(labels, 'client', word('client', 150, 97)),
    ...label(labels, 'server', word('server', 350, 97)),
    arrowStroke(155, 180, 345, 180, next()),
    arrowStroke(345, 260, 155, 260, next()),
    ...label(labels, 'req', word('req', 250, 166, 11)),
    ...label(labels, 'resp', word('resp', 250, 246, 11)),
  ];
  return { name: 'sequence', strokes, labels };
}

/** A 3×2 table: border plus two horizontal and one vertical interior line, text in four cells. */
export function tableGrid(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const t0 = next();
  const strokes = [
    ...rectLines(100, 100, 400, 250, t0),
    line(100, 150, 400, 150, next()),
    line(100, 200, 400, 200, next()),
    line(250, 100, 250, 250, next()),
    ...label(labels, 'name', word('name', 175, 125)),
    ...label(labels, 'qty', word('qty', 325, 125)),
    ...label(labels, 'nut', word('nut', 175, 175)),
    ...label(labels, '12', word('12', 325, 225)),
  ];
  return { name: 'table', strokes, labels };
}

/** Hub circle with four satellite circles joined by plain lines. */
export function mindMap(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const strokes = [
    circle(300, 300, 40, next()),
    circle(300, 150, 30, next()),
    circle(450, 300, 30, next()),
    circle(300, 450, 30, next()),
    circle(150, 300, 30, next()),
    line(300, 255, 300, 185, next()),
    line(345, 300, 415, 300, next()),
    line(300, 345, 300, 415, next()),
    line(255, 300, 185, 300, next()),
    ...label(labels, 'topic', word('topic', 300, 300, 12)),
    ...label(labels, 'a', word('a', 300, 150, 12)),
    ...label(labels, 'b', word('b', 450, 300, 12)),
    ...label(labels, 'c', word('c', 300, 450, 12)),
    ...label(labels, 'd', word('d', 150, 300, 12)),
  ];
  return { name: 'mind-map', strokes, labels };
}

/** Three words joined by arrows, no boxes (a pipeline written as text). */
export function arrowsBetweenWords(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const cx = [120, 290, 460];
  const half = ['load', 'train', 'eval'].map((w) => wordWidth(w) / 2);
  const strokes = [
    ...label(labels, 'load', word('load', cx[0], 95)),
    ...label(labels, 'train', word('train', cx[1], 95)),
    ...label(labels, 'eval', word('eval', cx[2], 95)),
    arrowStroke(cx[0] + half[0] + 10, 93, cx[1] - half[1] - 10, 93, next()),
    arrowStroke(cx[1] + half[1] + 10, 93, cx[2] - half[2] - 10, 93, next()),
  ];
  return { name: 'arrows-between-words', strokes, labels };
}

/** A two-box flowchart, a line of notes under it, and a labelled circle further down. */
export function twoFiguresWithNotes(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const strokes = [
    rect(100, 100, 200, 160, next()),
    rect(300, 100, 400, 160, next()),
    arrowStroke(205, 130, 295, 130, next()),
    ...label(labels, 'a', word('a', 150, 130)),
    ...label(labels, 'b', word('b', 350, 130)),
    ...label(labels, 'notes', word('notes on the flow above', 230, 225, 16)),
    circle(180, 360, 45, next()),
    ...label(labels, 'c', word('c', 180, 360)),
  ];
  return { name: 'two-figures', strokes, labels };
}

export const ALL_SCENES = [flowchartWithLoop, stateMachine, nestedBoxes, sequenceDiagram, tableGrid, mindMap, arrowsBetweenWords, twoFiguresWithNotes];
