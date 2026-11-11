import { beforeEach, describe, expect, it } from 'vitest';
import { analyseInk, chainSegments, classifyStroke, looksLikeCube } from './shapeHints';
import { buildStrokeGroups } from '../transcribe/regions';
import { arrowStroke, arrowTwoStrokes, axes, circle, cube, curve, ellipse, line, polygon, rect, rectLines, resetSynthetic, textLine } from '../__tests__/shapes';
import type { InkStroke } from '../model/page';

beforeEach(() => resetSynthetic());

const analyse = (strokes: InkStroke[]) => analyseInk(strokes, buildStrokeGroups(strokes));

describe('classifyStroke', () => {
  it('recognises circles and ellipses by roundness', () => {
    expect(classifyStroke(circle(100, 100, 50)).kind).toBe('circle');
    expect(classifyStroke(circle(100, 100, 50, 0, 5)).kind).toBe('circle'); // wobbly
    expect(classifyStroke(ellipse(100, 100, 80, 35)).kind).toBe('ellipse');
  });
  it('recognises rectangles, squares, triangles and diamonds by corners', () => {
    expect(classifyStroke(rect(0, 0, 160, 90)).kind).toBe('rectangle');
    expect(classifyStroke(rect(0, 0, 100, 100)).kind).toBe('square');
    expect(classifyStroke(rect(0, 0, 100, 100, 0, 4)).kind).toBe('square'); // wobbly
    expect(classifyStroke(polygon([{ x: 0, y: 100 }, { x: 60, y: 0 }, { x: 120, y: 100 }])).kind).toBe('triangle');
    expect(classifyStroke(polygon([{ x: 60, y: 0 }, { x: 120, y: 50 }, { x: 60, y: 100 }, { x: 0, y: 50 }])).kind).toBe('diamond');
  });
  it('recognises straight lines, single-stroke arrows, curves and L-shaped polylines', () => {
    expect(classifyStroke(line(0, 0, 200, 10)).kind).toBe('line');
    const a = classifyStroke(arrowStroke(0, 0, 200, 0));
    expect(a.kind).toBe('arrow');
    expect(a.head!.x).toBeGreaterThan(190);
    expect(a.tail!.x).toBeLessThan(10);
    expect(classifyStroke(arrowStroke(100, 200, 100, 20)).head!.y).toBeLessThan(30);
    expect(classifyStroke(curve(0, 200, (x) => 100 - 80 * Math.sin((x / 200) * Math.PI))).kind).toBe('curve');
    expect(classifyStroke(line(0, 0, 0, 100).inputs.inputs.length > 0 ? { ...line(0, 0, 0, 100), inputs: { tool: 'STYLUS', inputs: [...line(0, 0, 0, 100).inputs.inputs, ...line(0, 100, 150, 100).inputs.inputs] } } : line(0, 0, 0, 1)).kind).toBe('polyline');
  });
  it('treats tiny marks as dots and dense loops as scribbles', () => {
    expect(classifyStroke(line(0, 0, 2, 1)).kind).toBe('dot');
    const zig = Array.from({ length: 60 }, (_, i) => ({ x: (i % 2) * 40, y: i * 1.5 }));
    expect(['scribble', 'curve', 'polyline']).toContain(classifyStroke({ ...line(0, 0, 1, 1), inputs: { tool: 'STYLUS', inputs: zig.map((p, i) => ({ ...p, timeMillis: i })) } }).kind);
  });
});

describe('chainSegments / looksLikeCube', () => {
  it('chains four separate lines into a rectangle', () => {
    const pieces = rectLines(0, 0, 120, 80).map((s) => ({ strokeId: s.id, segments: classifyStroke(s).segments }));
    const chained = chainSegments(pieces);
    expect(chained).not.toBeNull();
    expect(chained!.corners).toHaveLength(4);
    expect(chained!.strokeIds).toHaveLength(4);
  });
  it('does not chain lines that do not close', () => {
    const pieces = [line(0, 0, 100, 0), line(100, 0, 100, 100), line(0, 50, 60, 50)].map((s) => ({ strokeId: s.id, segments: classifyStroke(s).segments }));
    expect(chainSegments(pieces)).toBeNull();
  });
  it('recognises cube edges by three edge directions', () => {
    const segs = cube(0, 40, 100, 40).map((s) => classifyStroke(s).segments[0]);
    expect(looksLikeCube(segs)).toBe(true);
    const box = rectLines(0, 0, 100, 100).map((s) => classifyStroke(s).segments[0]);
    expect(looksLikeCube(box)).toBe(false);
  });
});

