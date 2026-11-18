import { expect, it } from 'vitest';
import { visibleLabels, zoomAt } from './mapGestures';
it('keeps the pointer anchor fixed and clamps zoom', () => {
  expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 50 }, 2)).toEqual({ x: -100, y: -50, zoom: 2 });
  expect(zoomAt({ x: 3, y: 4, zoom: 1 }, { x: 3, y: 4 }, 0.01)).toEqual({ x: 3, y: 4, zoom: 0.25 });
  expect(zoomAt({ x: 0, y: 0, zoom: 4 }, { x: 1, y: 1 }, 2).zoom).toBe(4);
});
it('labels high-degree nodes without overlapping and preserves required labels', () => {
  const nodes = [{ id: 'a', label: 'Alpha', x: 100, y: 100, degree: 1 }, { id: 'b', label: 'Beta', x: 100, y: 100, degree: 4 }];
  const camera = { x: 0, y: 0, zoom: 1 }, size = { width: 500, height: 500 };
  expect([...visibleLabels(nodes, camera, size)]).toEqual(['b']);
  expect([...visibleLabels(nodes, camera, size, ['a'])]).toEqual(['a']);
  expect([...visibleLabels([], camera, size)]).toEqual([]);
  expect([...visibleLabels([{ ...nodes[0], x: -100 }], camera, size)]).toEqual([]);
});
