import { describe, expect, it } from 'vitest';
import { buildScene } from '../sim/scenes';
import { containmentFromNodes } from '../sim/metrics';
import { buildStrokeGroups, figuresOf, mergeFigures, mergeWithGeometry, rawToDigitalBlock, reconcileFigureBlocks } from './regions';
import { normaliseBlocks } from './openaiCompat';
import { normaliseFigure, figureCaption } from './figure';
import { parseOllamaOutput } from './ollama';
import { COMPACT_SYSTEM_PROMPT, buildCompactSystemPrompt, buildUserPrompt } from './prompt';
import type { FigureHint } from '../ink/shapeHints';

const hint: FigureHint = { id: 0, kind: 'flowchart', nodes: [], groupIndices: [], labelInside: {}, labelGroups: [], labelHostGroups: [], shapes: [], relations: [], edges: [], order: [], orderBasis: '', summary: '' };

describe('text and relation recovery', () => {
  it('preserves prose emitted as a label-only diagram on ordinary text groups', () => {
    const raw = normaliseBlocks({ blocks: [{ kind: 'diagram', groupIndices: [0], figure: { labels: ['A useful title', 'read this note'] } }] });
    const groups = [{ index: 0, strokeIds: ['s'], bbox: { left: 0, top: 0, right: 100, bottom: 20 }, writtenOrder: 0 }];
    const blocks = raw.map((b) => rawToDigitalBlock(b, groups, groups[0].bbox, { width: 100, height: 20 }, []));
    expect(reconcileFigureBlocks(blocks, groups, [])[0]).toMatchObject({ kind: 'paragraph', text: 'A useful title\nread this note', figure: undefined });
    expect(reconcileFigureBlocks([], groups, [])).toEqual([]);
    const structured = { ...blocks[0], figure: { ...blocks[0].figure!, shapes: ['rectangle'] } };
    expect(reconcileFigureBlocks([structured], groups, [])[0].kind).toBe('diagram');
    expect(reconcileFigureBlocks([{ ...blocks[0], figure: { ...blocks[0].figure!, sequence: ['first', 'last'] } }], groups, [])[0].kind).toBe('diagram');
    expect(reconcileFigureBlocks([{ ...blocks[0], figure: { ...blocks[0].figure!, nodes: [{ id: 'a', label: 'outer' }, { id: 'b', label: 'inner', parents: ['a'] }] } }], groups, [])[0].kind).toBe('diagram');
  });
  it('keeps compatible extra model edges between distinct geometry nodes but not reversed, self or dangling ones', () => {
    const prior = normaliseFigure({ names: { n1: 'start', n2: 'work', n3: 'end', n4: 'unsupported' }, edges: [
      { from: 'n2', to: 'n1' }, { from: 'n2', to: 'n3', label: 'next' }, { from: 'n1', to: 'n3' }, { from: 'n1', to: 'n1' }, { from: 'n1', to: 'n4' },
    ] })!;
    const geo = { nodes: ['n1', 'n2', 'n3'].map((id, i) => ({ id, label: `rectangle ${i + 1}` })), edges: [{ from: 'rectangle 1', to: 'rectangle 2', kind: 'arrow' as const }], unnamed: ['rectangle 1', 'rectangle 2', 'rectangle 3'] };
    expect(mergeWithGeometry(prior, hint, prior.labels, geo).edges).toEqual([
      { from: 'start', to: 'work', kind: 'arrow', inferred: true },
      { from: 'work', to: 'end', label: 'next', inferred: false },
      { from: 'start', to: 'end', inferred: false },
    ]);
    expect(mergeWithGeometry(undefined, hint, [], { nodes: [], edges: [], unnamed: [] }).edges).toEqual([]);
  });
  it('retains ungrouped text as labels when geometry accounts for the entire single drawing', () => {
    const scene = buildScene('nested-boxes', 201, 'neat');
    const groups = buildStrokeGroups(scene.strokes);
    expect(groups.every((g) => g.figure)).toBe(true);
    const words = figuresOf(groups)[0].nodes.map((_, i) => `word ${String.fromCharCode(97 + i)}`);
    const bounds = { left: 0, top: 0, right: scene.width, bottom: scene.height };
    const raw = normaliseBlocks({ blocks: [{ kind: 'paragraph', text: words.join('\n') }] });
    const input = raw.map((b) => rawToDigitalBlock(b, groups, bounds, { width: scene.width, height: scene.height }, scene.strokes));
    const out = reconcileFigureBlocks(input, groups, scene.strokes);
    expect(out).toHaveLength(1);
    expect(out[0].figure!.labels).toEqual(expect.arrayContaining(words));
    expect(out[0].figure!.nodes!.map((n) => n.label).sort()).toEqual(words.sort());
  });
  it('separates arrow-box message words from participant names before exact-count matching', () => {
    const [block] = parseOllamaOutput(JSON.stringify({ blocks: [{ kind: 'diagram', figure: { labels: ['user', 'app'], 'node boxes': [{ n1: { label: 'open', shape: 'arrow' } }, { n2: { label: 'reply', shape: 'arrow' } }] } }] }), 'compact');
    expect(block.figure!.nodes).toBeUndefined();
    const out = mergeWithGeometry(block.figure, { ...hint, messageGroups: [2, 3] }, block.figure!.labels, { nodes: [{ id: 'n1', label: 'lifeline 1' }, { id: 'n2', label: 'lifeline 2' }], edges: [{ from: 'lifeline 1', to: 'lifeline 2', kind: 'arrow' }, { from: 'lifeline 2', to: 'lifeline 1', kind: 'arrow' }], unnamed: ['lifeline 1', 'lifeline 2'] });
    expect(out.nodes!.map((n) => n.label)).toEqual(['user', 'app']);
    expect(out.edges.map((e) => e.label)).toEqual(['open', 'reply']);
    expect(out.sequence).toEqual(['open', 'reply']);
  });
  it.each(['neat', 'messy'] as const)('finds radial text nodes and tight label reading boxes (%s)', (messiness) => {
    const scene = buildScene('mind-map', 201, messiness);
    const fig = figuresOf(buildStrokeGroups(scene.strokes))[0];
    expect(fig.nodes.some((n) => n.shape === 'text')).toBe(true);
    expect(fig.relations.length).toBeGreaterThan(0);
    expect(fig.nodes.every((n) => n.labelBounds)).toBe(true);
  });
  it.each(['neat', 'messy'] as const)('emits overlap membership in all containing Venn circles (%s)', (messiness) => {
    const scene = buildScene('venn', 201, messiness);
    const fig = figuresOf(buildStrokeGroups(scene.strokes))[0];
    expect(fig.nodes.some((n) => (n.parents?.length ?? 0) >= 2)).toBe(true);
    expect(fig.nodes.filter((n) => n.shape === 'circle' || n.shape === 'ellipse').every((n) => n.labelBounds)).toBe(true);
  });
  it('normalizes, scores, captions and merges multiple parents, ignoring missing/self parents', () => {
    const fig = normaliseFigure({ nodes: [{ id: 'n1', label: 'A' }, { id: 'n2', label: 'B' }, { id: 'n3', label: 'shared', parents: ['n1', 'n2', 'n3', 'absent'] }] })!;
    expect(containmentFromNodes(fig.nodes!)).toEqual([{ inner: 'shared', outer: 'A' }, { inner: 'shared', outer: 'B' }]);
    expect(figureCaption(fig)).toContain('shared inside A, shared inside B');
    expect(mergeFigures(fig, fig).nodes!.at(-1)!.parents).toEqual(['n1', 'n2']);
    expect(containmentFromNodes([])).toEqual([]);
  });
  it('asks for all ordinary text before figures and uses handwriting rather than shape extents', () => {
    expect(COMPACT_SYSTEM_PROMPT).not.toContain('"kind":"paragraph"');
    const bbox = { left: 0, top: 0, right: 100, bottom: 100 };
    const req = { imageDataUrl: '', imageBounds: bbox, imageSize: { width: 100, height: 100 }, strokes: [], groups: [{ index: 0, bbox, writtenOrder: 0, strokeIds: [] }, { index: 1, bbox, writtenOrder: 1, strokeIds: [], figure: { ...hint, groupIndices: [1], nodes: [{ id: 'n1', shape: 'rectangle' as const, groupIndex: 1, bbox, labelBounds: { left: 10, top: 10, right: 30, bottom: 20 } }] } }], contextText: '', pageTitle: '', profile: { glossary: [], habits: [], examples: [] } };
    expect(buildUserPrompt(req, 'compact')).toContain('ordinary text first: groups [0]');
    expect(buildCompactSystemPrompt(req)).toMatch(/^FIRST/);
    expect(buildCompactSystemPrompt(req)).toContain('"kind":"paragraph"');
    expect(buildCompactSystemPrompt({ groups: req.groups.slice(1) })).toBe(COMPACT_SYSTEM_PROMPT);
    expect(buildUserPrompt({ ...req, groups: req.groups.slice(1) }, 'compact')).toContain('All groups belong to drawings');
    expect(buildUserPrompt(req, 'compact')).toContain('n1:[10,10,30,20]');
    expect(buildUserPrompt(req, 'full')).toContain('n1:[10,10,30,20]');
  });
});
