import { beforeEach, describe, expect, it } from 'vitest';
import { analyseInk, classifyStroke, figureFromGeometry, type FigureHint } from './shapeHints';
import { buildStrokeGroups } from '../transcribe/regions';
import { resetSynthetic } from '../__tests__/shapes';
import { arcPath, arrowsBetweenWords, curvedArrow, flowchartWithLoop, mindMap, nestedBoxes, sequenceDiagram, stateMachine, tableGrid, twoFiguresWithNotes, type Scene } from '../__tests__/complexScenes';

beforeEach(() => resetSynthetic());

/** Analyse a scene; `labelFor` names a group after the scene label whose strokes it holds. */
function run(scene: Scene) {
  const groups = buildStrokeGroups(scene.strokes);
  const analysis = analyseInk(scene.strokes, groups);
  const labelFor = (groupIndex: number) => {
    const ids = groups[groupIndex]?.strokeIds ?? [];
    return Object.entries(scene.labels).find(([, sids]) => sids.some((id) => ids.includes(id)))?.[0];
  };
  const named = (fig: FigureHint) => figureFromGeometry(fig, labelFor);
  return { groups, analysis, labelFor, named };
}

const edgeStrings = (fig: ReturnType<typeof figureFromGeometry>) => fig.edges.map((e) => `${e.from}${e.kind === 'self-loop' ? '↺' : e.kind === 'line' ? '—' : '→'}${e.kind === 'self-loop' ? '' : e.to}${e.label ? `(${e.label})` : ''}`);

describe('curved arrows', () => {
  it('classifies a bending stroke that ends in a V as a curved arrow with the head at the V', () => {
    const s = classifyStroke(curvedArrow(arcPath(200, 200, 80, 180, 0), 0));
    expect(s.kind).toBe('arrow');
    expect(s.curved).toBe(true);
    expect(s.head!.x).toBeGreaterThan(270);
    expect(s.tail!.x).toBeLessThan(130);
  });
});

describe('flowchart with a back-edge', () => {
  it('finds the nodes, the decision diamond, the edge label, the back-edge and the step order', () => {
    const { analysis, named } = run(flowchartWithLoop());
    expect(analysis.figures).toHaveLength(1);
    const fig = analysis.figures[0];
    expect(fig.kind).toBe('flowchart');
    expect(fig.nodes.map((n) => n.shape)).toEqual(['rectangle', 'diamond', 'rectangle']);
    expect(fig.nodes[1].decision).toBe(true);
    const f = named(fig);
    expect(f.nodes!.map((n) => n.label)).toEqual(['start', 'ok?', 'end']);
    expect(edgeStrings(f)).toEqual(['start→ok?', 'ok?→end(yes)', 'end→start']);
    expect(fig.relations[2].back).toBe(true);
    expect(f.sequence).toEqual(['start', 'ok?', 'end']);
    expect(fig.summary).toMatch(/n1 rectangle .*n2 decision diamond .*n3 rectangle/);
    expect(fig.summary).toMatch(/n3 → n1 \(back-edge\)/);
    expect(fig.summary).toMatch(/step order \(arrow order\): n1, n2, n3/);
  });
});

describe('state machine with a self-loop', () => {
  it('reports the self-loop on the right state and keeps the transition', () => {
    const { analysis, named } = run(stateMachine());
    expect(analysis.figures).toHaveLength(1);
    const f = named(analysis.figures[0]);
    expect(f.nodes!.map((n) => n.label)).toEqual(['idle', 'run']);
    expect(edgeStrings(f)).toEqual(['idle→run', 'run↺']);
    expect(analysis.figures[0].summary).toMatch(/n2 ↺ self-loop/);
  });
});

