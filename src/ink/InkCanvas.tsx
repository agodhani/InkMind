import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoundingBox } from '../types';
import type { InkStroke } from '../model/page';
import { newId } from '../model/page';
import { StrokeBuilder, createDefaultBrush, hexToArgb } from './StrokeBuilder';
import { renderStroke, renderStrokes, isPointNearStroke } from './StrokeRenderer';
import type { Viewport } from './ViewportManager';
import { DEFAULT_VIEWPORT, ZOOM_SENSITIVITY, applyViewportToContext, panViewport, resetContextTransform, screenToCanvas, zoomViewport } from './ViewportManager';

export type InkTool = 'pen' | 'eraser' | 'pan';

export interface InkCanvasProps {
  strokes: InkStroke[];
  tool: InkTool;
  brushColor?: string;
  brushSize?: number;
  /** Strokes to highlight (e.g. source of the selected digital block). */
  highlightedStrokeIds?: Set<string>;
  /** Boxes to draw faintly (block bounds), for debugging/linking. */
  outlines?: { bbox: BoundingBox; active?: boolean }[];
  onStrokeComplete: (stroke: InkStroke) => void;
  onStrokesErased: (strokeIds: string[]) => void;
  onTapStroke?: (strokeId: string | null) => void;
  viewport?: Viewport;
  onViewportChange?: (v: Viewport) => void;
  /** When true, touch (finger) input pans instead of drawing; pen always draws. */
  fingerPans?: boolean;
}

const ERASER_RADIUS = 14;

