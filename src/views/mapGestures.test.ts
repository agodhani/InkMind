import { expect, it } from 'vitest';
import { fitCamera, placeLabels, visibleLabels, zoomAt } from './mapGestures';
it('keeps the pointer anchor fixed and clamps zoom', () => {
  expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 50 }, 2)).toEqual({ x: -100, y: -50, zoom: 2 });
  expect(zoomAt({ x: 3, y: 4, zoom: 1 }, { x: 3, y: 4 }, 0.01)).toEqual({ x: 3, y: 4, zoom: 0.05 });
  expect(zoomAt({ x: 0, y: 0, zoom: 4 }, { x: 1, y: 1 }, 2).zoom).toBe(4);
});
it('prioritizes focus and hover/search selections, then neighbours, then degree', () => {
  const nodes = [
    { id: 'degree', label: 'High degree', x: 1200, y: 200, degree: 50 },
    { id: 'neighbour', label: 'Neighbour', x: 900, y: 200, degree: 2 },
    { id: 'hovered', label: 'Hovered', x: 600, y: 200, degree: 0 },
    { id: 'focused', label: 'Focused', x: 300, y: 200, degree: 0 },
  ];
  const labels = placeLabels(nodes, { x: 0, y: 0, zoom: 0.5 }, { width: 900, height: 500 }, ['focused', 'hovered'], ['neighbour']);
  expect([...labels.keys()]).toEqual(['focused', 'hovered', 'neighbour', 'degree']);
});
it('reveals low-degree labels and restores truncated text on zoom or focus', () => {
  const node = { id: 'a', label: 'A long concept label that needs truncation', x: 200, y: 200, degree: 1 };
  const size = { width: 1000, height: 600 }, camera = { x: 0, y: 0, zoom: 0.5 };
  expect(placeLabels([node], camera, size).size).toBe(0);
  expect(placeLabels([node], camera, size, ['a']).get('a')?.text).toBe(node.label);
  expect(placeLabels([{ ...node, degree: 2 }], camera, size).get('a')?.text).toBe(`${node.label.slice(0, 23)}…`);
  expect(placeLabels([node], { ...camera, zoom: 1.5 }, size).get('a')?.text).toBe(node.label);
  expect(placeLabels([], camera, size).size).toBe(0);
});
it('fits empty and single-node maps without invalid camera coordinates', () => {
  const size = { width: 768, height: 1024 };
  expect(fitCamera([], size)).toEqual({ x: 384, y: 512, zoom: 1 });
  const camera = fitCamera([{ x: -100, y: 300 }], size);
  expect(-100 * camera.zoom + camera.x).toBe(384);
  expect(300 * camera.zoom + camera.y).toBe(512);
});
it('labels high-degree nodes without overlapping and preserves required labels', () => {
  const nodes = [{ id: 'a', label: 'Alpha', x: 100, y: 100, degree: 1 }, { id: 'b', label: 'Beta', x: 100, y: 100, degree: 4 }];
  const camera = { x: 0, y: 0, zoom: 1 }, size = { width: 500, height: 500 };
  expect([...visibleLabels(nodes, camera, size)][0]).toBe('b');
  expect([...visibleLabels(nodes, camera, size, ['a'])][0]).toBe('a');
  expect([...visibleLabels([], camera, size)]).toEqual([]);
  expect([...visibleLabels([{ ...nodes[0], x: -100 }], camera, size)]).toEqual([]);
});
