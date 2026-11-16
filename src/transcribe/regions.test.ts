import { describe, expect, it } from 'vitest';
import { stroke } from '../__tests__/helpers';
import type { DigitalBlock, FigureInfo, InkStroke } from '../model/page';
import { newId, unionBounds } from '../model/page';
import { arrowTwoStrokes, line, rect, rectLines, resetSynthetic, textLine } from '../__tests__/shapes';
import { attachUnclaimedStrokes, buildStrokeGroups, computeDirtyRegions, mergeBlocks, mergeFigures, mergeWithGeometry, protectEditedBlocks, rawToDigitalBlock, reconcileFigureBlocks } from './regions';
import type { StrokeGroupMeta } from './types';
import { normaliseFigure } from './figure';
import { figureFromGeometry, type FigureHint } from '../ink/shapeHints';
import { buildScene, DATASETS } from '../sim/scenes';
import { getStrokeBoundingBox } from '../types/brush';

describe('graph-based word assignment', () => {
  it('uses page stroke order rather than digits in random ids to break graph symmetries', () => {
    const scene = buildScene('mind-map', 33, 'normal');
    const groups = buildStrokeGroups(scene.strokes);
    const hint = groups.find((g) => g.figure)!.figure!;
    const full = figureFromGeometry(hint, () => undefined, groups);
    const nodes = full.nodes!.slice(0, 3);
    const geo = { ...full, nodes, edges: [nodes[0], nodes[2]].map((n) => ({ from: nodes[1].label, to: n.label, kind: 'line' as const })) };
    const ids = geo.nodes!.map((_, i) => `stroke_${98765432 - i * 173921}`);
    const geometry = { ...geo, nodes: geo.nodes!.map((n, i) => ({ ...n, strokeIds: [ids[i]] })) };
    const labels = geometry.nodes!.map((_, i) => `word ${i}`);
    const rename = new Map(geometry.nodes!.map((n, i) => [n.label, labels[i]]));
    const prior: FigureInfo = { kind: 'mindmap', shapes: [], labels, nodes: labels.map((label, i) => ({ id: `model-${i}`, label })), edges: geometry.edges.map((e) => ({ ...e, from: rename.get(e.from)!, to: rename.get(e.to)! })) };
    expect(mergeWithGeometry(prior, hint, labels, geometry, ids).nodes!.map((n) => n.label)).toEqual(labels);
  });
  it('allows repeated labels supported by distinct node ids', () => {
    const scene = buildScene('state-machine', 62, 'messy');
    const groups = buildStrokeGroups(scene.strokes);
    const hint = groups.find((g) => g.figure)!.figure!;
    const geo = figureFromGeometry(hint, () => undefined, groups);
    const prior: FigureInfo = { kind: 'flowchart', shapes: [], labels: ['work', 'done'], edges: [], nodes: geo.nodes!.map((n, i) => ({ id: n.id, label: i < 2 ? 'work' : 'done' })) };
    expect(mergeWithGeometry(prior, hint, prior.labels, geo).nodes!.map((n) => n.label)).toEqual(['work', 'work', 'done']);
  });
  it('names distinct states once when the model duplicates an accepting-state node', () => {
    const scene = buildScene('state-machine', 62, 'messy');
    const groups = buildStrokeGroups(scene.strokes);
    const hint = groups.find((g) => g.figure)!.figure!;
    const prior: FigureInfo = { kind: 'flowchart', shapes: [], labels: ['q0', 'q1', 'q2'], nodes: ['q0', 'q1', 'q2', 'q1'].map((label, i) => ({ id: `n${i + 1}`, label })), edges: scene.figures[0].edges! };
    const geo = figureFromGeometry(hint, () => undefined, groups);
    const out = mergeWithGeometry(prior, hint, prior.labels, geo);
    expect(out.nodes!.map((n) => n.label)).toEqual(['q0', 'q1', 'q2']);
    expect(out.edges.map((e) => `${e.from}|${e.to}`).sort()).toEqual(['q0|q1', 'q1|q1', 'q1|q2', 'q2|q0']);
    const duplicate = { ...prior, nodes: [{ id: 'n1', label: 'q0' }, { id: 'n2', label: 'q0' }, { id: 'unused', label: 'q1', bbox: hint.nodes[1].bbox }, { id: 'n3', label: 'q2' }] };
    expect(mergeWithGeometry(duplicate, hint, prior.labels, geo).nodes!.map((n) => n.label)).toEqual(['q0', 'q1', 'q2']);
  });
  it.each(DATASETS['tables-mindmaps'].filter((s) => s.kind === 'mind-map'))('names the radial graph despite conflicting model groups: $seed', ({ kind, seed, messiness }) => {
    const scene = buildScene(kind, seed, messiness);
    const groups = buildStrokeGroups(scene.strokes);
    const hint = groups.find((g) => g.figure)!.figure!;
    const expected = scene.figures[0];
    const prior: FigureInfo = { kind: 'mindmap', shapes: [], labels: expected.labels, edges: expected.edges!, nodes: expected.labels.map((label, i) => ({ id: `wrong-${i}`, label, group: 999 })) };
    const geometry = figureFromGeometry(hint, () => undefined, groups);
    const out = mergeWithGeometry(prior, hint, prior.labels, geometry);
    expect(new Set(out.nodes!.map((n) => n.label))).toEqual(new Set(expected.labels));
    expect(out.edges.map((e) => [e.from, e.to].sort().join('|')).sort()).toEqual(expected.edges!.map((e) => [e.from, e.to].sort().join('|')).sort());
    const positioned = { ...prior, nodes: out.nodes!.map((n) => ({ ...n, group: 999 })) };
    expect(mergeWithGeometry(positioned, hint, prior.labels, geometry).edges).toEqual(out.edges);
    expect(mergeWithGeometry(undefined, hint, [], geometry).nodes!.map((n) => n.label)).toEqual(geometry.nodes!.map((n) => n.label));
    const invalid = { ...prior, nodes: prior.nodes!.map((n) => ({ ...n, bbox: { left: 10000, right: 10010, top: 10000, bottom: 10010 } })) };
    expect(mergeWithGeometry(invalid, hint, prior.labels, geometry).nodes!.map((n) => n.label)).toEqual(geometry.nodes!.map((n) => n.label));
  });
});

describe.each([false, true])('unclaimed prose with an unpositioned model paragraph: %s', (withParagraph) => {
  it.each([...DATASETS['notes-complex'], ...DATASETS['mixed-notes']])('preserves geometry ownership on $kind seed $seed', ({ kind, seed, messiness }) => {
    const scene = buildScene(kind, seed, messiness);
    const groups = buildStrokeGroups(scene.strokes);
    const prose: DigitalBlock = { id: 'prose', kind: 'paragraph', text: 'overview', bbox: { left: 0, top: 0, right: 0, bottom: 0 }, strokeIds: [], confidence: 0.5 };
    const before = reconcileFigureBlocks(withParagraph ? [prose] : [], groups, scene.strokes);
    const after = attachUnclaimedStrokes(before, scene.strokes);
    for (const b of before.filter((b) => b.kind === 'diagram')) expect(after.find((a) => a.id === b.id)).toEqual(b);
    expect(new Set(after.flatMap((b) => b.strokeIds))).toEqual(new Set(scene.strokes.map((s) => s.id)));
    const text = after.find((b) => b.kind === 'paragraph')!;
    expect(text.strokeIds.length).toBeGreaterThan(0);
    expect(text.text).toBe(withParagraph ? 'overview' : '');
    expect(text.bbox.bottom).toBeGreaterThan(text.bbox.top);
    expect(before.find((b) => b.id === 'prose')?.strokeIds ?? []).toEqual([]);
  });
});

describe('unclaimed stroke fallback', () => {
  it('leaves empty and already covered requests unchanged', () => {
    const ink = [line(10, 10, 20, 20)];
    const empty: DigitalBlock[] = [];
    expect(attachUnclaimedStrokes(empty, ink)).toBe(empty);
    const covered: DigitalBlock[] = [{ id: 'covered', kind: 'paragraph', text: 'word', strokeIds: [ink[0].id], bbox: { left: 10, top: 10, right: 20, bottom: 20 }, confidence: 0.9 }];
    expect(attachUnclaimedStrokes(covered, ink)).toBe(covered);
    expect(attachUnclaimedStrokes(covered, [])).toBe(covered);
  });
});