export function InkCanvas({
  strokes,
  tool,
  brushColor = '#1b1b1f',
  brushSize = 2.5,
  highlightedStrokeIds,
  outlines,
  onStrokeComplete,
  onStrokesErased,
  onTapStroke,
  viewport: controlledViewport,
  onViewportChange,
  fingerPans = true,
}: InkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [internalViewport, setInternalViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const viewport = controlledViewport ?? internalViewport;
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const builder = useRef<StrokeBuilder>(new StrokeBuilder({ brush: createDefaultBrush(hexToArgb(brushColor), brushSize) }));
  const activePointer = useRef<number | null>(null);
  const activeMode = useRef<'draw' | 'erase' | 'pan' | null>(null);
  const lastPan = useRef<{ x: number; y: number } | null>(null);
  const downInfo = useRef<{ x: number; y: number; t: number } | null>(null);
  const erasedThisGesture = useRef<Set<string>>(new Set());
  const pinch = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);
  const touches = useRef<Map<number, { x: number; y: number }>>(new Map());

  const setViewport = useCallback(
    (v: Viewport) => {
      if (!controlledViewport) setInternalViewport(v);
      onViewportChange?.(v);
    },
    [controlledViewport, onViewportChange],
  );

  useEffect(() => {
    builder.current.setBrush(createDefaultBrush(hexToArgb(brushColor), brushSize));
  }, [brushColor, brushSize]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const prepare = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return null;
      if (canvas.width !== Math.round(size.width * dpr) || canvas.height !== Math.round(size.height * dpr)) {
        canvas.width = Math.round(size.width * dpr);
        canvas.height = Math.round(size.height * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      resetContextTransform(ctx);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      applyViewportToContext(ctx, viewportRef.current);
      return ctx;
    },
    [size, dpr],
  );

  // Main canvas: all committed strokes + outlines + highlights.
  useEffect(() => {
    const ctx = prepare(mainRef.current);
    if (!ctx) return;
    drawGrid(ctx, viewport, size);
    if (outlines) {
      for (const o of outlines) {
        ctx.save();
        ctx.strokeStyle = o.active ? 'rgba(59,130,246,0.9)' : 'rgba(59,130,246,0.18)';
        ctx.lineWidth = (o.active ? 1.5 : 1) / viewport.zoom;
        ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
        ctx.strokeRect(o.bbox.left, o.bbox.top, o.bbox.right - o.bbox.left, o.bbox.bottom - o.bbox.top);
        ctx.restore();
      }
    }
    renderStrokes(ctx, strokes);
    if (highlightedStrokeIds && highlightedStrokeIds.size) {
      const hl = strokes.filter((s) => highlightedStrokeIds.has(s.id));
      renderStrokes(ctx, hl, { colorOverride: 'rgba(59,130,246,0.45)', sizeMultiplier: 3 });
      renderStrokes(ctx, hl);
    }
  }, [strokes, highlightedStrokeIds, outlines, viewport, size, prepare]);

  const drawOverlay = useCallback(() => {
    const ctx = prepare(overlayRef.current);
    if (!ctx) return;
    const current = builder.current.getCurrentStroke();
    if (current) renderStroke(ctx, current);
  }, [prepare]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, viewport]);

  const toCanvasPoint = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return screenToCanvas(viewportRef.current, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const eraseAt = useCallback(
    (pt: { x: number; y: number }) => {
      const radius = ERASER_RADIUS / viewportRef.current.zoom;
      const hit = strokes.filter((s) => !erasedThisGesture.current.has(s.id) && isPointNearStroke(pt, s, radius)).map((s) => s.id);
      if (hit.length) {
        hit.forEach((id) => erasedThisGesture.current.add(id));
        onStrokesErased(hit);
      }
    },
    [strokes, onStrokesErased],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        // Second finger: switch to pinch, cancel any stroke in progress.
        builder.current.cancel();
        activeMode.current = null;
        activePointer.current = null;
        drawOverlay();
        const [a, b] = [...touches.current.values()];
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        return;
      }
    }
    if (activePointer.current !== null) return;
    activePointer.current = e.pointerId;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events (dev simulator) have no active pointer to capture.
    }
    const pt = toCanvasPoint(e);
    downInfo.current = { x: e.clientX, y: e.clientY, t: performance.now() };

    const wantsPan = tool === 'pan' || (fingerPans && e.pointerType === 'touch') || e.button === 1;
    if (wantsPan) {
      activeMode.current = 'pan';
      lastPan.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (tool === 'eraser' || e.button === 5 || (e.pointerType === 'pen' && e.buttons === 32)) {
      activeMode.current = 'erase';
      erasedThisGesture.current = new Set();
      eraseAt(pt);
      return;
    }
    activeMode.current = 'draw';
    builder.current.start(pt.x, pt.y, e.pressure, e.pointerType);
    drawOverlay();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const rect = containerRef.current!.getBoundingClientRect();
        let v = viewportRef.current;
        const factor = dist / Math.max(1, pinch.current.dist);
        v = zoomViewport(v, factor - 1, center.x - rect.left, center.y - rect.top);
        v = panViewport(v, center.x - pinch.current.center.x, center.y - pinch.current.center.y);
        pinch.current = { dist, center };
        setViewport(v);
        return;
      }
    }
    if (activePointer.current !== e.pointerId) return;
    const pt = toCanvasPoint(e);
    switch (activeMode.current) {
      case 'draw': {
        const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
        for (const ce of events.length ? events : [e.nativeEvent]) {
          const p = toCanvasPoint(ce);
          builder.current.addPoint(p.x, p.y, ce.pressure);
        }
        drawOverlay();
        break;
      }
      case 'erase':
        eraseAt(pt);
        break;
      case 'pan': {
        if (lastPan.current) {
          setViewport(panViewport(viewportRef.current, e.clientX - lastPan.current.x, e.clientY - lastPan.current.y));
          lastPan.current = { x: e.clientX, y: e.clientY };
        }
        break;
      }
    }
  };

  const finishPointer = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (touches.current.size < 2) pinch.current = null;
    }
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    const mode = activeMode.current;
    activeMode.current = null;
    if (mode === 'draw') {
      const stroke = builder.current.finish();
      builder.current.cancel();
      drawOverlay();
      const d = downInfo.current;
      const moved = d ? Math.hypot(e.clientX - d.x, e.clientY - d.y) : 0;
      if (stroke && !(moved < 4 && d && performance.now() - d.t < 250 && stroke.inputs.inputs.length < 4)) {
        onStrokeComplete({ ...stroke, id: newId('stk') });
      } else if (onTapStroke) {
        const pt = toCanvasPoint(e);
        const hit = [...strokes].reverse().find((s) => isPointNearStroke(pt, s, 8 / viewportRef.current.zoom));
        onTapStroke(hit?.id ?? null);
      }
    }
    lastPan.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const focus = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (e.ctrlKey || e.metaKey) {
      setViewport(zoomViewport(viewportRef.current, -e.deltaY * ZOOM_SENSITIVITY, focus.x, focus.y));
    } else {
      setViewport(panViewport(viewportRef.current, -e.deltaX, -e.deltaY));
    }
  };

  return (
    <div
      ref={containerRef}
      className={`ink-canvas tool-${tool}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onPointerLeave={(e) => {
        if (activePointer.current === e.pointerId) finishPointer(e);
      }}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={mainRef} style={{ width: size.width, height: size.height }} />
      <canvas ref={overlayRef} style={{ width: size.width, height: size.height }} />
    </div>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, viewport: Viewport, size: { width: number; height: number }) {
  const step = 32;
  const topLeft = screenToCanvas(viewport, { x: 0, y: 0 });
  const bottomRight = screenToCanvas(viewport, { x: size.width, y: size.height });
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  const r = 1 / viewport.zoom;
  for (let x = Math.floor(topLeft.x / step) * step; x < bottomRight.x; x += step) {
    for (let y = Math.floor(topLeft.y / step) * step; y < bottomRight.y; y += step) {
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
  }
  ctx.restore();
}
