import { expect, it } from 'vitest';
import { analyseInk, figureFromGeometry } from './shapeHints';
import { line, rect, arrowStroke, resetSynthetic } from '../__tests__/shapes';
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
