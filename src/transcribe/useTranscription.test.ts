// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTranscription } from './useTranscription';
import { renderStrokesToPng } from './render';
import { OllamaTranscriber } from './ollama';
import { createPage } from '../model/page';
import { line } from '../__tests__/shapes';

vi.mock('./render', () => ({ MODEL_RENDER: { ink: '#000000', sizeMultiplier: 0.45 }, renderStrokesToPng: vi.fn(() => null) }));
afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('app render budget', () => {
  it.each(['qwen2.5vl:3b', 'qwen2.5vl:7b'])('uses the selected transcriber budget for %s', async (model) => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const page = { ...createPage(), strokes: [line(0, 0, 2000, 1000)] };
    const transcriber = new OllamaTranscriber({ model });
    let api: ReturnType<typeof useTranscription>;
    function Harness() {
      const current = useTranscription({ page, transcriber, profile: { glossary: [], habits: [], examples: [] }, enabled: true, onBlocks: vi.fn() });
      useEffect(() => { api = current; }, [current]);
      return null;
    }
    const root = createRoot(document.createElement('div'));
    act(() => root.render(createElement(Harness)));
    act(() => api.markStrokesDirty(page.strokes));
    await act(() => api.flushNow());
    expect(renderStrokesToPng).toHaveBeenCalledWith(page.strokes, expect.any(Object), { ink: '#000000', sizeMultiplier: 0.45, maxEdge: transcriber.maxImageEdge });
    act(() => root.unmount());
  });
});
