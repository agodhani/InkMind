import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { glyphFor, layoutText, measureText, parseJhf } from './font';
import { DEFAULT_INK_STYLE, InkWriter, resample } from './ink';
import { drawCircle, drawRect, writeText, type Pen } from './shapes';
import { DATASETS, SCENE_KINDS, buildScene, sceneReference } from './scenes';
import { captionHasLabel, diagramMetrics, formatReferencePage, parseReferencePage } from './metrics';
import { strokesBounds } from '../transcribe/regions';

const pen = (seed = 1): Pen => {
  const rng = new Rng(seed);
  return { rng, w: new InkWriter(rng.fork('ink'), 't') };
};

describe('Rng', () => {
  it('is deterministic for a seed and different across seeds', () => {
    const a = new Rng('x'), b = new Rng('x'), c = new Rng('y');
    const sa = [a.next(), a.next(), a.next()], sb = [b.next(), b.next(), b.next()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual([c.next(), c.next(), c.next()]);
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true);
  });
  it('int() stays inclusive of both ends', () => {
    const r = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});

describe('Hershey font', () => {
  it('parses the JHF record for A into three pen-down paths', () => {
    const a = parseJhf('12345  9I[RFJ[ RRFZ[ RMTWT');
    expect(a.paths).toHaveLength(3);
    expect(a.left).toBe(-9);
    expect(a.right).toBe(9);
    expect(a.paths[0]).toEqual([{ x: 0, y: -12 }, { x: -8, y: 9 }]);
  });
  it('has glyphs for printable ASCII and falls back to ? otherwise', () => {
    expect(glyphFor('g').paths.length).toBeGreaterThan(0);
    expect(glyphFor(' ').paths).toHaveLength(0);
    expect(glyphFor('é')).toBe(glyphFor('?'));
  });
  it('lays text out left to right on the baseline at the requested cap height', () => {
    const l = layoutText('AB', 100, 200, 21);
    expect(l.chars[1].x).toBeGreaterThan(l.chars[0].x);
    const ys = l.chars.flatMap((c) => c.polylines.flat().map((p) => p.y));
    expect(Math.min(...ys)).toBeCloseTo(179, 0);
    expect(Math.max(...ys)).toBeCloseTo(200, 0);
    expect(measureText('AB', 21)).toBeCloseTo(l.width);
    expect(measureText('AB AB', 21)).toBeGreaterThan(2 * measureText('AB', 21));
  });
});

describe('InkWriter', () => {
  it('resamples at roughly even spacing', () => {
    const pts = resample([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2.5);
    expect(pts).toHaveLength(5);
    expect(pts[4]).toEqual({ x: 10, y: 0 });
  });
  it('produces human-like strokes: ≥4 points, increasing time, pressure in range, near the ideal path', () => {
    const { w } = pen();
    const s = w.stroke([{ x: 0, y: 0 }, { x: 100, y: 0 }])!;
    const inputs = s.inputs.inputs;
    expect(inputs.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < inputs.length; i++) expect(inputs[i].timeMillis).toBeGreaterThanOrEqual(inputs[i - 1].timeMillis);
    for (const p of inputs) {
      expect(p.pressure! > 0 && p.pressure! <= 1).toBe(true);
      expect(Math.abs(p.y)).toBeLessThan(6);
    }
    const pressures = inputs.map((p) => p.pressure!);
    expect(new Set(pressures).size).toBeGreaterThan(3);
    const duration = inputs[inputs.length - 1].timeMillis - inputs[0].timeMillis;
    expect(duration).toBeGreaterThan(80);
    expect(duration).toBeLessThan(600);
  });
  it('pads tiny strokes to four points and leaves gaps between strokes', () => {
    const { w } = pen();
    const a = w.stroke([{ x: 0, y: 0 }, { x: 1, y: 0 }])!;
    const b = w.stroke([{ x: 0, y: 10 }, { x: 1, y: 10 }])!;
    expect(a.inputs.inputs.length).toBeGreaterThanOrEqual(4);
    expect(b.inputs.inputs[0].timeMillis - a.inputs.inputs.at(-1)!.timeMillis).toBeGreaterThan(50);
    expect(a.id).not.toBe(b.id);
    expect(a.brush.size).toBe(DEFAULT_INK_STYLE.brushSize);
  });
});

describe('shapes', () => {
  it('draws a circle that closes near its start and stays near the radius', () => {
    const p = pen(5);
    drawCircle(p, 200, 200, 100);
    expect(p.w.strokes.length).toBeGreaterThanOrEqual(1);
    const pts = p.w.strokes.flatMap((s) => s.inputs.inputs);
    for (const q of pts) expect(Math.abs(Math.hypot(q.x - 200, q.y - 200) - 100)).toBeLessThan(14);
    const b = strokesBounds(p.w.strokes)!;
    expect(b.right - b.left).toBeGreaterThan(180);
  });
  it('draws a rectangle as 1, 2 or 4 strokes depending on the hint', () => {
    for (const [hint, n] of [[1, 1], [2, 2], ['sides', 4]] as const) {
      const p = pen(7);
      drawRect(p, { x: 0, y: 0, w: 100, h: 60 }, hint);
      expect(p.w.strokes).toHaveLength(n);
    }
  });
  it('writes text as one stroke per glyph path, advancing to the right', () => {
    const p = pen(9);
    const strokes = writeText(p, 'Hi x', 50, 100, { size: 20 });
    // H = 3 paths, i = 2 (stem + dot), x = 2
    expect(strokes).toHaveLength(7);
    const first = strokesBounds([strokes[0]])!, last = strokesBounds([strokes[strokes.length - 1]])!;
    expect(last.left).toBeGreaterThan(first.right);
    const b = strokesBounds(strokes)!;
    expect(b.top).toBeGreaterThan(70);
    expect(b.bottom).toBeLessThan(110);
  });
});

describe('scenes', () => {
  it('builds every catalogued kind deterministically with disjoint figure/text strokes', () => {
    for (const { kind } of SCENE_KINDS) {
      const a = buildScene(kind, 3), b = buildScene(kind, 3);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.strokes.length).toBeGreaterThan(0);
      expect(new Set(a.strokes.map((s) => s.id)).size).toBe(a.strokes.length);
      const ids = new Set(a.strokes.map((s) => s.id));
      const figureIds = a.figures.flatMap((f) => f.strokeIds);
      expect(new Set(figureIds).size).toBe(figureIds.length);
      for (const id of figureIds) expect(ids.has(id)).toBe(true);
      for (const s of a.strokes) for (const q of s.inputs.inputs) expect(q.x > 0 && q.x < a.width && q.y > 0 && q.y < a.height).toBe(true);
      expect(a.figures.length).toBeGreaterThan(0);
    }
  });
  it('changes with the seed', () => {
    expect(JSON.stringify(buildScene('circle', 1))).not.toBe(JSON.stringify(buildScene('circle', 2)));
  });
  it('mixed-notes has heading, bullets, a figure with labels and a footnote', () => {
    const s = buildScene('mixed-notes', 41);
    expect(s.text).toMatch(/^# /);
    expect(s.text).toMatch(/\n- /);
    expect(s.text).toMatch(/\*/);
    expect(s.figures).toHaveLength(1);
    expect(s.figures[0].labels.length).toBeGreaterThan(0);
    expect(s.strokes.length).toBeGreaterThan(s.figures[0].strokeIds.length);
  });
  it('datasets reference only known kinds and round-trip through reference.md', () => {
    for (const [name, pages] of Object.entries(DATASETS)) {
      expect(pages.length).toBeGreaterThan(0);
      for (const pg of pages) {
        const scene = buildScene(pg.kind, pg.seed);
        const ref = parseReferencePage(sceneReference(scene));
        expect(ref.text).toBe(scene.text.trim());
        expect(ref.figures.map((f) => f.strokeIds)).toEqual(scene.figures.map((f) => f.strokeIds));
        expect(ref.figures[0].labels).toEqual(scene.figures[0].labels);
        void name;
      }
    }
  });
});

describe('diagram metrics', () => {
  const figures = [
    { id: 'f1', type: 'graph', labels: ['loss', 'x', 'step'], strokeIds: ['a', 'b', 'c', 'd', 'e'] },
    { id: 'f2', type: 'cube', labels: [], strokeIds: ['p', 'q'] },
  ];
  it('detects a figure covered ≥80% with ≤20% foreign strokes and finds labels case-insensitively', () => {
    const m = diagramMetrics(figures, [
      { kind: 'diagram', text: 'Graph of LOSS vs step; axes x and y', strokeIds: ['a', 'b', 'c', 'd', 'z'] },
      { kind: 'paragraph', text: 'hello', strokeIds: ['t1', 'p'] },
    ]);
    expect(m.perFigure[0].detected).toBe(true);
    expect(m.perFigure[0].coverage).toBe(0.8);
    expect(m.perFigure[0].foreign).toBe(0.2);
    expect(m.perFigure[0].labelsFound).toEqual(['loss', 'x', 'step']);
    expect(m.perFigure[1].detected).toBe(false);
    expect(m.perFigure[1].leaked).toBe(0.5);
    expect(m.figureRecall).toBe(0.5);
    expect(m.textLeak).toBeCloseTo(1 / 7);
    expect(m.labelRecall).toBe(1);
    expect(m.spuriousDiagrams).toBe(0);
  });
  it('rejects a diagram block with too many foreign strokes and counts spurious diagrams', () => {
    const m = diagramMetrics(figures, [
      { kind: 'diagram', text: '', strokeIds: ['a', 'b', 'c', 'd', 'e', 't1', 't2'] },
      { kind: 'diagram', text: 'noise', strokeIds: ['t3', 't4'] },
    ]);
    expect(m.perFigure[0].detected).toBe(false);
    expect(m.perFigure[0].coverage).toBe(1);
    expect(m.spuriousDiagrams).toBe(1);
    expect(m.labelRecall).toBe(0);
  });
  it('returns nulls when there is nothing to score', () => {
    const m = diagramMetrics([], [{ kind: 'paragraph', text: 'x', strokeIds: ['a'] }]);
    expect(m.figureRecall).toBeNull();
    expect(m.textLeak).toBeNull();
    expect(m.labelRecall).toBeNull();
  });
  it('matches short labels only as whole words', () => {
    expect(captionHasLabel('a box with x marked', 'x')).toBe(true);
    expect(captionHasLabel('a box', 'x')).toBe(false);
    expect(captionHasLabel('Loss vs. step (1k, 2k)', '2k')).toBe(true);
    expect(captionHasLabel('y=x^2 curve', 'x^2')).toBe(true);
  });
  it('round-trips the figures fence in reference pages', () => {
    const md = formatReferencePage('# Title\n- a', figures);
    const parsed = parseReferencePage(md);
    expect(parsed.text).toBe('# Title\n- a');
    expect(parsed.figures).toEqual(figures);
    expect(parseReferencePage('plain').figures).toEqual([]);
    expect(parseReferencePage('<!-- circle #1: a hand-drawn circle -->\n\n' + formatReferencePage('', figures)).text).toBe('');
  });
});