describe('notes page segmentation', () => {
  it.each([[65, 64, 21], [64, 21, 65], [21, 65, 64], [50, 50, 21]])('keeps shared model words on the largest figure for stroke counts %j', (...counts) => {
    const strokes = counts.flatMap((count, i) => Array.from({ length: count }, () => line(i * 200 + 10, 10, i * 200 + 60, 60)));
    let offset = 0;
    const groups: StrokeGroupMeta[] = counts.map((count, i) => {
      const strokeIds = strokes.slice(offset, offset + count).map((s) => s.id);
      offset += count;
      const figure: FigureHint = { id: i, groupIndices: [i], kind: 'sketch', shapes: ['rectangle'], labelGroups: [], labelInside: {}, labelHostGroups: [], nodes: [], relations: [], edges: [], order: [], orderBasis: '', summary: '' };
      return { index: i, writtenOrder: i, strokeIds, bbox: { left: i * 200, top: 0, right: i * 200 + 80, bottom: 80 }, figure };
    });
    const model: DigitalBlock = { id: 'spanning', kind: 'diagram', text: 'model caption', bbox: { left: 0, top: 0, right: 480, bottom: 80 }, strokeIds: strokes.map((s) => s.id), confidence: 0.9, figure: { kind: 'sketch', shapes: [], labels: ['model words'], edges: [] } };
    const out = reconcileFigureBlocks([model], groups, strokes);
    const ownerIndex = counts.indexOf(Math.max(...counts));
    const owner = out.find((b) => b.strokeIds.includes(groups[ownerIndex].strokeIds[0]))!;
    expect(owner.text).toBe('model caption');
    expect(owner.figure!.labels).toContain('model words');
    expect(out.filter((b) => b.figure?.labels.includes('model words'))).toHaveLength(1);
    expect(new Set(out.flatMap((b) => b.strokeIds))).toEqual(new Set(strokes.map((s) => s.id)));
  });
  it.each([...DATASETS['notes-complex'], ...DATASETS['mixed-notes']])('keeps figures separate on $kind seed $seed', ({ kind, seed, messiness }) => {
    const scene = buildScene(kind, seed, messiness);
    const groups = buildStrokeGroups(scene.strokes);
    const blocks = reconcileFigureBlocks([], groups, scene.strokes);
    expect(blocks.filter((b) => b.kind === 'diagram')).toHaveLength(scene.figures.length);
    for (const figure of scene.figures) {
      const owner = blocks.find((b) => b.strokeIds.includes(figure.strokeIds[0]));
      expect(owner).toBeDefined();
      expect(owner!.strokeIds).toEqual(expect.arrayContaining(figure.strokeIds));
      for (const other of scene.figures.filter((f) => f !== figure)) {
        expect(owner!.strokeIds.some((id) => other.strokeIds.includes(id))).toBe(false);
      }
    }
    const incoming: DigitalBlock[] = [{ id: 'whole-page', kind: 'diagram', text: '', confidence: 0.9, bbox: { left: 0, top: 0, right: scene.width, bottom: scene.height }, strokeIds: scene.strokes.map((s) => s.id) }];
    const covered = new Set(reconcileFigureBlocks(incoming, groups, scene.strokes).flatMap((b) => b.strokeIds));
    expect(covered).toEqual(new Set(scene.strokes.map((s) => s.id)));
  });

  it.each([41, 43, 134])('does not invent diagrams or edges on prose from seed %s', (seed) => {
    const scene = buildScene(seed === 134 ? 'notes-complex' : 'mixed-notes', seed, seed === 134 ? 'messy' : 'normal');
    const ink = scene.strokes.filter((s) => getStrokeBoundingBox(s)!.bottom < 200);
    expect(reconcileFigureBlocks([], buildStrokeGroups(ink), ink)).toEqual([]);
  });

  it('splits a model diagram spanning figures and preserves outside text strokes', () => {
    const scene = buildScene('notes-complex', 131);
    const groups = buildStrokeGroups(scene.strokes);
    const model: DigitalBlock = { id: 'model', kind: 'diagram', text: 'model words', confidence: 0.9, bbox: { left: 0, top: 0, right: 1000, bottom: 1400 }, strokeIds: scene.strokes.map((s) => s.id) };
    const result = reconcileFigureBlocks([model], groups, scene.strokes);
    const diagrams = result.filter((b) => b.kind === 'diagram');
    expect(diagrams).toHaveLength(2);
    expect(new Set(result.flatMap((b) => b.strokeIds)).size).toBe(scene.strokes.length);
    for (const b of diagrams) expect(b.strokeIds.every((id) => groups.some((g) => g.figure && g.strokeIds.includes(id)))).toBe(true);
    const largest = [...diagrams].sort((a, b) => b.strokeIds.length - a.strokeIds.length)[0];
    expect(largest.text).toBe('model words');
    expect(result.filter((b) => b.kind === 'paragraph').every((b) => !b.text)).toBe(true);
  });

  it('handles empty ink', () => {
    expect(reconcileFigureBlocks([], buildStrokeGroups([]), [])).toEqual([]);
  });

  it('preserves model labels and caption on the majority figure without duplicating them on prose', () => {
    const scene = buildScene('mixed-notes', 43);
    const drawing = scene.figures[0];
    const prose = scene.strokes.filter((s) => !drawing.strokeIds.includes(s.id)).slice(0, 3);
    const strokeIds = [...drawing.strokeIds, ...prose.map((s) => s.id)];
    const ink = scene.strokes;
    const model: DigitalBlock = { id: 'reader', kind: 'diagram', text: 'Start then Decide then Finish', confidence: 0.9, bbox: drawing.bbox, strokeIds, figure: normaliseFigure({ labels: ['Start', 'Decide', 'Finish'] }) };
    const result = reconcileFigureBlocks([model], buildStrokeGroups(ink), ink);
    const diagram = result.find((b) => b.kind === 'diagram')!;
    expect(diagram.text).toBe(model.text);
    expect(diagram.figure!.labels).toEqual(expect.arrayContaining(['Start', 'Decide', 'Finish']));
    expect(result.filter((b) => b.kind !== 'diagram').every((b) => !b.text && !b.figure)).toBe(true);
    expect(new Set(result.flatMap((b) => b.strokeIds))).toEqual(new Set(strokeIds));
  });

  it('retains structural words on a minority figure when the remainder is only prose', () => {
    const scene = buildScene('mixed-notes', 43);
    const model: DigitalBlock = { id: 'reader', kind: 'diagram', text: '', confidence: 0.9, bbox: scene.figures[0].bbox, strokeIds: scene.strokes.map((s) => s.id), figure: normaliseFigure({ labels: ['input', 'ok?', 'output'] }) };
    const result = reconcileFigureBlocks([model], buildStrokeGroups(scene.strokes), scene.strokes);
    const diagram = result.find((b) => b.kind === 'diagram')!;
    expect(diagram.figure!.labels).toEqual(expect.arrayContaining(['input', 'ok?', 'output']));
    expect(result.filter((b) => b.kind !== 'diagram').every((b) => !b.figure)).toBe(true);
  });

  it('keeps chart titles and x-axis labels despite closed shapes in stacked bars', () => {
    const scene = buildScene('bar-stacked', 104, 'messy');
    const model: DigitalBlock = { id: 'reader', kind: 'diagram', text: '', confidence: 0.9, bbox: scene.figures[0].bbox, strokeIds: scene.strokes.map((s) => s.id) };
    const result = reconcileFigureBlocks([model], buildStrokeGroups(scene.strokes), scene.strokes);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('diagram');
    expect(new Set(result[0].strokeIds)).toEqual(new Set(scene.strokes.map((s) => s.id)));
  });
});