describe('analyseInk', () => {
  it('describes a lone circle as a shape figure', () => {
    const a = analyse([circle(200, 200, 60)]);
    expect(a.hints.get(0)).toMatch(/closed shape: circle ~1\d\d px/);
    expect(a.figures).toHaveLength(1);
    expect(a.figures[0].kind).toBe('shape');
  });
  it('keeps a label written inside a circle in the same figure', () => {
    const strokes = [circle(200, 200, 60, 0), ...textLine(170, 210, 4, 16, 6000)];
    const a = analyse(strokes);
    expect(a.figures).toHaveLength(1);
    const fig = a.figures[0];
    expect(fig.groupIndices.length).toBeGreaterThanOrEqual(1);
    expect(fig.summary).toMatch(/inside/);
    const groups = buildStrokeGroups(strokes);
    expect(fig.groupIndices).toEqual(groups.map((g) => g.index));
  });
  it('connects two boxes with an arrow into one flowchart figure (multi-stroke arrow)', () => {
    const strokes = [rect(0, 0, 120, 80, 0), ...arrowTwoStrokes(125, 40, 235, 40, 6000), rect(240, 0, 360, 80, 12000)];
    const groups = buildStrokeGroups(strokes);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const a = analyse(strokes);
    expect(a.figures).toHaveLength(1);
    expect(a.figures[0].kind).toBe('flowchart');
    expect(a.figures[0].groupIndices).toEqual(groups.map((g) => g.index));
    expect(a.figures[0].edges).toHaveLength(1);
    expect(a.figures[0].summary).toMatch(/edges: n1 → n2/);
    const arrowGroup = groups.find((g) => g.strokeIds.includes(strokes[1].id))!;
    expect(a.hints.get(arrowGroup.index)).toMatch(/arrow → right/);
  });
  it('recognises L-shaped axes with a curve as a plot', () => {
    const strokes = [...axes(50, 300, 300, 200, 0), curve(60, 340, (x) => 300 - (x - 50) * 0.6, 3000)];
    const a = analyse(strokes);
    expect(a.figures).toHaveLength(1);
    expect(a.figures[0].kind).toBe('plot');
    expect(a.figures[0].summary).toMatch(/axes/);
    expect(a.figures[0].shapes).toContain('x/y axes');
  });
  it('recognises a cube drawn from twelve lines', () => {
    const a = analyse(cube(100, 140, 120, 50));
    expect(a.figures).toHaveLength(1);
    expect(a.figures[0].kind).toBe('cube');
    expect(a.figures[0].shapes).toContain('cube / 3D box');
  });
  it('calls handwriting text and makes no figure for it', () => {
    const a = analyse(textLine(0, 100, 8, 18));
    expect(a.figures).toHaveLength(0);
    expect(a.hints.get(0)).toMatch(/looks like text/);
  });
  it('leaves a line of text beside a figure out of the figure', () => {
    const strokes = [rect(0, 0, 120, 80, 0), ...textLine(160, 50, 12, 18, 8000)];
    const a = analyse(strokes);
    expect(a.figures).toHaveLength(1);
    const groups = buildStrokeGroups(strokes);
    const textGroup = groups.find((g) => g.strokeIds.includes(strokes[1].id))!;
    expect(a.figures[0].groupIndices).not.toContain(textGroup.index);
    expect(a.figures[0].labelGroups).toHaveLength(0);
  });
  it('does not call letters shapes: small loops in a text line are text', () => {
    const a = analyse(textLine(0, 100, 8, 18));
    expect(a.groups[0].closed).toHaveLength(0);
    expect(a.groups[0].graphic).toBe(false);
  });
  it('does not promote a lone underline to a figure', () => {
    const a = analyse([...textLine(0, 100, 6, 18), line(0, 108, 90, 108, 2000)]);
    expect(a.figures).toHaveLength(0);
  });
});
