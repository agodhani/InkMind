import { describe, expect, it } from 'vitest';
import { applyViewportToContext, resetContextTransform } from './ViewportManager';

describe('applyViewportToContext', () => {
  it('composes with a preceding device-pixel-ratio scale instead of replacing it', () => {
    const calls: string[] = [];
    const ctx = {
      setTransform: (...a: number[]) => calls.push(`setTransform(${a.join(',')})`),
      transform: (...a: number[]) => calls.push(`transform(${a.join(',')})`),
      scale: (x: number, y: number) => calls.push(`scale(${x},${y})`),
    } as unknown as CanvasRenderingContext2D;
    resetContextTransform(ctx);
    ctx.scale(2, 2);
    applyViewportToContext(ctx, { zoom: 1.5, panX: 10, panY: 20 });
    expect(calls).toEqual(['setTransform(1,0,0,1,0,0)', 'scale(2,2)', 'transform(1.5,0,0,1.5,10,20)']);
  });
});