describe('geometry-first structure', () => {
  const hint: FigureHint = { id: 0, groupIndices: [], kind: 'flowchart', shapes: ['rectangle'], labelGroups: [], labelInside: {}, labelHostGroups: [], nodes: [], relations: [], edges: [], order: [], orderBasis: '', summary: '' };
  const geo = {
    nodes: [{ id: 'n1', label: 'rectangle 1', shape: 'rectangle', group: 1 }, { id: 'n2', label: 'rectangle 2', shape: 'rectangle', group: 2, parent: 'n1' }, { id: 'n3', label: 'rectangle 3', shape: 'rectangle', group: 3 }],
    edges: [{ from: 'rectangle 1', to: 'rectangle 2', kind: 'arrow' as const }, { from: 'rectangle 2', to: 'rectangle 3', kind: 'line' as const }],
    sequence: ['rectangle 1', 'rectangle 2', 'rectangle 3'], unnamed: ['rectangle 1', 'rectangle 2', 'rectangle 3'],
  };
  it('assigns exact unused labels in node reading order without changing arrow order', () => {
    const out = mergeWithGeometry(undefined, { ...hint, order: ['n3', 'n1', 'n2'], orderBasis: 'arrow order' }, ['first', 'second', 'third'], { ...geo, sequence: ['rectangle 3', 'rectangle 1', 'rectangle 2'] });
    expect(out.nodes!.map((n) => n.label)).toEqual(['first', 'second', 'third']);
    expect(out.edges[0]).toMatchObject({ from: 'first', to: 'second', kind: 'arrow' });
    expect(out.sequence).toEqual(['third', 'first', 'second']);
    expect(out.nodes![1].parent).toBe('n1');
  });
  it('uses the figure order when its basis is explicitly spatial', () => {
    const out = mergeWithGeometry(undefined, { ...hint, order: ['n3', 'n1', 'n2'], orderBasis: 'left→right' }, ['first', 'second', 'third'], geo);
    expect(out.nodes!.map((n) => n.label)).toEqual(['second', 'third', 'first']);
  });
  it('excludes words already named on nodes, edges, cells or sequences before exact matching', () => {
    const prior = normaliseFigure({ names: { n1: 'start' }, labels: ['start', 'yes', 'header', 'message', 'middle', 'end'], cells: [['header']], sequence: ['message'] })!;
    const out = mergeWithGeometry(prior, hint, prior.labels, { ...geo, edges: geo.edges.map((e, i) => i === 0 ? { ...e, label: 'yes' } : e) });
    expect(out.nodes!.map((n) => n.label)).toEqual(['start', 'middle', 'end']);
  });
  it.each([{ labels: [] }, { labels: ['one', 'two'] }, { labels: ['one', 'two', 'three', 'extra'] }, { labels: ['n1', 'n2', 'n3'] }])('leaves unmatched placeholders for $labels', ({ labels }) => {
    const out = mergeWithGeometry(undefined, hint, labels, geo);
    expect(out.nodes!.map((n) => n.label)).toEqual(geo.unnamed);
  });
  it('uses hint ids when several geometry nodes share a label group', () => {
    const prior = normaliseFigure({ nodes: [{ id: 'n1', group: 0, label: 'outer' }, { id: 'n2', group: 0, label: 'inner' }, { id: 'n3', group: 0, label: 'core' }] })!;
    const out = mergeWithGeometry(prior, hint, prior.labels, { ...geo, nodes: geo.nodes.map((n) => ({ ...n, group: 0 })) });
    expect(out.nodes!.map((n) => n.label)).toEqual(['outer', 'inner', 'core']);
    expect(out.nodes![1].parent).toBe('n1');
    expect(out.edges[0]).toMatchObject({ from: 'outer', to: 'inner', kind: 'arrow' });
  });
  it('keeps model words as labels when text-group naming or a smaller geometry grid wins', () => {
    const prior = normaliseFigure({ names: { n1: 'model word' }, cells: [['header', 'extra column'], ['last row']] })!;
    const out = mergeWithGeometry(prior, { ...hint, kind: 'table' }, prior.labels, { ...geo, nodes: [{ ...geo.nodes[0], label: 'group word' }], unnamed: [], cells: [['']] });
    expect(out.nodes![0].label).toBe('group word');
    expect(out.cells).toEqual([['header']]);
    expect(out.labels).toEqual(expect.arrayContaining(['model word', 'group word', 'header', 'extra column', 'last row']));
  });
  it('keeps geometry structure but takes an unopposed model direction', () => {
    const prior = normaliseFigure({ kind: 'flowchart', names: { n1: 'start', n2: 'work', n3: 'end', n9: 'extra' }, edges: [{ from: 'n2', to: 'n1', label: 'yes', kind: 'line' }, { from: 'n1', to: 'n3' }], sequence: ['n3', 'n1', 'n2'] })!;
    const out = mergeWithGeometry(prior, hint, prior.labels, geo);
    expect(out.nodes).toEqual([{ id: 'n1', label: 'start', shape: 'rectangle', group: 1 }, { id: 'n2', label: 'work', shape: 'rectangle', group: 2, parent: 'n1' }, { id: 'n3', label: 'end', shape: 'rectangle', group: 3 }, { id: 'n9', label: 'extra' }]);
    expect(out.edges).toEqual([{ from: 'work', to: 'start', kind: 'arrow', label: 'yes', inferred: true }, { from: 'work', to: 'end', kind: 'line', inferred: true }]);
    expect(out.sequence).toEqual(['start', 'work', 'end']);
  });
  it('uses text-group names before model node names and ignores model nesting when geometry has nesting', () => {
    const prior = normaliseFigure({ nodes: [{ id: 'n1', label: 'wrong', parent: 'n3' }, { id: 'n2', label: 'child' }, { id: 'n3', label: 'outside', parent: 'n1' }], edges: [] })!;
    const out = mergeWithGeometry(prior, hint, ['n1', 'n2'], { ...geo, nodes: geo.nodes.map((n) => n.id === 'n1' ? { ...n, label: 'read' } : n), edges: [], unnamed: ['rectangle 2', 'rectangle 3'] });
    expect(out.nodes![0].label).toBe('read');
    expect(out.nodes![0].parent).toBeUndefined();
    expect(out.nodes![1].parent).toBe('n1');
    expect(out.nodes![2].parent).toBeUndefined();
    expect(out.labels).toEqual(expect.arrayContaining(['read', 'child']));
  });
  it('accepts model edges only between distinct known nodes when geometry has no relations', () => {
    const prior = normaliseFigure({ names: { n1: 'start', n2: 'end' }, edges: [{ from: 'n1', to: 'n2' }, { from: 'n1', to: 'n1' }, { from: 'start', to: 'unknown' }] })!;
    expect(mergeWithGeometry(prior, hint, [], { nodes: geo.nodes.slice(0, 2), edges: [], unnamed: geo.unnamed }).edges).toEqual([{ from: 'start', to: 'end', inferred: false }]);
  });
  it('does not copy a reverse arrow label onto the other direction of a bidirectional pair', () => {
    const geometry = { nodes: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }], unnamed: [] };
    const prior = normaliseFigure({ edges: [{ from: 'b', to: 'a', label: 'return' }] })!;
    expect(mergeWithGeometry(prior, hint, [], geometry).edges.map((e) => e.label)).toEqual([undefined, 'return']);
    prior.edges.push({ from: 'a', to: 'b', label: 'send' });
    expect(mergeWithGeometry(prior, hint, [], geometry).edges.map((e) => e.label)).toEqual(['send', 'return']);
    prior.edges.pop();
    expect(mergeWithGeometry(prior, hint, [], { ...geometry, edges: geometry.edges.slice(0, 1) }).edges[0].label).toBe('return');
  });
  it('assigns repeated messages once, preferring consistent labels over array order', () => {
    const geometry = { nodes: [{ id: 'a', label: 'agent' }, { id: 'b', label: 'env' }], edges: [{ from: 'agent', to: 'env', label: 'reset' }, { from: 'agent', to: 'env', label: 'action' }, { from: 'env', to: 'agent' }, { from: 'env', to: 'agent' }], unnamed: [] };
    const scene = buildScene('sequence-diagram', 72, 'messy');
    const prior: FigureInfo = { kind: 'sequence', shapes: [], labels: [], edges: scene.figures[0].edges! };
    expect(mergeWithGeometry(prior, hint, [], geometry).edges.map((e) => e.label)).toEqual(['reset', 'action', 'state', 'reward']);
    expect(mergeWithGeometry({ ...prior, edges: prior.edges.slice(0, 1) }, hint, [], geometry).edges.filter((e) => e.label === 'action')).toHaveLength(1);
  });
  it('fills a sole missing exit even with equal counts, but rejects extra connected transitions', () => {
    const geometry = { nodes: ['idle', 'run', 'wait', 'done'].map((label, i) => ({ id: `n${i}`, label })), edges: [{ from: 'idle', to: 'run' }, { from: 'run', to: 'wait' }, { from: 'wait', to: 'run' }, { from: 'run', to: 'done' }], unnamed: [] };
    const scene = buildScene('state-machine', 64, 'messy');
    const prior: FigureInfo = { kind: 'graph', shapes: [], labels: [], edges: [...scene.figures[0].edges!, { from: 'wait', to: 'done', label: 'exit' }] };
    expect(mergeWithGeometry(prior, hint, [], geometry).edges).toHaveLength(4);
    const gap = { ...geometry, edges: [{ from: 'idle', to: 'run' }, { from: 'run', to: 'wait' }] };
    const model = { ...prior, edges: [{ from: 'idle', to: 'run' }, { from: 'wait', to: 'done' }] };
    expect(mergeWithGeometry(model, hint, [], gap).edges).toContainEqual({ from: 'wait', to: 'done', inferred: false });
  });
  it('resolves fallback sequence ids and preserves the drawn table dimensions', () => {
    const prior = normaliseFigure({ labels: ['n1, N3'], sequence: ['n1', 'N3'], cells: [['a', 'b', 'extra'], ['c'], ['extra']] })!;
    const out = mergeWithGeometry(prior, { ...hint, kind: 'table' }, prior.labels, { nodes: geo.nodes, edges: [], unnamed: geo.unnamed, cells: [['', ''], ['', '']] });
    expect(out.sequence).toEqual(['rectangle 1', 'rectangle 3']);
    expect(out.labels).not.toEqual(expect.arrayContaining(['n1', 'N3']));
    expect(out.cells).toEqual([['a', 'b'], ['c', '']]);
  });
});

const block = (id: string, strokeIds: string[], bbox: DigitalBlock['bbox'], extra: Partial<DigitalBlock> = {}): DigitalBlock => ({
  id,
  kind: 'paragraph',
  text: `text ${id}`,
  bbox,
  strokeIds,
  confidence: 0.9,
  ...extra,
});

