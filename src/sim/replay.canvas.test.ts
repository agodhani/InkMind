// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InkStroke, Page } from '../model/page';
import { InkCanvas } from '../ink/InkCanvas';
import { DEFAULT_VIEWPORT, type Viewport } from '../ink/ViewportManager';
import { fromPoints } from '../__tests__/shapes';
import { buildScene } from './scenes';
import { alignStrokes, replayStrokes } from './replay';
import SimulatorPanel from './SimulatorPanel';

vi.mock('../transcribe/render', () => ({ renderStrokesToPng: () => null }));

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly pressure: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'pen';
    this.pressure = init.pressure ?? 0.5;
  }
}

let container: HTMLDivElement, root: Root;
let captured: InkStroke[];

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  captured = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderCanvas() {
  function Harness() {
    const [strokes, setStrokes] = useState<InkStroke[]>([]);
    return createElement(InkCanvas, { strokes, tool: 'pen', viewport: { panX: 0, panY: 0, zoom: 0.74 },
      onStrokeComplete: (stroke: InkStroke) => { captured.push(stroke); setStrokes(current => [...current, stroke]); },
      onStrokesErased: () => {}, onTapStroke: () => {} });
  }
  act(() => root.render(createElement(Harness)));
  return container.querySelector('.ink-canvas')!;
}

describe('pointer replay through the real pen handlers', () => {
  it.each([
    ['timeline', 2, 1], ['timeline', 1, 10], ['timeline', 5, 40], ['sequence-diagram', 2, 40], ['venn', 2, 40],
  ] as const)('captures every %s seed %s stroke at %sx, even with multiple gestures in one frame', async (kind, seed, speed) => {
    const strokes = buildScene(kind, seed, 'normal').strokes;
    const target = renderCanvas();
    await act(async () => {
      const replay = replayStrokes({ target, strokes, speed, toClient: p => ({ x: p.x * 0.74, y: p.y * 0.74 }) });
      await vi.runAllTimersAsync();
      expect(await replay).toBe(strokes.length);
    });
    expect(captured).toHaveLength(strokes.length);
    expect(alignStrokes(strokes, captured).size).toBe(strokes.length);
    if (kind === 'timeline' && seed === 2) expect(captured).toHaveLength(49);
  });

  it('captures single-point, zero-length, subpixel and pointer-up-only pen marks', async () => {
    const target = renderCanvas();
    const strokes = [fromPoints([{ x: 20, y: 20 }]), fromPoints([{ x: 40, y: 20 }, { x: 40, y: 20 }]),
      fromPoints([{ x: 60, y: 20 }, { x: 60.2, y: 20.1 }])];
    await act(async () => {
      const replay = replayStrokes({ target, strokes, speed: 40, toClient: p => ({ x: p.x * 0.74, y: p.y * 0.74 }) });
      await vi.runAllTimersAsync();
      await replay;
    });
    expect(captured).toHaveLength(3);
    act(() => {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'pen', clientX: 10, clientY: 50 }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'pen', clientX: 40, clientY: 50, pressure: 0 }));
    });
    expect(captured).toHaveLength(4);
    expect(captured[3].inputs.inputs.at(-1)!.x).toBeCloseTo(40 / 0.74);
  });

  it('keeps mouse click selection separate from pen dots', () => {
    const tap = vi.fn(), complete = vi.fn();
    act(() => root.render(createElement(InkCanvas, { strokes: [], tool: 'pen', onStrokeComplete: complete, onStrokesErased: () => {}, onTapStroke: tap })));
    const target = container.querySelector('.ink-canvas')!;
    for (const pointerType of ['mouse', 'pen']) act(() => {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType, clientX: 20, clientY: 20 }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType, clientX: 20, clientY: 20, pressure: 0 }));
    });
    expect(tap).toHaveBeenCalledExactlyOnceWith(null);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('shows actual captured counts, not dispatched pointerups (drop strokes=%s)', async drop => {
    function Harness() {
      const [page, setPage] = useState<Page>({ id: 'test', title: '', strokes: [], blocks: [], createdAt: 0, updatedAt: 0 });
      const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
      return createElement('div', null,
        createElement(InkCanvas, { strokes: page.strokes, tool: 'pen', viewport, onStrokeComplete: stroke => {
          const index = captured.length;
          captured.push(stroke);
          if (!drop || index !== 17 && index !== 30) setPage(current => ({ ...current, strokes: [...current.strokes, stroke] }));
        }, onStrokesErased: () => {} }),
        createElement(SimulatorPanel, { page, viewport, onViewportChange: setViewport, onBeforeDraw: () => {}, onClearPage: () => {},
          onInjectStrokes: () => {}, onSetBlocks: () => {}, onTranscribeNow: () => {} }));
    }
    act(() => root.render(createElement(Harness)));
    const select = container.querySelector('select')!;
    const seed = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    act(() => {
      select.value = 'timeline';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(seed, '2');
      seed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll('button')].find(button => button.textContent === 'Draw')!.click();
      await vi.runAllTimersAsync();
    });
    expect(container.querySelector('.progress')!.textContent).toBe(`${drop ? 47 : 49}/49 strokes`);
    expect(container.textContent!.includes('stroke(s) were not captured')).toBe(drop);
    if (drop) expect(container.textContent).toContain('2 stroke(s) were not captured');
  });
});
