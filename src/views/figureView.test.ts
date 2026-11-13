import { describe, expect, it } from 'vitest';
import type { FigureInfo } from '../model/page';
import { edgeMarks, figureCorrectionText, figureToMermaid, mindMapLayout, renameFigureLabel, shapeGlyph, stepNode } from './figureView';
import { glossaryFromCorrections } from '../profile/handwritingProfile';

const figure = (overrides: Partial<FigureInfo> = {}): FigureInfo => ({ kind: 'flowchart', shapes: [], labels: [], edges: [], ...overrides });

describe('figure presentation', () => {
  it('lays out every depth, disconnected component and cycle of H-A-B-C-D plus X-Y', () => {
    const fig = figure({ kind: 'mindmap', nodes: [{ id: 'h', label: 'H' }, { id: 'a', label: 'A', parent: 'h' }, { id: 'b', label: 'B', parent: 'a' }, { id: 'c', label: 'C', parent: 'b' }, { id: 'd', label: 'D', parent: 'c' }, { id: 'x', label: 'X' }, { id: 'y', label: 'Y', parent: 'x' }], edges: [{ from: 'h', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'c', to: 'a', label: 'cycle' }, { from: 'x', to: 'y' }] });
    const map = mindMapLayout(fig)!;
    expect(JSON.stringify(map.spokes)).toContain('"label":"D"');
    expect(map).toHaveProperty('other', [{ label: 'X', children: [{ label: 'Y', children: [] }] }]);
    expect(map).toHaveProperty('remainingEdges', expect.arrayContaining([4, 5]));
  });
  it('handles id/label alias collisions in a node-only mind map without crashing', () => {
    const fig = figure({ kind: 'mindmap', nodes: [{ id: 'a', label: 'b' }, { id: 'b', label: 'c' }] });
    expect(() => mindMapLayout(fig)).not.toThrow();
    const mermaid = figureToMermaid({ ...fig, edges: [{ from: 'a', to: 'b' }] });
    expect(mermaid).toContain('n1["b"]');
    expect(mermaid).toContain('n2["c"]');
    expect(mermaid).toContain('n1 --> n2');
  });
  it('preserves distinct node identities for repeated labels and does not guess ambiguous endpoints', () => {
    const fig = figure({ nodes: [{ id: 'one', label: 'Same' }, { id: 'two', label: 'Same' }], edges: [{ from: 'one', to: 'two' }, { from: 'Same', to: 'one' }, { from: 'unknown', to: 'two' }] });
    const mermaid = figureToMermaid(fig)!;
    expect(mermaid).toContain('n1["Same"]');
    expect(mermaid).toContain('n2["Same"]');
    expect(mermaid).toContain('n1 --> n2');
    expect(mermaid).toContain('n3 --> n1');
    expect(mermaid).toContain('n4["unknown"]');
    expect(edgeMarks(fig)[0]).toBeNull();
    expect(() => mindMapLayout({ ...fig, kind: 'mindmap' })).not.toThrow();
  });
  it('renames labels case-insensitively without mutating stable node IDs or geometry groups', () => {
    const original = figure({ labels: [' Alpha ', 'Beta'], sequence: ['ALPHA', 'Beta'], nodes: [{ id: 'n1', label: 'alpha', group: 2 }, { id: 'n2', label: 'Beta', parent: 'n1' }], edges: [{ from: ' alpha ', to: 'Beta' }, { from: 'n1', to: 'ALPHA', label: 'alpha' }] });
    const next = renameFigureLabel(original, 'alpha', 'Synapse');
    expect(next.labels).toEqual(['Synapse', 'Beta']);
    expect(next.sequence).toEqual(['Synapse', 'Beta']);
    expect(next.nodes![0]).toEqual({ id: 'n1', label: 'Synapse', group: 2 });
    expect(next.edges).toEqual([{ from: 'Synapse', to: 'Beta' }, { from: 'n1', to: 'Synapse', label: 'alpha' }]);
    expect(original.nodes![0].label).toBe('alpha');
    expect(renameFigureLabel(figure(), 'missing', '').labels).toEqual([]);
  });
  it('serializes corrected labels for corrections and glossary extraction', () => {
    const before = figure({ labels: ['wrong'], nodes: [{ id: 'x', label: 'wrong' }], sequence: ['wrong'], edges: [{ from: 'wrong', to: 'Done', label: 'yes' }], cells: [['Value'], ['One']] });
    const modelText = figureCorrectionText('Caption', before);
    const userText = figureCorrectionText('Caption', renameFigureLabel(before, 'wrong', 'Synapse'));
    expect(userText).toContain('Synapse');
    expect(userText).toContain('1. Synapse');
    expect(userText).toContain('Synapse → Done (yes)');
    expect(userText).toContain('Value\nOne');
    expect(glossaryFromCorrections([{ id: 'c', pageId: 'p', blockId: 'b', imageDataUrl: '', createdAt: 0, modelText, userText }])).toContain('Synapse');
  });
  it('maps shape glyphs and unknown values', () => {
    expect(['rectangle', 'box', 'rounded', 'circle', 'ellipse', 'oval', 'diamond', 'decision', 'parallelogram', 'triangle', 'cylinder', 'database', 'unknown', undefined].map(shapeGlyph)).toEqual(['▭', '▭', '▢', '◯', '◯', '◯', '◇', '◇', '▱', '△', '⛁', '⛁', '•', '•']);
  });
  it('matches steps and marks normalized back edges and self loops', () => {
    const fig = figure({ sequence: [' Alpha ', 'Beta'], nodes: [{ id: 'a', label: 'alpha' }, { id: 'b', label: 'beta' }], edges: [{ from: 'BETA', to: ' a ' }, { from: 'ALPHA', to: 'alpha' }, { from: 'a', to: 'b', kind: 'self-loop' }] });
    expect(stepNode(fig, ' ALPHA ')).toEqual(fig.nodes![0]);
    expect(stepNode(fig, 'missing')).toBeUndefined();
    expect(edgeMarks(fig)).toEqual(['back', 'self-loop', 'self-loop']);
  });
  it('finds DFS cycle-closing edges but not acyclic or undirected edges', () => {
    expect(edgeMarks(figure({ edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'A' }, { from: 'c', to: 'b', kind: 'line' }] }))).toEqual([null, null, 'back', null]);
    expect(edgeMarks(figure())).toEqual([]);
  });
  it('lays out parent-only and edge-driven mind maps without duplicated neighbours', () => {
    expect(mindMapLayout(figure())).toBeNull();
    const fig = figure({ kind: 'mindmap', nodes: [{ id: 'h', label: 'Hub' }, { id: 'a', label: 'A', parent: 'h' }, { id: 'b', label: 'B', parent: 'h' }, { id: 'c', label: 'C', parent: 'a' }], edges: [{ from: 'Hub', to: 'A' }, { from: 'A', to: 'B' }] });
    expect(mindMapLayout(fig)).toEqual({ hub: 'Hub', spokes: [{ label: 'A', children: [{ label: 'C', children: [] }] }, { label: 'B', children: [] }], other: [], remainingEdges: [1] });
    expect(mindMapLayout(figure({ labels: ['alone'] }))).toEqual({ hub: 'alone', spokes: [], other: [], remainingEdges: [] });
    expect(mindMapLayout(figure({ edges: [{ from: 'a', to: 'hub' }, { from: 'hub', to: 'b' }] }))?.hub).toBe('hub');
  });
  it('renders Mermaid shapes, aliases, subgraphs, line edges and escaped labels', () => {
    const fig = figure({ nodes: [{ id: 'outer', label: 'System "A"' }, { id: 'a', label: 'Ready?', shape: 'diamond', parent: 'outer' }, { id: 'b', label: 'Go', shape: 'circle' }, { id: 'c', label: 'End', shape: 'rounded' }], edges: [{ from: 'a', to: 'Go', label: 'yes|"<`\n' }, { from: 'b', to: 'c', kind: 'line' }] });
    expect(figureToMermaid(fig)).toBe('flowchart TD\n  subgraph n1["System &quot;A&quot;"]\n    n2{"Ready?"}\n  end\n  n3(("Go"))\n  n4("End")\n  n2 -->|"yes&#124;&quot;&#60;&#96;&#10;"| n3\n  n3 --- n4');
    expect(figureToMermaid(figure({ kind: 'sequence', edges: [{ from: 'A', to: 'B' }] }))).toContain('flowchart LR');
  });
  it('handles empty, unsupported and malformed cyclic nesting safely', () => {
    expect(figureToMermaid(figure())).toBeNull();
    for (const kind of ['table', 'plot', 'sketch', 'cube', 'shape'] as const) expect(figureToMermaid(figure({ kind, edges: [{ from: 'a', to: 'b' }] }))).toBeNull();
    expect(figureToMermaid(figure({ nodes: [{ id: 'a', label: 'A', parent: 'b' }, { id: 'b', label: 'B', parent: 'a' }] }))).toContain('subgraph');
  });
});
