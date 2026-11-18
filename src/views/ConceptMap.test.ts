// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ConceptMap } from './ConceptMap';
import { demoGraph } from '../kb/mapView';

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