describe('computeDirtyRegions', () => {
  it('returns nothing when nothing changed', () => {
    const s = stroke(0, 0, 50, 0, 0, 'a');
    expect(computeDirtyRegions({ strokes: [s], blocks: [] }, new Set())).toEqual([]);
  });

  it('pulls in the existing block a new stroke touches, plus that block strokes', () => {
    const a = stroke(0, 0, 100, 0, 0, 'a');
    const b = stroke(110, 0, 200, 0, 1000, 'b');
    const far = stroke(0, 600, 100, 600, 2000, 'far');
    const existing = block('blk1', ['a'], { left: 0, top: -1, right: 101, bottom: 1 });
    const farBlock = block('blk2', ['far'], { left: 0, top: 599, right: 101, bottom: 601 });
    const regions = computeDirtyRegions({ strokes: [a, b, far], blocks: [existing, farBlock] }, new Set(['b']));
    expect(regions).toHaveLength(1);
    expect(regions[0].replacedBlockIds).toEqual(['blk1']);
    expect(regions[0].strokes.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('re-transcribes a block whose stroke was deleted even with no new ink', () => {
    const a = stroke(0, 0, 100, 0, 0, 'a');
    const existing = block('blk1', ['a', 'gone'], { left: 0, top: -1, right: 101, bottom: 1 });
    const regions = computeDirtyRegions({ strokes: [a], blocks: [existing] }, new Set(), new Set(['gone']));
    expect(regions).toHaveLength(1);
    expect(regions[0].replacedBlockIds).toEqual(['blk1']);
    expect(regions[0].strokes.map((s) => s.id)).toEqual(['a']);
  });

  it('merges two dirty clusters that overlap into one region', () => {
    const a = stroke(0, 0, 100, 0, 0, 'a');
    const b = stroke(20, 30, 120, 30, 100_000, 'b'); // far apart in time, close in space
    const regions = computeDirtyRegions({ strokes: [a, b], blocks: [] }, new Set(['a', 'b']));
    expect(regions).toHaveLength(1);
    expect(regions[0].strokes).toHaveLength(2);
  });
});

describe('buildStrokeGroups', () => {
  it('orders groups top-to-bottom and records written order', () => {
    const second = stroke(0, 100, 50, 100, 0, 'second-line-written-first');
    const first = stroke(0, 0, 50, 0, 10_000, 'first-line-written-second');
    const groups = buildStrokeGroups([second, first]);
    expect(groups.map((g) => g.strokeIds[0])).toEqual(['first-line-written-second', 'second-line-written-first']);
    expect(groups.map((g) => g.writtenOrder)).toEqual([1, 0]);
    expect(groups.map((g) => g.index)).toEqual([0, 1]);
  });
});

describe('rawToDigitalBlock', () => {
  it('uses stroke groups for bbox and stroke ids when given', () => {
    const groups = buildStrokeGroups([stroke(0, 0, 50, 0, 0, 'a'), stroke(0, 100, 50, 100, 5000, 'b')]);
    const blk = rawToDigitalBlock(
      { kind: 'paragraph', text: 'hi', bbox: { left: 0, top: 0, right: 0, bottom: 0 }, groupIndices: [1], confidence: 0.8 },
      groups,
      { left: -24, top: -24, right: 74, bottom: 124 },
      { width: 196, height: 296 },
      [],
    );
    expect(blk.strokeIds).toEqual(['b']);
    expect(blk.bbox.top).toBeCloseTo(99);
  });

  it('falls back to mapping image-pixel bbox into page space', () => {
    const s = stroke(10, 10, 40, 10, 0, 'a');
    const blk = rawToDigitalBlock(
      { kind: 'paragraph', text: 'hi', bbox: { left: 0, top: 0, right: 100, bottom: 50 }, groupIndices: [], confidence: 0.8 },
      [],
      { left: 0, top: 0, right: 200, bottom: 100 },
      { width: 400, height: 200 },
      [s],
    );
    expect(blk.bbox).toEqual({ left: 0, top: 0, right: 50, bottom: 25 });
    expect(blk.strokeIds).toEqual(['a']);
  });
});

describe('protectEditedBlocks', () => {
  it('keeps a corrected block whose strokes did not change and strips its strokes from incoming', () => {
    const edited = block('h', ['a', 'b'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'Backpropagation', userEdited: true });
    const other = block('p', ['c'], { left: 0, top: 40, right: 100, bottom: 60 });
    const reread = block('n1', ['a', 'b', 'c'], { left: 0, top: 0, right: 120, bottom: 60 }, { text: 'Back propagation and more' });
    const fresh = block('n2', ['d'], { left: 0, top: 80, right: 100, bottom: 100 });
    const r = protectEditedBlocks([edited, other], [reread, fresh], new Set(['d']));
    expect(r.replacedIds).toEqual(['p']);
    // n1 is mostly a re-read of the corrected strokes → dropped (its 'c' is re-grouped on the next pause)
    expect(r.incoming.map((b) => [b.id, b.strokeIds])).toEqual([['n2', ['d']]]);
    const merged = mergeBlocks([edited, other], r.replacedIds, r.incoming);
    expect(merged.find((b) => b.id === 'h')?.text).toBe('Backpropagation');
  });
  it('drops a re-read that is mostly the corrected strokes, keeps and trims a mostly-new block', () => {
    const edited = block('h', ['a', 'b'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'Backpropagation', userEdited: true });
    const mostlyOld = block('n1', ['a', 'b', 'c'], { left: 0, top: 0, right: 120, bottom: 40 }, { text: 'Back propagation and' });
    const mostlyNew = block('n2', ['a', 'c', 'd', 'e'], { left: 0, top: 0, right: 120, bottom: 60 }, { text: 'Backpropagation and more words' });
    const r = protectEditedBlocks([edited], [mostlyOld, mostlyNew], new Set(['c', 'd', 'e']));
    expect(r.incoming.map((b) => [b.id, b.strokeIds, b.text])).toEqual([['n2', ['c', 'd', 'e'], 'and more words']]);
  });
  it('only strips the corrected text as a whole word, never inside a new word', () => {
    const edited = block('h', ['a'], { left: 0, top: 0, right: 40, bottom: 20 }, { text: 'cat', userEdited: true });
    const mixed = block('n', ['a', 'b', 'c', 'd'], { left: 0, top: 0, right: 120, bottom: 20 }, { text: 'catalog' });
    const repeated = block('m', ['a', 'e', 'f', 'g'], { left: 0, top: 0, right: 120, bottom: 20 }, { text: 'Cat, dog' });
    const r = protectEditedBlocks([edited], [mixed, repeated], new Set(['b', 'c', 'd', 'e', 'f', 'g']));
    expect(r.incoming.map((b) => b.text)).toEqual(['catalog', ', dog']);
    const zh = protectEditedBlocks(
      [block('z', ['a'], { left: 0, top: 0, right: 40, bottom: 20 }, { text: '你好', userEdited: true })],
      [block('w', ['a', 'b', 'c', 'd'], { left: 0, top: 0, right: 120, bottom: 20 }, { text: '你好世界' })],
      new Set(['b', 'c', 'd']),
    );
    expect(zh.incoming.map((b) => b.text)).toEqual(['世界']);
  });
  it('lets a corrected block be re-read once its own strokes change', () => {
    const edited = block('h', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'fixed', userEdited: true });
    const r = protectEditedBlocks([edited], [block('n', ['a'], { left: 0, top: 0, right: 100, bottom: 20 })], new Set(['a']));
    expect(r.replacedIds).toEqual(['h']);
    expect(r.incoming).toHaveLength(1);
  });
});

describe('mergeBlocks', () => {
  const editedFigure: FigureInfo = {
    kind: 'flowchart', shapes: ['rectangle'], labels: ['Start', 'Work', 'custom label'],
    nodes: [{ id: 'n1', label: 'Start', shape: 'rectangle', group: 1, strokeIds: ['old-start'] }, { id: 'n2', label: 'Work', shape: 'rectangle', group: 2, strokeIds: ['old-work'] }, { id: 'gone', label: 'Removed' }],
    edges: [{ from: 'Start', to: 'Work', label: 'approved', kind: 'line' }], sequence: ['Start', 'Work', 'Removed'],
  };
  const redrawnFigure: FigureInfo = {
    kind: 'flowchart', shapes: ['ellipse', 'diamond'], labels: ['wrong start', 'wrong work', 'New'],
    nodes: [{ id: 'n2', label: 'wrong work', shape: 'ellipse', group: 2, parent: 'n1', strokeIds: ['new-work'] }, { id: 'n1', label: 'wrong start', shape: 'diamond', group: 1, strokeIds: ['new-start'] }, { id: 'n3', label: 'New', shape: 'rectangle', strokeIds: ['new-node'] }],
    edges: [{ from: 'wrong work', to: 'wrong start', label: 'wrong', kind: 'arrow' }, { from: 'wrong start', to: 'New', label: 'new edge', kind: 'line' }], sequence: ['wrong work', 'wrong start', 'New'],
  };
  const editedDiagram = () => block('edited', ['a', 'b'], { left: 0, top: 0, right: 100, bottom: 100 }, { kind: 'diagram', text: 'corrected caption', figure: editedFigure, userEdited: true });
  const redrawnDiagram = (text: string) => block('redraw', ['a', 'b', 'new-work'], { left: 0, top: 0, right: 110, bottom: 100 }, { kind: 'diagram', text, figure: redrawnFigure });

  it.each(['corrected caption', 'model caption'])('keeps corrected figure words after a redraw with %s', (caption) => {
    const before = structuredClone(editedFigure), redraw = structuredClone(redrawnFigure);
    const existing = editedDiagram(), incoming = redrawnDiagram(caption);
    const protectedResult = protectEditedBlocks([existing], [incoming], new Set(['a']));
    const result = mergeBlocks([existing], protectedResult.replacedIds, protectedResult.incoming)[0];
    expect(result).toMatchObject({ id: 'edited', text: 'corrected caption', userEdited: true });
    expect(result.figure).toEqual({ ...redrawnFigure, labels: editedFigure.labels,
      nodes: redrawnFigure.nodes!.map((n) => ({ ...n, label: n.id === 'n1' ? 'Start' : n.id === 'n2' ? 'Work' : 'New' })),
      edges: [{ from: 'Work', to: 'Start', label: 'approved', kind: 'arrow' }, { from: 'Start', to: 'New', label: 'new edge', kind: 'line' }], sequence: ['Start', 'Work', 'New'],
    });
    expect(editedFigure).toEqual(before);
    expect(redrawnFigure).toEqual(redraw);
  });
  it('updates geometry when new ink extends a corrected diagram without changing its old strokes', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    const protectedResult = protectEditedBlocks([existing], [incoming], new Set(['new-work']));
    expect(protectedResult.replacedIds).toEqual(['edited']);
    const result = mergeBlocks([existing], protectedResult.replacedIds, protectedResult.incoming)[0];
    expect(result.figure!.nodes!.map((n) => [n.id, n.label, n.strokeIds])).toEqual([
      ['n2', 'Work', ['new-work']], ['n1', 'Start', ['new-start']], ['n3', 'New', ['new-node']],
    ]);
  });
  it('matches edited words by ink when an inserted node renumbers the existing nodes', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    incoming.figure = { ...redrawnFigure, nodes: [
      { id: 'n1', label: 'New', strokeIds: ['inserted'] },
      { id: 'n2', label: 'wrong start', strokeIds: ['old-start'] },
      { id: 'n3', label: 'wrong work', strokeIds: ['old-work'] },
    ] };
    const result = mergeBlocks([existing], ['edited'], [incoming])[0].figure!;
    expect(result.nodes!.map((n) => n.label)).toEqual(['New', 'Start', 'Work']);
    incoming.figure.nodes = [{ id: 'n1', label: 'unrelated', strokeIds: ['unrelated'] }];
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.nodes![0].label).toBe('unrelated');
  });
  it('keeps unchanged node identities when shared ink makes overlap ambiguous', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { ...editedFigure, nodes: [
      { id: 'n1', label: 'Start', strokeIds: ['shared-a', 'shared-b'] },
      { id: 'n2', label: 'Work', strokeIds: ['shared-a', 'shared-b'] },
    ] };
    incoming.figure = { ...redrawnFigure, nodes: [
      { id: 'n2', label: 'wrong work', strokeIds: ['shared-b', 'shared-a'] },
      { id: 'n1', label: 'wrong start', strokeIds: ['shared-a', 'shared-b'] },
    ] };
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.nodes!.map((n) => n.label)).toEqual(['Work', 'Start']);
  });
  it('preserves edited table cells, including blanks, while using fresh values for new rows and columns', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'table', shapes: [], labels: [], edges: [], cells: [['item', 'qty'], ['kept', '']] };
    incoming.figure = { ...existing.figure, cells: [['item', 'qty'], ['kept', 'wrong']] };
    const cells = () => mergeBlocks([existing], ['edited'], [incoming])[0].figure!.cells;
    expect(cells()).toEqual([['item', 'qty'], ['kept', '']]);
    incoming.figure.cells = [['item', 'qty', 'status'], ['kept', 'wrong', 'more'], ['new row', '3', 'active']];
    expect(cells()).toEqual([['item', 'qty', 'status'], ['kept', '', 'more'], ['new row', '3', 'active']]);
    incoming.figure.cells = [];
    expect(cells()).toEqual([]);
  });
  it('anchors corrected table cells when a new left column shifts and reorders existing cells', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'table', shapes: [], labels: [], edges: [], cells: [
      ['item', 'qty'], ['apple', '12 corrected'], ['pear', ''],
    ] };
    incoming.figure = { ...existing.figure, cells: [
      ['id', 'item', 'qty'], ['p', 'pear', 'wrong pear'], ['a', 'apple', 'wrong apple'], ['n', 'new', '5'],
    ] };
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.cells).toEqual([
      ['id', 'item', 'qty'], ['p', 'pear', ''], ['a', 'apple', '12 corrected'], ['n', 'new', '5'],
    ]);
  });
  it.each([
    [['item', 'qty', 'qty'], ['apple', 'edited first', 'edited second']],
    [['item', 'qty'], ['apple', 'edited first'], ['apple', 'edited second']],
    [['different header', 'different quantity'], ['apple', 'edited']],
    [],
  ].map((cells) => ({ cells })))('keeps fresh values when table identities are missing or ambiguous: %j', ({ cells }) => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'table', shapes: [], labels: [], edges: [], cells };
    incoming.figure = { ...existing.figure, cells: [['item', 'qty', 'qty'], ['apple', 'fresh first', 'fresh second']] };
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.cells).toEqual(incoming.figure.cells);
  });
  it('matches corrected words by group and old label when node ids change', () => {
    const incoming = redrawnDiagram('model caption');
    incoming.figure = { ...redrawnFigure, nodes: [{ id: 'different', label: 'wrong work', group: 2, strokeIds: ['redrawn'] }, { id: 'other', label: 'Start' }], sequence: ['wrong work', 'Start'] };
    const result = mergeBlocks([editedDiagram()], ['edited'], [incoming])[0].figure!;
    expect(result.nodes).toEqual([{ id: 'different', label: 'Work', group: 2, strokeIds: ['redrawn'] }, { id: 'other', label: 'Start', strokeIds: ['old-start'] }]);
    expect(result.sequence).toEqual(['Start', 'Work']);
  });
  it('preserves independently corrected step words in their edited order', () => {
    const existing = editedDiagram();
    existing.figure = { ...editedFigure, nodes: editedFigure.nodes!.slice(0, 2), sequence: ['Begin here', 'Do work'] };
    const result = mergeBlocks([existing], ['edited'], [redrawnDiagram('model caption')])[0];
    expect(result.figure!.sequence).toEqual(['Begin here', 'Do work', 'New']);
  });
  it('keeps edited sequence omissions and appends only genuinely new nodes', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { ...editedFigure, sequence: ['Start'] };
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.sequence).toEqual(['Start', 'New']);
    existing.figure.sequence = [];
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.sequence).toEqual(['New']);
  });
  it('appends new messages between existing actors without restoring deliberately removed messages', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = {
      kind: 'sequence', shapes: [], labels: ['send', 'reply', 'cancelled'],
      nodes: [{ id: 'a', label: 'Client', strokeIds: ['client'] }, { id: 'b', label: 'Server', strokeIds: ['server'] }],
      edges: [{ from: 'Client', to: 'Server', label: 'send' }, { from: 'Server', to: 'Client', label: 'reply' }, { from: 'Client', to: 'Server', label: 'cancelled' }],
      sequence: ['reply', 'send'],
    };
    incoming.figure = { ...existing.figure, sequence: ['send', 'cancelled', 'reply', 'notify'],
      edges: [...existing.figure.edges, { from: 'Server', to: 'Client', label: 'notify' }],
    };
    const steps = () => mergeBlocks([existing], ['edited'], [incoming])[0].figure!.sequence;
    expect(steps()).toEqual(['reply', 'send', 'notify']);
    const next = mergeBlocks([existing], ['edited'], [incoming])[0];
    next.figure = { ...next.figure!, sequence: ['send'] };
    expect(mergeBlocks([next], [next.id], [incoming])[0].figure!.sequence).toEqual(['send']);
    existing.figure.sequence = [];
    expect(steps()).toEqual(['notify']);
  });
  it('appends a second identical message when it belongs to a new geometry arrow', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'sequence', shapes: [], labels: ['ack'],
      nodes: [{ id: 'a', label: 'Client' }, { id: 'b', label: 'Server' }],
      edges: [{ from: 'Server', to: 'Client', label: 'ack', strokeIds: ['arrow-1'] }],
      sequence: ['ack'], sequenceEdges: [0],
    };
    incoming.figure = { ...existing.figure,
      edges: [...existing.figure.edges, { from: 'Server', to: 'Client', label: 'ack', strokeIds: ['arrow-2'] }],
      sequence: ['ack', 'ack'], sequenceEdges: [0, 1],
    };
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.sequence).toEqual(['ack', 'ack']);
  });
  it('keeps a corrected non-node step without appending the original wording for the same arrow', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'sequence', shapes: [], labels: ['corrected reply'],
      nodes: [{ id: 'a', label: 'Client' }, { id: 'b', label: 'Server' }],
      edges: [{ from: 'Server', to: 'Client', strokeIds: ['arrow-1'] }],
      sequence: ['corrected reply'], sequenceEdges: [0],
    };
    incoming.figure = { ...existing.figure, labels: ['ack'], sequence: ['ack'],
      edges: [{ from: 'Server', to: 'Client', label: 'ack', strokeIds: ['arrow-1'] }],
    };
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.sequence).toEqual(['corrected reply']);
    incoming.figure.edges = [];
    incoming.figure.sequence = [];
    incoming.figure.sequenceEdges = [];
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.sequence).toEqual([]);
  });
  it.each([
    { oldInk: undefined, newInk: undefined },
    { oldInk: undefined, newInk: ['shaft', 'head'] },
    { oldInk: ['shaft', 'old-head'], newInk: ['shaft', 'new-head'] },
  ])('keeps corrected connector wording across renumbered endpoints and incomplete ink metadata: %j', ({ oldInk, newInk }) => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'sequence', shapes: [], labels: ['corrected reply'],
      nodes: [{ id: 'a', label: 'Client', strokeIds: ['client'] }, { id: 'b', label: 'Server', strokeIds: ['server'] }],
      edges: [{ from: 'b', to: 'a', label: 'corrected reply', strokeIds: oldInk }],
      sequence: ['corrected reply'], sequenceEdges: [0],
    };
    incoming.figure = { ...existing.figure,
      nodes: [{ id: 'c', label: 'wrong client', strokeIds: ['client'] }, { id: 'd', label: 'wrong server', strokeIds: ['server'] }],
      edges: [{ from: 'd', to: 'c', label: 'ack', strokeIds: newInk }], sequence: ['ack'], sequenceEdges: [0],
    };
    const result = () => mergeBlocks([existing], ['edited'], [incoming])[0].figure!;
    expect(result().edges[0].label).toBe('corrected reply');
    expect(result().sequence).toEqual(['corrected reply']);
    existing.figure.sequence = [];
    existing.figure.sequenceEdges = [];
    expect(result().sequence).toEqual([]);
  });
  it('uses arrow anchors for repeated-message removals, edited order and renumbered actors', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'sequence', shapes: [], labels: ['ack'],
      nodes: [{ id: 'a', label: 'Client', strokeIds: ['client'] }, { id: 'b', label: 'Server', strokeIds: ['server'] }],
      edges: ['first', 'second', 'third'].map((id) => ({ from: 'Server', to: 'Client', label: 'ack', strokeIds: [id, `${id}-head`] })),
      sequence: ['third corrected', 'second corrected'], sequenceEdges: [2, 1],
    };
    incoming.figure = { ...existing.figure,
      nodes: [{ id: 'c', label: 'wrong client', strokeIds: ['client'] }, { id: 'd', label: 'wrong server', strokeIds: ['server'] }],
      edges: ['first', 'second', 'third', 'fourth'].map((id) => ({ from: 'wrong server', to: 'wrong client', label: 'ack', strokeIds: [`${id}-head`, id] })),
      sequence: ['ack', 'ack', 'ack', 'ack'], sequenceEdges: [0, 1, 2, 3],
    };
    const out = mergeBlocks([existing], ['edited'], [incoming])[0];
    expect(out.figure!.sequence).toEqual(['third corrected', 'second corrected', 'ack']);
    expect(out.figure!.sequenceEdges).toEqual([2, 1, 3]);
    out.figure!.sequence = [];
    out.figure!.sequenceEdges = [];
    expect(mergeBlocks([out], [out.id], [incoming])[0].figure!.sequence).toEqual([]);
  });
  it('matches unanchored message occurrences as a multiset, retaining corrections and omissions', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'sequence', shapes: [], labels: [], edges: [], sequence: ['corrected ack'], sequenceBaseline: [{ text: 'ack', edge: null }, { text: 'ack', edge: null }] };
    incoming.figure = { ...existing.figure, sequence: ['ack', 'ack', 'ack'] };
    const out = mergeBlocks([existing], ['edited'], [incoming])[0];
    expect(out.figure!.sequence).toEqual(['corrected ack', 'ack']);
    out.figure!.sequence = [];
    out.figure!.sequenceEdges = [];
    expect(mergeBlocks([out], [out.id], [incoming])[0].figure!.sequence).toEqual([]);
  });
  it('uses count-aware fallback for legacy steps and binds them when arrow anchors become available', () => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'sequence', shapes: [], labels: ['ack'], edges: [], sequence: ['ack'] };
    incoming.figure = { ...existing.figure,
      edges: ['one', 'two'].map(id => ({ from: 'server', to: 'client', label: 'ack', strokeIds: [id] })),
      sequence: ['ack', 'ack'], sequenceEdges: [0, 1],
    };
    const out = mergeBlocks([existing], ['edited'], [incoming])[0];
    expect(out.figure!.sequence).toEqual(['ack', 'ack']);
    expect(out.figure!.sequenceEdges).toEqual([0, 1]);
    out.figure!.sequence = ['fixed'];
    out.figure!.sequenceEdges = [0];
    incoming.figure.edges.push({ from: 'server', to: 'client', label: 'ack', strokeIds: ['three'] });
    incoming.figure.sequence!.push('ack');
    incoming.figure.sequenceEdges!.push(2);
    expect(mergeBlocks([out], [out.id], [incoming])[0].figure!.sequence).toEqual(['fixed', 'ack']);
  });
  it.each([
    { labels: ['removed'], edges: [] },
    { labels: [], edges: [{ from: 'a', to: 'b', label: 'removed' }] },
  ])('uses retained figure words to recognize deliberate non-node step removals: %j', (words) => {
    const existing = editedDiagram(), incoming = redrawnDiagram('model caption');
    existing.figure = { kind: 'sequence', shapes: [], ...words, sequence: ['keep'] };
    incoming.figure = { ...existing.figure, sequence: ['removed', 'keep', 'new'] };
    expect(mergeBlocks([existing], ['edited'], [incoming])[0].figure!.sequence).toEqual(['keep', 'new']);
  });
  it('keeps unmatched new nodes and geometry when no corrected node matches', () => {
    const incoming = redrawnDiagram('model caption');
    incoming.figure = { kind: 'shape', shapes: ['triangle'], labels: ['new word'], nodes: [{ id: 'new', label: 'new word', strokeIds: ['new-shape'] }], edges: [], sequence: ['new word'] };
    const result = mergeBlocks([editedDiagram()], ['edited'], [incoming])[0];
    expect(result.figure).toEqual({ ...incoming.figure, labels: editedFigure.labels });
    const noFigure = { ...incoming, figure: undefined };
    expect(mergeBlocks([editedDiagram()], ['edited'], [noFigure])[0].figure).toEqual(editedFigure);
  });
  it('unions persisted node strokes when merging figure descriptions without mutating inputs', () => {
    const a: FigureInfo = { kind: 'shape', shapes: [], labels: ['node'], nodes: [{ id: 'n1', label: 'node', strokeIds: ['shape', 'label'] }], edges: [] };
    const b: FigureInfo = { ...a, nodes: [{ id: 'n1', label: 'node', strokeIds: ['label', 'more'] }] };
    expect(mergeFigures(a, b).nodes![0].strokeIds).toEqual(['shape', 'label', 'more']);
    expect(a.nodes![0].strokeIds).toEqual(['shape', 'label']);
    expect(b.nodes![0].strokeIds).toEqual(['label', 'more']);
  });
  it('keeps ids for unchanged text and preserves user edits', () => {
    const old1 = block('old1', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'same' });
    const old2 = block('old2', ['b'], { left: 0, top: 40, right: 100, bottom: 60 }, { text: 'my fix', userEdited: true });
    const kept = block('kept', ['z'], { left: 0, top: 500, right: 100, bottom: 520 });
    const new1 = block('n1', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'same' });
    const new2 = block('n2', ['b'], { left: 0, top: 40, right: 100, bottom: 60 }, { text: 'model guess' });
    const merged = mergeBlocks([old1, old2, kept], ['old1', 'old2'], [new1, new2]);
    expect(merged.map((b) => b.id)).toEqual(['old1', 'old2', 'kept']);
    expect(merged[1].text).toBe('my fix');
    expect(merged[1].userEdited).toBe(true);
  });

  it('gives each replaced id to at most one incoming block', () => {
    const old1 = block('old1', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'same' });
    const new1 = block('n1', ['a'], { left: 0, top: 0, right: 100, bottom: 20 }, { text: 'same' });
    const new2 = block('n2', ['b'], { left: 0, top: 40, right: 100, bottom: 60 }, { text: 'same' });
    const ids = mergeBlocks([old1], ['old1'], [new1, new2]).map((b) => b.id);
    expect(ids).toEqual(['old1', 'n2']);
  });

  it('puts footnote definitions last', () => {
    const def = block('d', [], { left: 0, top: 0, right: 10, bottom: 10 }, { kind: 'footnote_def', marker: '*' });
    const para = block('p', [], { left: 0, top: 100, right: 10, bottom: 110 });
    expect(mergeBlocks([], [], [def, para]).map((b) => b.id)).toEqual(['p', 'd']);
  });
});

