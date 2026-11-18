// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ConceptMap } from './ConceptMap';
import { demoGraph, layoutGraph } from '../kb/mapView';
import { fitCamera } from './mapGestures';

it('clears removed model focus and shows the remaining map after dismissal', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const host = document.createElement('div'), root = createRoot(host), onFocus = vi.fn();
  const props = { pages: [], focused: 'demo-0', onFocus, decide: vi.fn(), review: vi.fn(), onSource: vi.fn() };
  const graph = demoGraph(2); graph.concepts[0].status = 'proposed'; graph.concepts[0].origin = 'model';
  try {
    await act(async () => root.render(createElement(ConceptMap, { ...props, graph })));
    const remaining = { concepts: [graph.concepts[1]], edges: [] };
    await act(async () => root.render(createElement(ConceptMap, { ...props, graph: remaining })));
    expect(onFocus).toHaveBeenCalledWith(null);
    expect(host.querySelectorAll('.kb-node')).toHaveLength(1);
    expect(host.querySelector('.kb-detail')).toBeNull();
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it('fits the graph on load and resize, and restores that fit after zooming', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let resize = (_width: number, _height: number) => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: (entries: { contentRect: { width: number; height: number } }[]) => void) {
      resize = (width, height) => callback([{ contentRect: { width, height } }]);
    }
    observe() {} disconnect() {}
  });
  const host = document.createElement('div'), root = createRoot(host), graph = demoGraph(191);
  const transform = () => host.querySelector('.kb-map-svg > g[transform]')?.getAttribute('transform');
  const expected = (width: number, height: number) => {
    const camera = fitCamera(Object.values(layoutGraph(graph, { width: width - 80, height: height - 100, seed: 17 })), { width, height });
    return `translate(${camera.x},${camera.y}) scale(${camera.zoom})`;
  };
  try {
    await act(async () => root.render(createElement(ConceptMap, { graph, pages: [], focused: null, onFocus: vi.fn(), decide: vi.fn(), review: vi.fn(), onSource: vi.fn() })));
    expect(transform()).toBe(expected(800, 500));
    for (const size of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
      await act(async () => resize(size.width, size.height));
      const fitted = expected(size.width, size.height);
      expect(transform()).toBe(fitted);
      await act(async () => (host.querySelector('[aria-label="Zoom in map"]') as HTMLButtonElement).click());
      expect(transform()).not.toBe(fitted);
      await act(async () => (host.querySelector('[aria-label="Fit to screen"]') as HTMLButtonElement).click());
      expect(transform()).toBe(fitted);
    }
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
