import type { Offset } from '../types';
import { FUTURAL_JHF } from './hersheyFutural';

/** A single-line glyph: polylines in font units, y down, baseline at y = 9, cap height 21 (from -12). */
export interface Glyph {
  left: number;
  right: number;
  paths: Offset[][];
}

const CAP_HEIGHT_UNITS = 21;
const BASELINE_UNITS = 9;

let cache: Map<string, Glyph> | null = null;

/** Parse one JHF record: 5-char id, 3-char vertex count, then (x, y) char pairs relative to 'R'; " R" lifts the pen. */
export function parseJhf(line: string): Glyph {
  const count = Number(line.slice(5, 8));
  const data = line.slice(8);
  const left = data.charCodeAt(0) - 82;
  const right = data.charCodeAt(1) - 82;
  const paths: Offset[][] = [];
  let current: Offset[] = [];
  for (let i = 1; i < count; i++) {
    const a = data[2 * i], b = data[2 * i + 1];
    if (a === ' ' && b === 'R') {
      if (current.length) paths.push(current);
      current = [];
      continue;
    }
    current.push({ x: a.charCodeAt(0) - 82, y: b.charCodeAt(0) - 82 });
  }
  if (current.length) paths.push(current);
  return { left, right, paths };
}

/** A few maths symbols the Hershey set lacks, in the same font units (baseline y = 9, cap top y = -12). */
const EXTRA_GLYPHS: Record<string, Glyph> = {
  '°': { left: -5, right: 5, paths: [ring(0, -9, 3)] },
  'θ': { left: -8, right: 8, paths: [ellipse(0, -1.5, 5.5, 10.5), [{ x: -5, y: -1 }, { x: 5, y: -1 }]] },
  'π': { left: -10, right: 10, paths: [[{ x: -9, y: -3 }, { x: -7, y: -5 }, { x: 9, y: -5 }], [{ x: -4, y: -5 }, { x: -4, y: 9 }], [{ x: 4, y: -5 }, { x: 4, y: 9 }]] },
  '√': { left: -10, right: 12, paths: [[{ x: -9, y: 0 }, { x: -5, y: 9 }, { x: 2, y: -12 }, { x: 11, y: -12 }]] },
  '∩': { left: -9, right: 9, paths: [[{ x: -6, y: 9 }, { x: -6, y: -4 }, { x: -5, y: -8 }, { x: -2, y: -11 }, { x: 2, y: -11 }, { x: 5, y: -8 }, { x: 6, y: -4 }, { x: 6, y: 9 }]] },
  'β': { left: -8, right: 9, paths: [[{ x: -5, y: 13 }, { x: -5, y: -8 }, { x: -3, y: -11 }, { x: 1, y: -12 }, { x: 4, y: -10 }, { x: 4, y: -5 }, { x: 1, y: -2 }, { x: -3, y: -1 }, { x: 2, y: -1 }, { x: 6, y: 2 }, { x: 6, y: 6 }, { x: 3, y: 9 }, { x: -5, y: 9 }]] },
};

function ring(cx: number, cy: number, r: number): Offset[] {
  return ellipse(cx, cy, r, r);
}

function ellipse(cx: number, cy: number, rx: number, ry: number): Offset[] {
  const pts: Offset[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function glyphs(): Map<string, Glyph> {
  if (cache) return cache;
  cache = new Map();
  FUTURAL_JHF.forEach((line, i) => cache!.set(String.fromCharCode(32 + i), parseJhf(line)));
  for (const [ch, g] of Object.entries(EXTRA_GLYPHS)) cache.set(ch, g);
  return cache;
}

export function glyphFor(ch: string): Glyph {
  const g = glyphs().get(ch);
  if (g) return g;
  // Fall back to '?' for anything outside printable ASCII.
  return glyphs().get('?')!;
}

export interface TextLayout {
  /** Page-space polylines, one per pen-down path, grouped per character. */
  chars: { ch: string; x: number; polylines: Offset[][] }[];
  width: number;
}

/**
 * Lay out a line of text as polylines. `size` is the cap height in page px; `y` is the baseline.
 * Punctuation-only chars keep their Hershey advance so word spacing stays natural.
 */
export function layoutText(text: string, x: number, y: number, size: number, letterSpacing = 0): TextLayout {
  const s = size / CAP_HEIGHT_UNITS;
  const chars: TextLayout['chars'] = [];
  let cursor = x;
  for (const ch of text) {
    const g = glyphFor(ch);
    const originX = cursor - g.left * s;
    const polylines = g.paths.map((p) => p.map((pt) => ({ x: originX + pt.x * s, y: y + (pt.y - BASELINE_UNITS) * s })));
    chars.push({ ch, x: cursor, polylines });
    cursor += (g.right - g.left) * s + letterSpacing;
  }
  return { chars, width: cursor - x };
}

export function measureText(text: string, size: number, letterSpacing = 0): number {
  return layoutText(text, 0, 0, size, letterSpacing).width;
}
