import { expect, it } from 'vitest';
import { blockInkSvg } from './inkSvg';
import { largeDemoPages } from '../sim/kbDemo';
import { stroke } from '../__tests__/helpers';

it('renders dots, pressure, color and opacity deterministically without a canvas', () => {
  const page = largeDemoPages(1)[0], ink = stroke(10, 20, 30, 40, 0, 'ink');
  ink.brush.color = 0x80ff0000;
  ink.inputs.inputs = ink.inputs.inputs.slice(0, 2).map((p, i) => ({ ...p, pressure: i ? 0.8 : 0.2 }));
  const dot = { ...stroke(60, 70, 60, 70, 0, 'dot'), inputs: { ...ink.inputs, inputs: [{ x: 60, y: 70, timeMillis: 0 }] } };
  page.strokes = [ink, dot]; const block = { ...page.blocks[0], strokeIds: ['ink', 'dot'] };
  const svg = blockInkSvg(page, block)!;
  expect(svg).toContain('stroke="rgb(255,0,0)"'); expect(svg).toContain('opacity="0.5019607843137255"');
  expect(svg).toContain('cx="60" cy="70" r="1"'); expect(svg).toContain('stroke-width="1"');
  expect(blockInkSvg(page, block)).toBe(svg);
});
it('does not produce a blank or malformed image when source ink is absent or invalid', () => {
  const page = largeDemoPages(1)[0], block = { ...page.blocks[0], strokeIds: ['missing'] };
  expect(blockInkSvg(page, block)).toBeNull();
  const ink = stroke(0, 0, 1, 1, 0, 'missing'); ink.inputs.inputs[0].x = NaN; page.strokes = [ink];
  expect(blockInkSvg(page, block)).toBeNull();
  ink.inputs.inputs = [];
  expect(blockInkSvg(page, block)).toBeNull();
});
