import { describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { MAX_RENDER_EDGE, renderStrokesToPng, type CanvasLike } from './render';
import { OllamaTranscriber } from './ollama';
import { rawToDigitalBlock } from './regions';
import { line } from '../__tests__/shapes';

const canvas = (width: number, height: number) => createCanvas(width, height) as unknown as CanvasLike;

describe('model-specific rendering', () => {
  it('fits large regions to the compact budget and keeps page-space coordinates', () => {
    const transcriber = new OllamaTranscriber();
    const strokes = [line(0, 0, 2000, 1000)];
    const rendered = renderStrokesToPng(strokes, { left: 0, top: 0, right: 2000, bottom: 1000 }, { createCanvas: canvas, maxEdge: transcriber.maxImageEdge })!;
    expect(Math.max(rendered.size.width, rendered.size.height)).toBe(transcriber.maxImageEdge);
    expect(rendered.size.width / rendered.size.height).toBeCloseTo(2048 / 1048, 2);
    const block = rawToDigitalBlock({ kind: 'paragraph', text: 'read', bbox: { left: 0, top: 0, right: rendered.size.width, bottom: rendered.size.height }, groupIndices: [], confidence: 1 }, [], rendered.bounds, rendered.size, strokes);
    expect(block.bbox).toEqual(rendered.bounds);
  });
  it('keeps the existing full-model render budget and avoids enlarging small crops beyond 2x', () => {
    const full = new OllamaTranscriber({ model: 'qwen2.5vl:7b' });
    const large = renderStrokesToPng([], { left: 0, top: 0, right: 3000, bottom: 1000 }, { createCanvas: canvas, maxEdge: full.maxImageEdge })!;
    expect(large.size.width).toBe(MAX_RENDER_EDGE);
    const crop = renderStrokesToPng([], { left: 0, top: 0, right: 100, bottom: 80 }, { createCanvas: canvas, maxEdge: new OllamaTranscriber().maxImageEdge })!;
    expect(crop.scale).toBe(2);
    expect(renderStrokesToPng([], { left: 0, top: 0, right: 10, bottom: 10 }, { createCanvas: (w, h) => ({ width: w, height: h, getContext: () => null, toDataURL: () => '' }) })).toBeNull();
  });
});
