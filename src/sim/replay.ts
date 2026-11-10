// Replays synthetic strokes onto the real InkCanvas through DOM pointer events so the live
// pipeline (StrokeBuilder → onStrokeComplete → idle transcription) runs exactly as for a human.
import type { InkStroke } from '../model/page';
import type { Offset } from '../types';

export interface PointerStep {
  type: 'pointerdown' | 'pointermove' | 'pointerup';
  /** Point in page/canvas coordinates. */
  point: Offset;
  pressure: number;
  /** Milliseconds since the start of the replay (already divided by speed). */
  at: number;
  strokeIndex: number;
}

/** Longest pen-up gap kept between strokes (before dividing by speed). */
export const MAX_GAP_MS = 900;

/** Flattens strokes into a timed pointer event schedule. Pure; tested. */
export function pointerSchedule(strokes: InkStroke[], speed = 1): PointerStep[] {
  const steps: PointerStep[] = [];
  let clock = 0;
  let prevEnd: number | null = null;
  strokes.forEach((stroke, strokeIndex) => {
    const pts = stroke.inputs.inputs;
    if (pts.length === 0) return;
    const t0 = pts[0].timeMillis;
    if (prevEnd !== null) clock += Math.min(MAX_GAP_MS, Math.max(16, t0 - prevEnd)) / speed;
    const start = clock;
    pts.forEach((p, i) => {
      steps.push({
        type: i === 0 ? 'pointerdown' : 'pointermove',
        point: { x: p.x, y: p.y },
        pressure: p.pressure ?? 0.5,
        at: start + (p.timeMillis - t0) / speed,
        strokeIndex,
      });
    });
    const last = pts[pts.length - 1];
    const end = start + (last.timeMillis - t0) / speed;
    steps.push({ type: 'pointerup', point: { x: last.x, y: last.y }, pressure: 0, at: end + 8 / speed, strokeIndex });
    clock = end + 8 / speed;
    prevEnd = last.timeMillis;
  });
  return steps;
}

export interface ReplayOptions {
  target: Element;
  strokes: InkStroke[];
  speed: number;
  /** Converts page coordinates to client (screen) coordinates. */
  toClient: (p: Offset) => Offset;
  signal?: AbortSignal;
  onProgress?: (strokesDone: number, total: number) => void;
}

const POINTER_ID = 7331;

function dispatch(target: Element, step: PointerStep, toClient: (p: Offset) => Offset) {
  const c = toClient(step.point);
  target.dispatchEvent(
    new PointerEvent(step.type, {
      pointerId: POINTER_ID,
      pointerType: 'pen',
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      clientX: c.x,
      clientY: c.y,
      pressure: step.type === 'pointerup' ? 0 : step.pressure,
      button: step.type === 'pointermove' ? -1 : 0,
      buttons: step.type === 'pointerup' ? 0 : 1,
    }),
  );
}

/** Replays strokes in real time (scaled by `speed`). Resolves with the number of strokes drawn. */
export function replayStrokes(opts: ReplayOptions): Promise<number> {
  const steps = pointerSchedule(opts.strokes, opts.speed);
  const total = opts.strokes.length;
  return new Promise((resolve) => {
    if (steps.length === 0) return resolve(0);
    const start = performance.now();
    let i = 0;
    let done = 0;
    const finish = () => {
      // Make sure the pen is lifted if we were interrupted mid-stroke.
      if (i > 0 && i < steps.length && steps[i - 1].type !== 'pointerup') {
        dispatch(opts.target, { ...steps[i - 1], type: 'pointerup' }, opts.toClient);
      }
      resolve(done);
    };
    const tick = () => {
      if (opts.signal?.aborted) return finish();
      const now = performance.now() - start;
      while (i < steps.length && steps[i].at <= now) {
        const step = steps[i++];
        dispatch(opts.target, step, opts.toClient);
        if (step.type === 'pointerup') {
          done++;
          opts.onProgress?.(done, total);
        }
      }
      if (i >= steps.length) return finish();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Maps scene stroke ids to the ids the page assigned. Strokes arrive in order, but InkCanvas may drop
 * some (e.g. dots treated as taps), so match consecutively by the first point instead of by index.
 */
export function alignStrokes(expected: InkStroke[], got: InkStroke[], tolerance = 6): Map<string, string> {
  const map = new Map<string, string>();
  let k = 0;
  for (const s of expected) {
    const g = got[k];
    const a = s.inputs.inputs[0];
    const b = g?.inputs.inputs[0];
    if (!a || !b) continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) <= tolerance) {
      map.set(s.id, g.id);
      k++;
    }
  }
  return map;
}
