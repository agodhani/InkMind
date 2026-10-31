import type { InkStroke } from '../model/page';
import { InkToolType, StockBrush } from '../types/brush';

let counter = 0;
/** Straight-line stroke from (x0,y0) to (x1,y1), written at time t. */
export function stroke(x0: number, y0: number, x1: number, y1: number, t = 0, id?: string): InkStroke {
  const n = 6;
  const inputs = Array.from({ length: n }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / (n - 1),
    y: y0 + ((y1 - y0) * i) / (n - 1),
    timeMillis: t + i * 10,
  }));
  return {
    id: id ?? `s${counter++}`,
    inputs: { tool: InkToolType.STYLUS, inputs },
    brush: { stockBrush: StockBrush.BALLPOINT, color: 0xff000000, size: 2 },
  };
}
