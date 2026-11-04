import type { BoundingBox } from '../types';
import type { InkStroke } from '../model/page';
import { renderStrokes } from '../ink/StrokeRenderer';

export const RENDER_PAD = 24;
// Dense pages need resolution: at ~1600 px a full page lost half its words (eval p2 WER 0.9 → 0.35 at ~2400 px).
export const MAX_RENDER_EDGE = 2400;

export interface RenderedRegion {
  dataUrl: string;
  bounds: BoundingBox;
  size: { width: number; height: number };
  scale: number;
}

/** Minimal canvas surface so the same renderer runs in the browser and in Node (eval harness). */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: '2d'): CanvasRenderingContext2D | null;
  toDataURL(type: 'image/png'): string;
}
export type CanvasFactory = (width: number, height: number) => CanvasLike;

const domCanvas: CanvasFactory = (width, height) => {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
};

export interface RenderOptions {
  ink?: string;
  /** Scale stroke widths (e.g. thin them for the model). */
  sizeMultiplier?: number;
  maxEdge?: number;
  createCanvas?: CanvasFactory;
}

/**
 * Rendering used for transcription requests: black ink and a thin, even nib. Vision models
 * read thin strokes better — bold pressure-rendered ink merges adjacent letters.
 */
export const MODEL_RENDER: Pick<RenderOptions, 'ink' | 'sizeMultiplier'> = { ink: '#000000', sizeMultiplier: 0.45 };

/** Render strokes on white to a PNG data URL, 2x where possible for legibility. */
export function renderStrokesToPng(strokes: InkStroke[], bounds: BoundingBox, options: RenderOptions = {}): RenderedRegion | null {
  const padded: BoundingBox = {
    left: bounds.left - RENDER_PAD,
    top: bounds.top - RENDER_PAD,
    right: bounds.right + RENDER_PAD,
    bottom: bounds.bottom + RENDER_PAD,
  };
  const width = Math.max(1, Math.ceil(padded.right - padded.left));
  const height = Math.max(1, Math.ceil(padded.bottom - padded.top));
  const maxEdge = options.maxEdge ?? MAX_RENDER_EDGE;
  const scale = Math.min(2, maxEdge / Math.max(width, height));

  const canvas = (options.createCanvas ?? domCanvas)(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-padded.left, -padded.top);
  renderStrokes(ctx, strokes, { colorOverride: options.ink, sizeMultiplier: options.sizeMultiplier });

  return { dataUrl: canvas.toDataURL('image/png'), bounds: padded, size: { width: canvas.width, height: canvas.height }, scale };
}
