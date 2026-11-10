import type { InkStroke } from '../model/page';
import { arrowStroke, circle, fromPoints, line, polygon, rect, rectLines, textLine } from './shapes';

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
export const resetScenes = () => (t = 0);

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
    ...label(labels, 'start', textLine(125, 138, 3, 14, next())),
    ...label(labels, 'ok?', textLine(140, 268, 2, 14, next())),
    ...label(labels, 'end', textLine(130, 398, 3, 14, next())),
    ...label(labels, 'yes', textLine(180, 334, 2, 12, next())),
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
    ...label(labels, 'idle', textLine(128, 206, 3, 14, next())),
    ...label(labels, 'run', textLine(330, 206, 3, 14, next())),
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
    ...label(labels, 'system', textLine(200, 135, 4, 14, next())),
    ...label(labels, 'in', textLine(150, 216, 2, 14, next())),
    ...label(labels, 'out', textLine(315, 216, 3, 14, next())),
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
    ...label(labels, 'client', textLine(128, 100, 4, 14, next())),
    ...label(labels, 'server', textLine(328, 100, 4, 14, next())),
    arrowStroke(155, 180, 345, 180, next()),
    arrowStroke(345, 260, 155, 260, next()),
    ...label(labels, 'req', textLine(235, 172, 3, 12, next())),
    ...label(labels, 'resp', textLine(230, 252, 3, 12, next())),
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
    ...label(labels, 'name', textLine(130, 132, 3, 14, next())),
    ...label(labels, 'qty', textLine(290, 132, 3, 14, next())),
    ...label(labels, 'nut', textLine(130, 182, 3, 14, next())),
    ...label(labels, '12', textLine(290, 232, 2, 14, next())),
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
    ...label(labels, 'topic', textLine(275, 306, 4, 12, next())),
    ...label(labels, 'a', textLine(292, 156, 1, 12, next())),
    ...label(labels, 'b', textLine(442, 306, 1, 12, next())),
    ...label(labels, 'c', textLine(292, 456, 1, 12, next())),
    ...label(labels, 'd', textLine(142, 306, 1, 12, next())),
  ];
  return { name: 'mind-map', strokes, labels };
}

/** Three words joined by arrows, no boxes (a pipeline written as text). */
export function arrowsBetweenWords(): Scene {
  resetScenes();
  const labels: Record<string, string[]> = {};
  const strokes = [
    ...label(labels, 'load', textLine(100, 100, 4, 14, next())),
    ...label(labels, 'train', textLine(260, 100, 4, 14, next())),
    ...label(labels, 'eval', textLine(420, 100, 4, 14, next())),
    arrowStroke(150, 93, 252, 93, next()),
    arrowStroke(310, 93, 412, 93, next()),
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
    ...label(labels, 'a', textLine(140, 136, 1, 14, next())),
    ...label(labels, 'b', textLine(340, 136, 1, 14, next())),
    ...label(labels, 'notes', textLine(100, 230, 14, 16, next())),
    circle(180, 360, 45, next()),
    ...label(labels, 'c', textLine(172, 366, 1, 14, next())),
  ];
  return { name: 'two-figures', strokes, labels };
}

export const ALL_SCENES = [flowchartWithLoop, stateMachine, nestedBoxes, sequenceDiagram, tableGrid, mindMap, arrowsBetweenWords, twoFiguresWithNotes];
