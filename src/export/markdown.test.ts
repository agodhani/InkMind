import { describe, expect, it } from 'vitest';
import { figureLines, pageToMarkdown } from './markdown';
import type { Page } from '../model/page';

describe('pageToMarkdown', () => {
  it('exports current node labels for id endpoints, including non-loop links between repeated labels', () => {
    const block = { id: 'f', kind: 'diagram' as const, text: '', bbox: { left: 0, top: 0, right: 10, bottom: 10 }, strokeIds: [], confidence: 1 };
    const fig = { kind: 'flowchart' as const, shapes: [], labels: [], nodes: [{ id: 'A', label: 'Alpha' }, { id: 'B', label: 'B' }], edges: [{ from: 'A', to: 'B' }] };
    expect(figureLines({ ...block, figure: fig }).join('\n')).toContain('- Alpha → B');
    expect(figureLines({ ...block, figure: { ...fig, nodes: [{ id: 'A', label: 'Same' }, { id: 'B', label: 'Same' }] } }).join('\n')).toContain('- Same → Same');
  });
  it('exports only uncovered free annotations when nodes, cells or Mermaid cover other labels', () => {
    const base = { id: 'f', kind: 'diagram' as const, text: '', bbox: { left: 0, top: 0, right: 10, bottom: 10 }, strokeIds: [], confidence: 1 };
    const flow = figureLines({ ...base, figure: { kind: 'flowchart', shapes: [], labels: [' start ', 'YES', 'step', 'Finish', 'Free note', 'free NOTE'], nodes: [{ id: 'n', label: 'Start' }], sequence: ['Step'], edges: [{ from: 'Start', to: 'Finish', label: 'yes' }] } });
    expect(flow[0]).toBe('Labels: `Free note`');
    const table = figureLines({ ...base, figure: { kind: 'table', shapes: [], labels: [' cell ', 'Free note'], cells: [['Cell']], edges: [] } });
    expect(table[0]).toBe('Labels: `Free note`');
  });
  it('exports deep mind-map descendants, disconnected branches and leftover links', () => {
    const lines = figureLines({ id: 'map', kind: 'diagram', text: '', bbox: { left: 0, top: 0, right: 10, bottom: 10 }, strokeIds: [], confidence: 1, figure: { kind: 'mindmap', shapes: [], labels: [], nodes: [{ id: 'h', label: 'H' }, { id: 'a', label: 'A', parent: 'h' }, { id: 'b', label: 'B', parent: 'a' }, { id: 'c', label: 'C', parent: 'b' }, { id: 'd', label: 'D', parent: 'c' }, { id: 'x', label: 'X' }, { id: 'y', label: 'Y', parent: 'x' }], edges: [{ from: 'x', to: 'y', label: 'detached' }] } }).join('\n');
    expect(lines).toContain('- H\n  - A\n    - B\n      - C\n        - D');
    expect(lines).toContain('- X\n  - Y');
    expect(lines).toContain('(detached)');
  });
  it('emits headings, footnotes and diagram embeds in reading order', () => {
    const page: Page = {
      id: 'page_1',
      title: 'RLHF',
      strokes: [],
      createdAt: 0,
      updatedAt: 0,
      blocks: [
        { id: 'd', kind: 'footnote_def', text: 'proximal policy optimisation', marker: '*', bbox: { left: 0, top: 500, right: 10, bottom: 510 }, strokeIds: [], confidence: 1 },
        { id: 'h', kind: 'heading', text: 'PPO step', level: 1, bbox: { left: 0, top: 0, right: 10, bottom: 10 }, strokeIds: [], confidence: 1 },
        { id: 'r', kind: 'footnote_ref', text: 'uses PPO', marker: '*', bbox: { left: 0, top: 50, right: 10, bottom: 60 }, strokeIds: [], confidence: 1 },
        { id: 'g', kind: 'diagram', text: 'policy to reward model', bbox: { left: 0, top: 100, right: 10, bottom: 110 }, strokeIds: [], confidence: 1 },
        {
          id: 'f',
          kind: 'diagram',
          text: 'Shape: two boxes. Labels: policy, reward. Relations: policy → reward.',
          bbox: { left: 0, top: 200, right: 10, bottom: 210 },
          strokeIds: [],
          confidence: 1,
          figure: { kind: 'flowchart', shapes: ['two boxes'], labels: ['policy', 'reward'], edges: [{ from: 'policy', to: 'reward', label: 'scores' }] },
        },
      ],
    };
    const md = pageToMarkdown(page);
    expect(md).toContain('![[page_1/f.png]]\n*Shape: two boxes. Labels: policy, reward. Relations: policy → reward.*\n- policy → reward (scores)\n');
    expect(md).toContain('```mermaid\nflowchart TD\n  n1["policy"]\n  n2["reward"]\n  n1 -->|"scores"| n2\n```');
    expect(md).not.toContain('Labels: `policy`');
    expect(md).toContain('## PPO step');
    expect(md).toContain('uses PPO[^star]');
    expect(md).toContain('![[page_1/g.png]]');
    expect(md.trimEnd().endsWith('[^star]: proximal policy optimisation')).toBe(true);
    expect(md.indexOf('## PPO step')).toBeLessThan(md.indexOf('![[page_1/g.png]]'));
  });

  it('writes a diagram\'s table, nested shapes, step order and relations under its embed', () => {
    const page: Page = {
      id: 'p',
      title: 'T',
      strokes: [],
      createdAt: 0,
      updatedAt: 0,
      blocks: [
        {
          id: 'f', kind: 'diagram', text: 'Shape: flow.', bbox: { left: 0, top: 0, right: 10, bottom: 10 }, strokeIds: [], confidence: 1,
          figure: {
            kind: 'flowchart', shapes: [], labels: ['start', 'end'],
            edges: [{ from: 'start', to: 'end', label: 'yes' }, { from: 'end', to: 'end', kind: 'self-loop' }, { from: 'end', to: 'start', kind: 'arrow', inferred: true }],
            sequence: ['start', 'end'],
            nodes: [{ id: 'n1', label: 'system', shape: 'rectangle' }, { id: 'n2', label: 'start', parent: 'n1' }, { id: 'n3', label: 'end', parent: 'n1' }],
          },
        },
        {
          id: 't', kind: 'diagram', text: '', bbox: { left: 0, top: 100, right: 10, bottom: 110 }, strokeIds: [], confidence: 1,
          figure: { kind: 'table', shapes: [], labels: ['name', 'qty', 'nut', '12'], edges: [], cells: [['name', 'qty'], ['nut', '12']] },
        },
      ],
    };
    const md = pageToMarkdown(page);
    expect(md).toContain('![[p/f.png]]\n*Shape: flow.*\n- system (rectangle)\n  - start\n  - end\n1. start\n2. end\n\n- start → end (yes)\n- end ↺\n- end → start *(from ink geometry)*');
    expect(md).toContain('![[p/t.png]]\n\n| name | qty |\n| --- | --- |\n| nut | 12 |');
    expect(md).not.toContain('Labels: `name`');
  });

  it('escapes table pipes and exports mind map branches plus Mermaid', () => {
    const base = { id: 'f', kind: 'diagram' as const, text: '', bbox: { left: 0, top: 0, right: 10, bottom: 10 }, strokeIds: [], confidence: 1 };
    expect(figureLines({ ...base, figure: { kind: 'table', shapes: [], labels: [], edges: [], cells: [['A|B', 'C'], ['x|y', 'z']] } }).join('\n')).toContain('| A\\|B | C |\n| --- | --- |\n| x\\|y | z |');
    const lines = figureLines({ ...base, figure: { kind: 'mindmap', shapes: [], labels: ['Trip', 'Hotel', 'Book'], edges: [{ from: 'Trip', to: 'Hotel' }, { from: 'Trip', to: 'Food' }, { from: 'Hotel', to: 'Book' }] } }).join('\n');
    expect(lines).toContain('- Trip\n  - Hotel\n    - Book\n  - Food');
    expect(lines).toContain('```mermaid\nflowchart TD');
    expect(lines).not.toContain('Labels:');
    expect(figureLines(base)).toEqual([]);
    expect(figureLines({ ...base, figure: { kind: 'other', shapes: [], labels: ['old'], edges: [] } })).toEqual(['Labels: `old`']);
    expect(figureLines({ ...base, figure: { kind: 'shape', shapes: [], labels: ['Container'], nodes: [{ id: 'c', label: 'Container', shape: 'box' }], edges: [] } })).toEqual(['- Container (box)']);
  });
});