describe('nested boxes', () => {
  it('nests the inner boxes under the outer one, names the outer box by its title, and orders only the steps', () => {
    const { analysis, named } = run(nestedBoxes());
    expect(analysis.figures).toHaveLength(1);
    const fig = analysis.figures[0];
    const f = named(fig);
    const byLabel = Object.fromEntries(f.nodes!.map((n) => [n.label, n]));
    expect(Object.keys(byLabel).sort()).toEqual(['in', 'out', 'system']);
    expect(byLabel.in.parent).toBe(byLabel.system.id);
    expect(byLabel.out.parent).toBe(byLabel.system.id);
    expect(byLabel.system.parent).toBeUndefined();
    expect(edgeStrings(f)).toEqual(['in→out']);
    expect(f.sequence).toEqual(['in', 'out']);
    expect(fig.summary).toMatch(/nested: n2 inside n1, n3 inside n1/);
  });
});

describe('sequence diagram', () => {
  it('detects lifelines named by the text above them and orders the messages top to bottom', () => {
    const { analysis, named } = run(sequenceDiagram());
    expect(analysis.figures).toHaveLength(1);
    const fig = analysis.figures[0];
    expect(fig.kind).toBe('sequence');
    expect(fig.nodes.map((n) => n.shape)).toEqual(['lifeline', 'lifeline']);
    const f = named(fig);
    expect(f.nodes!.map((n) => n.label)).toEqual(['client', 'server']);
    expect(edgeStrings(f)).toEqual(['client→server(req)', 'server→client(resp)']);
    expect(fig.summary).toMatch(/lifelines .*left→right/);
    expect(fig.summary).toMatch(/messages in time order/);
  });
});

describe('table grid', () => {
  it('detects the grid, sizes the cells and places the text in them', () => {
    const { analysis, named } = run(tableGrid());
    expect(analysis.figures).toHaveLength(1);
    const fig = analysis.figures[0];
    expect(fig.kind).toBe('table');
    expect(fig.cells).toHaveLength(3);
    expect(fig.cells![0]).toHaveLength(2);
    const f = named(fig);
    expect(f.cells).toEqual([['name', 'qty'], ['nut', ''], ['', '12']]);
    expect(fig.summary).toMatch(/table grid 3 rows × 2 columns/);
  });
});

describe('mind map', () => {
  it('finds the hub and its branches joined by plain lines, clockwise from the top', () => {
    const { analysis, named } = run(mindMap());
    expect(analysis.figures).toHaveLength(1);
    const fig = analysis.figures[0];
    expect(fig.kind).toBe('mindmap');
    const f = named(fig);
    expect(f.edges.every((e) => e.kind === 'line')).toBe(true);
    expect(f.edges).toHaveLength(4);
    expect(f.sequence).toEqual(['topic', 'a', 'b', 'c', 'd']);
  });
});

describe('arrows between bare words', () => {
  it('makes text nodes of the words an arrow leaves and points at', () => {
    const { analysis, named } = run(arrowsBetweenWords());
    expect(analysis.figures).toHaveLength(1);
    const fig = analysis.figures[0];
    expect(fig.nodes.map((n) => n.shape)).toEqual(['text', 'text', 'text']);
    const f = named(fig);
    expect(edgeStrings(f)).toEqual(['load→train', 'train→eval']);
    expect(f.sequence).toEqual(['load', 'train', 'eval']);
  });
});

describe('two figures on one page', () => {
  it('keeps the flowchart and the circle apart and leaves the notes line out of both', () => {
    const scene = twoFiguresWithNotes();
    const { analysis, groups } = run(scene);
    expect(analysis.figures).toHaveLength(2);
    const [flow, shape] = analysis.figures;
    expect(flow.kind).toBe('flowchart');
    expect(shape.kind).toBe('shape');
    const notesGroup = groups.find((g) => g.strokeIds.includes(scene.labels.notes[0]))!;
    expect(flow.groupIndices).not.toContain(notesGroup.index);
    expect(shape.groupIndices).not.toContain(notesGroup.index);
    expect(notesGroup.hint).toMatch(/looks like text/);
  });
});
