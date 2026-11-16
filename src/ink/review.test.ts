import { expect, it } from 'vitest';
import { analyseInk, figureFromGeometry } from './shapeHints';
import { circle, line, rect, arrowStroke, resetSynthetic } from '../__tests__/shapes';
import { word } from '../__tests__/complexScenes';
import { unionBounds, type InkStroke } from '../model/page';
import { getStrokeBoundingBox } from '../types/brush';

function analyse(parts: InkStroke[][]) {
  return analyseInk(parts.flat(), parts.map((ss, index) => ({ index, strokeIds: ss.map((s) => s.id), bbox: ss.map(getStrokeBoundingBox).reduce(unionBounds) })));
}

it('preserves dashed lifelines inside a sequence frame', () => {
  resetSynthetic();
  const ink = [rect(40, 40, 460, 440), ...[150, 350].flatMap((x) => Array.from({ length: 10 }, (_, i) => line(x, 120 + i * 28, x, 136 + i * 28))), arrowStroke(155, 180, 345, 180), arrowStroke(345, 260, 155, 260)];
  const fig = analyse([ink]).figures[0];
  expect(fig.kind).toBe('sequence');
  expect(fig.relations).toHaveLength(2);
});

it.each([60, 85])('preserves separately labelled concentric containers, inner radius %s', (r) => {
  resetSynthetic();
  const fig = analyse([[circle(200, 200, 100), circle(200, 200, r)], word('outer', 200, 108, 8), word('inner', 200, 200)]).figures[0];
  expect(fig.nodes.filter((n) => n.shape === 'circle' || n.shape === 'ellipse')).toHaveLength(2);
  expect(fig.nodes.some((n) => n.parent !== undefined)).toBe(true);
});

it('carries a separately grouped label from the inner accepting-state ring', () => {
  resetSynthetic();
  const fig = analyse([[circle(200, 200, 60), circle(200, 200, 50)], word('q1', 200, 200)]).figures[0];
  expect(fig.nodes).toHaveLength(1);
  expect(fig.nodes[0].labelGroup).toBe(1);
  expect(figureFromGeometry(fig, (i) => i === 1 ? 'q1' : undefined).nodes![0].label).toBe('q1');
});