describe('shape hints on stroke groups', () => {
  it('attaches geometry hints and a shared figure to the groups of a drawing', () => {
    resetSynthetic();
    const strokes = [rect(0, 0, 120, 80, 0), ...arrowTwoStrokes(125, 40, 235, 40, 6000), rect(240, 0, 360, 80, 12000), ...textLine(0, 160, 14, 18, 30000)];
    const groups = buildStrokeGroups(strokes);
    const drawn = groups.filter((g) => g.figure);
    expect(drawn.length).toBeGreaterThanOrEqual(2);
    expect(new Set(drawn.map((g) => g.figure!.id)).size).toBe(1);
    expect(drawn[0].figure!.kind).toBe('flowchart');
    expect(drawn.some((g) => /rectangle|square/.test(g.hint ?? ''))).toBe(true);
    const text = groups.find((g) => g.strokeIds.includes(strokes[strokes.length - 1].id))!;
    expect(text.figure).toBeUndefined();
    expect(text.hint).toMatch(/looks like text/);
  });
});

describe('reconcileFigureBlocks', () => {
  const scene = () => {
    resetSynthetic();
    const box1 = rect(0, 0, 120, 80, 0);
    const arrow = arrowTwoStrokes(125, 40, 235, 40, 6000);
    const box2 = rect(240, 0, 360, 80, 12000);
    const label = textLine(30, 50, 3, 16, 20000);
    const note = textLine(0, 160, 14, 18, 30000);
    const strokes = [box1, ...arrow, box2, ...label, ...note];
    const groups = buildStrokeGroups(strokes);
    const groupOf = (s: InkStroke) => groups.find((g) => g.strokeIds.includes(s.id))!;
    const block = (kind: DigitalBlock['kind'], text: string, gs: ReturnType<typeof groupOf>[], extra: Partial<DigitalBlock> = {}): DigitalBlock => ({
      id: newId('blk'),
      kind,
      text,
      bbox: gs.map((g) => g.bbox).reduce(unionBounds),
      strokeIds: gs.flatMap((g) => g.strokeIds),
      confidence: 0.7,
      ...extra,
    });
    return { strokes, groups, groupOf, block, box1, arrow, box2, label, note };
  };

  it('puts the figure groups the geometry found in one diagram block', () => {
    const { groups, groupOf, box1, arrow, box2, label, note } = scene();
    const figGroups = new Set([box1, ...arrow, box2, ...label].map((s) => groupOf(s).index));
    expect(figGroups.size).toBeGreaterThanOrEqual(2);
    expect(figGroups.has(groupOf(note[0]).index)).toBe(false);
    expect(groups.filter((g) => g.figure).map((g) => g.index).sort()).toEqual([...figGroups].sort());
  });

  it('merges a drawing the model split into paragraphs into one diagram block and keeps the note beside it as text', () => {
    const { strokes, groups, groupOf, block, box1, arrow, box2, label, note } = scene();
    const incoming = [
      block('paragraph', 'II', [groupOf(box1)]),
      block('paragraph', '-->', [...new Set(arrow.map(groupOf))]),
      block('paragraph', 'Il', [groupOf(box2)]),
      block('paragraph', 'go', [groupOf(label[0])]),
      block('paragraph', 'some notes written beside it', [groupOf(note[0])]),
    ];
    const out = reconcileFigureBlocks(incoming, groups, strokes);
    expect(out).toHaveLength(2);
    const diagram = out.find((b) => b.kind === 'diagram')!;
    const text = out.find((b) => b.kind === 'paragraph')!;
    expect(text.text).toBe('some notes written beside it');
    expect(diagram.strokeIds.sort()).toEqual([box1, ...arrow, box2, ...label].map((s) => s.id).sort());
    expect(diagram.figure!.kind).toBe('flowchart');
    expect(diagram.figure!.labels).toEqual(['go']);
    expect(diagram.figure!.edges).toEqual([{ from: 'go', to: 'rectangle 2', kind: 'arrow', inferred: true }]);
    expect(diagram.text).toMatch(/^Shape: .*Labels: go/);
  });

  it('keeps the model diagram block and its figure, adding labels it read as separate text', () => {
    const { strokes, groups, groupOf, block, box1, arrow, box2, label, note } = scene();
    const incoming = [
      block('diagram', 'Shape: two boxes joined by an arrow. Labels: go. Relations: go → B.', [groupOf(box1), ...new Set(arrow.map(groupOf)), groupOf(box2)], {
        figure: { kind: 'flowchart', shapes: ['two rectangles', 'arrow'], labels: ['go'], edges: [{ from: 'go', to: 'B' }] },
      }),
      block('paragraph', 'go', [groupOf(label[0])]),
      block('paragraph', 'some notes written beside it', [groupOf(note[0])]),
    ];
    const out = reconcileFigureBlocks(incoming, groups, strokes);
    expect(out.map((b) => b.kind).sort()).toEqual(['diagram', 'paragraph']);
    const diagram = out.find((b) => b.kind === 'diagram')!;
    expect(diagram.id).toBe(incoming[0].id);
    expect(diagram.text).toMatch(/^Shape: two boxes/);
    expect(diagram.figure).toMatchObject({ kind: 'flowchart', labels: ['go'], edges: [{ from: 'go', to: 'rectangle 2', kind: 'arrow', inferred: true }] });
    expect(diagram.figure!.shapes).toEqual(expect.arrayContaining(['two rectangles', 'arrow']));
    expect(diagram.figure!.edges).toHaveLength(1);
    expect(diagram.figure!.nodes?.map((n) => n.label)).toEqual(['go', 'rectangle 2']);
    expect(diagram.strokeIds).toContain(label[0].id);
  });

  it('creates the diagram block when the model skipped the drawing entirely', () => {
    const { strokes, groups, groupOf, block, note } = scene();
    const out = reconcileFigureBlocks([block('paragraph', 'some notes written beside it', [groupOf(note[0])])], groups, strokes);
    expect(out.map((b) => b.kind)).toEqual(['diagram', 'paragraph']);
    expect(out[0].text).toMatch(/^Shape: /);
    expect(out[0].figure!.shapes.length).toBeGreaterThan(0);
  });

  it('splits a text block that the model lumped with part of the drawing', () => {
    const { strokes, groups, groupOf, block, box2, note } = scene();
    const lumped = block('paragraph', 'some notes written beside it', [groupOf(note[0]), groupOf(box2)]);
    // note has 14 strokes, box2 has 1: mostly text, so it stays text minus the drawing stroke.
    const out = reconcileFigureBlocks([lumped], groups, strokes);
    const text = out.find((b) => b.kind === 'paragraph')!;
    expect(text.text).toBe('some notes written beside it');
    expect(text.strokeIds).not.toContain(box2.id);
    expect(out.find((b) => b.kind === 'diagram')!.strokeIds).toContain(box2.id);
  });

  it('keeps a label the model read on the group that also holds its box', () => {
    resetSynthetic();
    const box1 = rect(0, 0, 120, 80, 0);
    const l1 = textLine(25, 50, 5, 16, 1000);
    const arrow = arrowTwoStrokes(125, 40, 235, 40, 9000);
    const box2 = rect(240, 0, 360, 80, 12000);
    const l2 = textLine(265, 50, 3, 16, 13000);
    const strokes = [box1, ...l1, ...arrow, box2, ...l2];
    const groups = buildStrokeGroups(strokes);
    const groupOf = (s: InkStroke) => groups.find((g) => g.strokeIds.includes(s.id))!;
    expect(groupOf(box1)).toBe(groupOf(l1[0]));
    const block = (text: string, g: StrokeGroupMeta): DigitalBlock => ({ id: text, kind: 'paragraph', text, bbox: g.bbox, strokeIds: g.strokeIds, confidence: 0.9 });
    const out = reconcileFigureBlocks([block('start', groupOf(box1)), block('end', groupOf(box2))], groups, strokes);
    const diagram = out.find((b) => b.kind === 'diagram');
    expect(diagram?.figure?.labels).toEqual(['start', 'end']);
    expect(diagram?.figure?.edges).toEqual([{ from: 'start', to: 'end', kind: 'arrow', inferred: true }]);
  });

  it('keeps every digit of a numeric label', () => {
    const { strokes, groups, groupOf, block, label } = scene();
    const out = reconcileFigureBlocks([block('paragraph', '0', [groupOf(label[0])]), block('list', '- 1', [groupOf(label[0])]), block('heading', '  # Start', [groupOf(label[0])])], groups, strokes);
    expect(out.find((b) => b.kind === 'diagram')?.figure?.labels).toEqual(['0', '1', 'Start']);
  });

  it('drops an empty diagram block the model put on text beside the figure', () => {
    const { strokes, groups, groupOf, block, box1, note } = scene();
    const out = reconcileFigureBlocks([block('diagram', 'Shape: box.', [groupOf(box1)]), block('diagram', '', [groupOf(note[0])])], groups, strokes);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('diagram');
    expect(out[0].strokeIds).not.toContain(note[0].id);
  });

  it('keeps drawn edges and discards model-only edges when geometry found relations', () => {
    const { groups, strokes, groupOf, block, box1, arrow, box2, label } = scene();
    const second = textLine(270, 50, 3, 16, 40000);
    const all = [...strokes, ...second];
    const groups2 = buildStrokeGroups(all);
    const g = (s: InkStroke) => groups2.find((x) => x.strokeIds.includes(s.id))!;
    void groups;
    void groupOf;
    const diagram = block('diagram', 'Shape: two boxes.', [g(box1), g(arrow[0]), g(box2)], {
      figure: { kind: 'flowchart', shapes: ['box', 'box'], labels: ['go', 'stop'], edges: [{ from: 'stop', to: 'elsewhere' }] },
    });
    const out = reconcileFigureBlocks([diagram, block('paragraph', 'go', [g(label[0])]), block('paragraph', 'stop', [g(second[0])])], groups2, all);
    const fig = out.find((b) => b.kind === 'diagram')!.figure!;
    expect(fig.edges).toEqual([{ from: 'go', to: 'stop', kind: 'arrow', inferred: true }]);
    expect(fig.nodes?.map((n) => n.label)).toEqual(['go', 'stop']);
    expect(fig.sequence).toEqual(['go', 'stop']);
  });

  it('folds diagram blocks while retaining geometry edges even when their nodes are unnamed', () => {
    const { groups, strokes, groupOf, block, box1, arrow, box2, label } = scene();
    const d1 = block('diagram', 'Shape: a box.', [groupOf(box1), groupOf(label[0])], { figure: { kind: 'flowchart', shapes: ['box'], labels: ['go'], edges: [] } });
    const d2 = block('diagram', '', [groupOf(arrow[0]), groupOf(box2)], { figure: { kind: 'other', shapes: ['box', 'arrow'], labels: ['B'], edges: [{ from: 'go', to: 'B' }] } });
    const out = reconcileFigureBlocks([d1, d2], groups, strokes);
    const diagrams = out.filter((b) => b.kind === 'diagram');
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].text).toBe('Shape: a box.');
    expect(diagrams[0].figure).toMatchObject({ kind: 'flowchart', labels: ['go', 'B'] });
    expect(diagrams[0].figure!.edges).toEqual([{ from: 'rectangle 1', to: 'rectangle 2', kind: 'arrow', inferred: true }]);
  });

  it('completes a model edge with the label and kind the geometry read for it', () => {
    const geo = { nodes: [{ id: 'n1', label: 'a' }, { id: 'n2', label: 'b' }], edges: [{ from: 'a', to: 'b', kind: 'arrow' as const, label: 'yes' }], sequence: ['a', 'b'], unnamed: [] };
    const hint = { id: 0, groupIndices: [0], kind: 'flowchart' as const, shapes: [], labelGroups: [], labelInside: {}, labelHostGroups: [], edges: [], nodes: [], relations: [], order: [], orderBasis: '', summary: '' };
    const fig = mergeWithGeometry({ kind: 'flowchart', shapes: [], labels: ['a', 'b'], edges: [{ from: 'A', to: 'b' }] }, hint, ['a', 'b'], geo);
    expect(fig.edges).toEqual([{ from: 'a', to: 'b', label: 'yes', kind: 'arrow', inferred: true }]);
    expect(fig.sequence).toEqual(['a', 'b']);
    expect(fig.nodes).toEqual(geo.nodes);
  });

  it('retains geometry edges to unnamed shapes instead of unsupported model edges', () => {
    const geo = { nodes: [{ id: 'n1', label: 'a' }, { id: 'n2', label: 'rectangle 2' }], edges: [{ from: 'a', to: 'rectangle 2', kind: 'arrow' as const }], unnamed: ['rectangle 2'] };
    const hint = { id: 0, groupIndices: [0], kind: 'flowchart' as const, shapes: ['rectangle'], labelGroups: [], labelInside: {}, labelHostGroups: [], edges: [], nodes: [], relations: [], order: [], orderBasis: '', summary: '' };
    expect(mergeWithGeometry({ kind: 'flowchart', shapes: [], labels: ['a'], edges: [{ from: 'a', to: 'c' }] }, hint, ['a'], geo).edges).toEqual([{ from: 'a', to: 'rectangle 2', kind: 'arrow', inferred: true }]);
    expect(mergeWithGeometry(undefined, hint, ['a'], geo).edges).toEqual([{ from: 'a', to: 'rectangle 2', kind: 'arrow', inferred: true }]);
    expect(mergeWithGeometry({ kind: 'table', shapes: [], labels: [], edges: [] }, hint, [], { ...geo, cells: [['x', ''], ['', '']] }).cells).toEqual([['x', ''], ['', '']]);
  });

  it('gives a stroke-less model diagram to the figure it overlaps and names geometry nodes with the model words by hint id', () => {
    const { groups, strokes, block, groupOf, box1 } = scene();
    const figBox = groups.filter((g) => g.figure).map((g) => g.bbox).reduce(unionBounds);
    const orphan: DigitalBlock = { ...block('diagram', 'Shape: two boxes.', [groupOf(box1)]), strokeIds: [], bbox: figBox, figure: { kind: 'flowchart', shapes: [], labels: ['go', 'stop'], edges: [], nodes: [{ id: 'n1', label: 'go' }, { id: 'n2', label: 'stop' }] } };
    const out = reconcileFigureBlocks([orphan], groups, strokes);
    const diagrams = out.filter((b) => b.kind === 'diagram');
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].strokeIds.length).toBeGreaterThan(0);
    expect(diagrams[0].figure).toMatchObject({ labels: ['go', 'stop'], edges: [{ from: 'go', to: 'stop', kind: 'arrow', inferred: true }], sequence: ['go', 'stop'] });
  });

  it('resolves ids without model nodes through geometry and prefers text read on label groups', () => {
    const { groups, strokes, block, groupOf, box1, label } = scene();
    const prior = normaliseFigure({ kind: 'flowchart', labels: ['N1'], sequence: ['n1', 'n2'], edges: [{ from: 'n2', to: 'N1', label: 'back' }] });
    const out = reconcileFigureBlocks([block('diagram', '', [groupOf(box1)], { figure: prior }), block('paragraph', 'go', [groupOf(label[0])])], groups, strokes);
    const figure = out.find((b) => b.kind === 'diagram')!.figure!;
    expect(figure.labels).toContain('go');
    expect(figure.labels).not.toContain('N1');
    expect(figure.sequence).toEqual(['go', 'rectangle 2']);
    expect(figure.edges).toEqual([{ from: 'rectangle 2', to: 'go', label: 'back', kind: 'arrow', inferred: true }]);
  });

  it('turns a model "table" text block on a drawn grid into the figure cells', () => {
    const grid = [...rectLines(0, 0, 300, 150, 0), line(0, 50, 300, 50, 6000), line(0, 100, 300, 100, 12000), line(150, 0, 150, 150, 18000)];
    const words = [...textLine(40, 30, 3, 14, 30000), ...textLine(190, 30, 3, 14, 40000), ...textLine(40, 80, 3, 14, 50000)];
    const strokes = [...grid, ...words];
    const groups = buildStrokeGroups(strokes);
    expect(groups.find((g) => g.figure)!.figure!.kind).toBe('table');
    const wordGroups = groups.filter((g) => g.strokeIds.some((id) => words.some((w) => w.id === id)));
    const tableBlock: DigitalBlock = { id: 'tb', kind: 'table', text: 'name qty\nnut', bbox: wordGroups.map((g) => g.bbox).reduce(unionBounds), strokeIds: wordGroups.flatMap((g) => g.strokeIds), confidence: 0.8 };
    const out = reconcileFigureBlocks([tableBlock], groups, strokes);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('diagram');
    expect(out[0].figure!.cells).toEqual([['name', 'qty'], ['nut', ''], ['', '']]);
    expect(out[0].figure!.labels).toEqual(expect.arrayContaining(['name', 'qty', 'nut']));
  });

  it('aligns model nodes to geometry nodes by label group, and lets geometry decide shapes and nesting', () => {
    const geo = { nodes: [{ id: 'n1', label: 'circle 1', shape: 'circle', group: 1 }, { id: 'n2', label: 'circle 2', shape: 'circle', group: 8 }], edges: [{ from: 'circle 2', to: 'circle 1', kind: 'line' as const }], unnamed: ['circle 1', 'circle 2'] };
    const hint = { id: 0, groupIndices: [0], kind: 'mindmap' as const, shapes: [], labelGroups: [], labelInside: {}, labelHostGroups: [], edges: [], nodes: [], relations: [], order: [], orderBasis: '', summary: '' };
    const prior = { kind: 'sketch' as const, shapes: [], labels: ['topic', 'a'], edges: [], nodes: [{ id: 'n1', label: 'topic', shape: 'box 2', group: 8, parent: 'n2' }, { id: 'n2', label: 'a', group: 1 }] };
    const fig = mergeWithGeometry(prior, hint, ['topic', 'a'], geo);
    expect(fig.edges).toEqual([{ from: 'topic', to: 'a', kind: 'line', inferred: true }]);
    expect(fig.nodes).toEqual([{ id: 'n1', label: 'a', shape: 'circle', group: 1 }, { id: 'n2', label: 'topic', shape: 'circle', group: 8, parent: 'n1' }]);
    // A wrong group number on the model side still lets the hint id name the node.
    const byId = mergeWithGeometry({ ...prior, nodes: [{ id: 'n1', label: 'top', group: 99 }, { id: 'n2', label: 'side', group: 98 }] }, hint, [], geo);
    expect(byId.edges[0]).toMatchObject({ from: 'side', to: 'top' });
  });

  it('keeps differently labelled edges when folding diagram blocks, and leaves a far-away stroke-less diagram alone', () => {
    const merged = mergeFigures({ kind: 'flowchart', shapes: [], labels: [], edges: [{ from: 'a', to: 'b', label: 'yes' }] }, { kind: 'flowchart', shapes: [], labels: [], edges: [{ from: 'a', to: 'b', label: 'no' }, { from: 'a', to: 'b', label: 'yes' }] });
    expect(merged.edges).toEqual([{ from: 'a', to: 'b', label: 'yes' }, { from: 'a', to: 'b', label: 'no' }]);
    expect(mergeFigures({ kind: 'flowchart', shapes: [], labels: [], edges: [{ from: 'a', to: 'b' }] }, { kind: 'flowchart', shapes: [], labels: [], edges: [{ from: 'a', to: 'b', label: 'yes' }] }).edges).toEqual([{ from: 'a', to: 'b', label: 'yes' }]);
    const { groups, strokes } = scene();
    const far: DigitalBlock = { id: 'far', kind: 'diagram', text: 'Shape: a sun.', bbox: { left: 2000, top: 2000, right: 2100, bottom: 2100 }, strokeIds: [], confidence: 0.5, figure: { kind: 'sketch', shapes: ['sun'], labels: [], edges: [] } };
    const out = reconcileFigureBlocks([far], groups, strokes);
    expect(out.filter((b) => b.kind === 'diagram')).toHaveLength(2);
    expect(out.find((b) => b.id === 'far')!.figure!.shapes).toEqual(['sun']);
  });

  it('is a no-op without figures', () => {
    const strokes = [stroke(0, 0, 50, 0, 0, 'a')];
    const groups = buildStrokeGroups(strokes);
    const blocks: DigitalBlock[] = [{ id: 'x', kind: 'paragraph', text: 'hi', bbox: groups[0].bbox, strokeIds: ['a'], confidence: 1 }];
    expect(reconcileFigureBlocks(blocks, groups, strokes)).toBe(blocks);
  });
});
