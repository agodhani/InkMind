import type { Offset } from '../types';
import { InkToolType, StockBrush } from '../types/brush';
import type { InkStroke } from '../model/page';
import type { Rng } from './rng';

export interface InkStyle {
  /** Per-point gaussian jitter, px. */
  jitter: number;
  /** Amplitude of slow hand wobble along the stroke, px. */
  wobble: number;
  /** Pen speed range, px per ms. */
  speed: [number, number];
  /** Resting pressure range. */
  pressure: [number, number];
  /** Sampling interval of the (simulated) digitizer, ms. */
  sampleMs: number;
  brushSize: number;
  color: number;
}

export const DEFAULT_INK_STYLE: InkStyle = {
  jitter: 0.22,
  wobble: 1.4,
  speed: [0.35, 0.8],
  pressure: [0.45, 0.75],
  sampleMs: 8,
  brushSize: 2.5,
  color: 0xff1b1b1f,
};

export interface StrokeOptions {
  /** Pause before the pen touches down, ms (default: short in-word pause). */
  pauseMs?: number;
  /** Scale jitter/wobble for this stroke (e.g. less for ruled axes, more for scribbles). */
  shake?: number;
  /** Close the path by drawing back to the start (with a human overshoot). */
  close?: boolean;
}

/**
 * Turns ideal polylines into strokes the way a hand would draw them: resampled at digitizer rate,
 * with jitter, slow wobble, pressure that ramps in and out, and monotonically increasing timestamps.
 */
export class InkWriter {
  private t: number;
  private n = 0;
  private readonly rng: Rng;
  private readonly idPrefix: string;
  style: InkStyle;
  readonly strokes: InkStroke[] = [];

  constructor(rng: Rng, idPrefix = 's', style: InkStyle = DEFAULT_INK_STYLE, startTime = 1_700_000_000_000) {
    this.rng = rng;
    this.idPrefix = idPrefix;
    this.style = style;
    this.t = startTime;
  }

  get now(): number {
    return this.t;
  }

  /** Lift the pen for a while (between words, lines, figures). */
  pause(ms: number): void {
    this.t += Math.max(0, ms * this.rng.range(0.8, 1.25));
  }

  stroke(points: Offset[], opts: StrokeOptions = {}): InkStroke | null {
    const path = opts.close && points.length > 2 ? [...points, lerp(points[points.length - 1], points[0], 1 + this.rng.range(0, 0.08))] : [...points];
    const dense = resample(path, this.rng.range(2.2, 3.4));
    if (dense.length < 2) return null;
    while (dense.length < 4) dense.push({ x: dense[dense.length - 1].x + 0.6, y: dense[dense.length - 1].y + 0.4 });

    this.pause(opts.pauseMs ?? 140);
    const shake = opts.shake ?? 1;
    const speed = this.rng.range(this.style.speed[0], this.style.speed[1]);
    const base = this.rng.range(this.style.pressure[0], this.style.pressure[1]);
    const phase = this.rng.range(0, Math.PI * 2);
    const freq = this.rng.range(0.006, 0.014);
    const total = pathLength(dense);
    const inputs: InkStroke['inputs']['inputs'] = [];
    let travelled = 0;
    for (let i = 0; i < dense.length; i++) {
      if (i > 0) travelled += dist(dense[i - 1], dense[i]);
      const u = total > 0 ? travelled / total : 0;
      const normal = normalAt(dense, i);
      const wob = Math.sin(phase + travelled * freq) * this.style.wobble * shake;
      const x = dense[i].x + normal.x * wob + this.rng.gauss() * this.style.jitter * shake;
      const y = dense[i].y + normal.y * wob + this.rng.gauss() * this.style.jitter * shake;
      const ramp = Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.18 + 0.15);
      const pressure = clamp(base * (0.75 + 0.25 * Math.sin(phase + travelled * 0.02)) * ramp + this.rng.gauss() * 0.02, 0.08, 1);
      if (i > 0) this.t += Math.max(this.style.sampleMs * 0.5, dist(dense[i - 1], dense[i]) / speed) * this.rng.range(0.85, 1.15);
      inputs.push({ x: round(x, 10), y: round(y, 10), timeMillis: Math.round(this.t), pressure: round(pressure, 100) });
    }
    const stroke: InkStroke = {
      id: `${this.idPrefix}${this.n++}`,
      inputs: { tool: InkToolType.STYLUS, inputs },
      brush: { stockBrush: StockBrush.BALLPOINT, color: this.style.color, size: this.style.brushSize },
    };
    this.strokes.push(stroke);
    return stroke;
  }
}

export function lerp(a: Offset, b: Offset, t: number): Offset {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function dist(a: Offset, b: Offset): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pathLength(points: Offset[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += dist(points[i - 1], points[i]);
  return l;
}

/** Re-sample a polyline at roughly equal spacing, keeping the original vertices' positions. */
export function resample(points: Offset[], spacing: number): Offset[] {
  if (points.length === 0) return [];
  const out: Offset[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const d = dist(a, b);
    const steps = Math.max(1, Math.ceil(d / spacing));
    for (let k = 1; k <= steps; k++) out.push(lerp(a, b, k / steps));
  }
  return out;
}

function normalAt(points: Offset[], i: number): Offset {
  const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: -dy / l, y: dx / l };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number, unit: number): number {
  return Math.round(v * unit) / unit;
}

/** Points along a circular/elliptical arc; angles in radians, clockwise in screen space when a1 > a0. */
export function arcPoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps = 48): Offset[] {
  const out: Offset[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

/** Quadratic Bézier sampled as a polyline. */
export function quadPoints(p0: Offset, c: Offset, p1: Offset, steps = 24): Offset[] {
  const out: Offset[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, mt = 1 - t;
    out.push({ x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x, y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y });
  }
  return out;
}
