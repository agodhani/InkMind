import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { InkWriter } from './ink';
import { MAX_GAP_MS, alignStrokes, pointerSchedule } from './replay';

function twoStrokes() {
  const w = new InkWriter(new Rng(1), 'r', undefined, 1000);
  w.stroke([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  w.pause(5000);
  w.stroke([{ x: 0, y: 50 }, { x: 100, y: 50 }]);
  return w.strokes;
}

describe('pointerSchedule', () => {
  it('emits down/move…/up per stroke in non-decreasing time order', () => {
    const strokes = twoStrokes();
    const steps = pointerSchedule(strokes);
    expect(steps.filter((s) => s.type === 'pointerdown')).toHaveLength(2);
    expect(steps.filter((s) => s.type === 'pointerup')).toHaveLength(2);
    expect(steps[0].type).toBe('pointerdown');
    expect(steps.at(-1)?.type).toBe('pointerup');
    for (let i = 1; i < steps.length; i++) expect(steps[i].at).toBeGreaterThanOrEqual(steps[i - 1].at);
    const moves = steps.filter((s) => s.type === 'pointermove').length;
    expect(moves).toBe(strokes[0].inputs.inputs.length + strokes[1].inputs.inputs.length - 2);
  });

  it('caps the pen-up gap between strokes and scales everything by speed', () => {
    const strokes = twoStrokes();
    const s1 = pointerSchedule(strokes, 1);
    const s4 = pointerSchedule(strokes, 4);
    const firstUp = s1.find((s) => s.type === 'pointerup')!;
    const secondDown = s1.find((s) => s.type === 'pointerdown' && s.strokeIndex === 1)!;
    expect(secondDown.at - firstUp.at).toBeLessThanOrEqual(MAX_GAP_MS);
    expect(s4.at(-1)!.at).toBeCloseTo(s1.at(-1)!.at / 4, 3);
    expect(s1.every((s) => (s.type === 'pointerup' ? s.pressure === 0 : s.pressure > 0))).toBe(true);
  });

  it('skips empty strokes', () => {
    const [a] = twoStrokes();
    const empty = { ...a, id: 'e', inputs: { ...a.inputs, inputs: [] } };
    expect(pointerSchedule([empty, a]).filter((s) => s.type === 'pointerdown')).toHaveLength(1);
  });
});

describe('alignStrokes', () => {
  it('maps by order and skips strokes the canvas dropped', () => {
    const w = new InkWriter(new Rng(2), 'e');
    w.stroke([{ x: 0, y: 0 }, { x: 50, y: 0 }]);
    w.stroke([{ x: 0, y: 40 }, { x: 2, y: 41 }]); // tiny "dot" the canvas will treat as a tap
    w.stroke([{ x: 0, y: 80 }, { x: 50, y: 80 }]);
    const [a, dot, c] = w.strokes;
    const got = [{ ...a, id: 'stk-1' }, { ...c, id: 'stk-2' }];
    const map = alignStrokes(w.strokes, got);
    expect(map.get(a.id)).toBe('stk-1');
    expect(map.get(c.id)).toBe('stk-2');
    expect(map.has(dot.id)).toBe(false);
  });
});
