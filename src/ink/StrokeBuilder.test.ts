import { describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { StrokeBuilder, createDefaultBrush } from './StrokeBuilder';
import { renderStroke } from './StrokeRenderer';

describe('dot strokes', () => {
  it('finishes one input as a dot, but never finishes an empty or cancelled gesture', () => {
    const builder = new StrokeBuilder({ brush: createDefaultBrush() });
    expect(builder.finish()).toBeNull();
    builder.start(10, 20, 0.6, 'pen');
    builder.addPoint(10, 20, 0.6);
    builder.addPoint(10.2, 20.1, 0.6);
    expect(builder.finish()!.inputs.inputs).toEqual([expect.objectContaining({ x: 10, y: 20, pressure: 0.6 })]);
    builder.cancel();
    expect(builder.finish()).toBeNull();
  });

  it.each([undefined, 0.5])('renders a saved one-point dot in its brush color (pressure %s)', pressure => {
    const builder = new StrokeBuilder({ brush: createDefaultBrush(0xffff0000, 10) });
    builder.start(10, 10, pressure, 'pen');
    const canvas = createCanvas(20, 20), ctx = canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    renderStroke(ctx as unknown as CanvasRenderingContext2D, builder.finish()!);
    expect([...ctx.getImageData(10, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
  });
});
