import { expect, it } from 'vitest';
import { zoomAt } from './mapGestures';
it('keeps the pointer anchor fixed and clamps zoom', () => {
  expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 50 }, 2)).toEqual({ x: -100, y: -50, zoom: 2 });
  expect(zoomAt({ x: 3, y: 4, zoom: 1 }, { x: 3, y: 4 }, 0.01)).toEqual({ x: 3, y: 4, zoom: 0.25 });
  expect(zoomAt({ x: 0, y: 0, zoom: 4 }, { x: 1, y: 1 }, 2).zoom).toBe(4);
});
