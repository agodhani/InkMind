import { describe, expect, it } from 'vitest';
import type { DigitalBlock, FigureInfo, Page } from '../model/page';
import { extractPage } from './extract';

export function page(id: string, blocks: Partial<DigitalBlock>[]): Page {
  return { id, title: '', strokes: [], createdAt: 0, updatedAt: 0, blocks: blocks.map((b, i) => ({ id: `b${i}`, kind: 'paragraph', text: '', bbox: { left: 0, top: i * 40, right: 600, bottom: i * 40 + 30 }, strokeIds: [], confidence: 1, ...b })) };
}
const figure = (fields: Partial<FigureInfo>): FigureInfo => ({ kind: 'graph', shapes: [], labels: [], edges: [], ...fields });
const extractFigure = (fields: Partial<FigureInfo>) => extractPage(page('p', [{ kind: 'diagram', figure: figure(fields) }]), { glossary: [] });

describe('page extraction', () => {
  it('extracts headings in reading order with nested sections and correct closure', () => {
    const p = page('p', [
      { kind: 'heading', level: 1, text: '1. Learning:', strokeIds: ['s1'] },
      { kind: 'heading', level: 2, text: 'Policies (PI)' },
      { text: '[[Reward|Feedback]] and gradients.' },
      { kind: 'heading', level: 2, text: 'Values' },
      { kind: 'heading', level: 1, text: 'Optimizers' },
    ]);
    p.blocks.reverse();
    const out = extractPage(p, { glossary: ['gradient', 'absent'] });
    expect(out.terms.find(t => t.term === 'Learning')?.prov.strokeIds).toEqual(['s1']);
    expect(out.terms.find(t => t.term === 'Policies')?.aliases).toEqual(['PI']);
    expect(out.terms.find(t => t.term === 'Reward')?.aliases).toEqual(['Feedback']);
    expect(out.terms.some(t => t.term === 'absent')).toBe(false);
    expect(out.relations.map(r => [r.from, r.kind, r.to])).toEqual([
      ['Learning', 'contains', 'Policies'], ['Policies', 'mentions', 'Reward'],
      ['Policies', 'mentions', 'gradient'], ['Learning', 'contains', 'Values'],
    ]);
    expect(out.texts[2].section).toBe('Policies');
    expect(out.texts[4].section).toBe('Optimizers');
  });
  it.each(['paragraph', 'list', 'footnote_def', 'diagram'] as const)('finds links and glossary in %s text/captions', kind => {
    const out = extractPage(page('p', [{ kind, text: '[[Policy|Strategy]] [[Policy|Strategy]] and PPO policies, not policyholders.' }]), { glossary: ['Proximal Policy Optimization (PPO)', 'policy', 'policymaker'] });
    expect(out.terms.filter(t => t.prov.extractor === 'det:link')).toHaveLength(1);
    expect(out.terms.filter(t => t.prov.extractor === 'det:glossary').map(t => t.term).sort()).toEqual(['Proximal Policy Optimization', 'policy'].sort());
    expect(out.terms.every(t => t.prov.strokeIds.length === 0)).toBe(true);
    expect(out.texts).toHaveLength(1);
  });
  it('extracts arrows, lines, nesting, endpoint labels and ink but not self loops or shape labels', () => {
    const out = extractFigure({ nodes: [{ id: 'n1', label: 'Policy', strokeIds: ['node'] }, { id: 'n2', label: 'Reward', parent: 'n1' }, { id: 'n3', label: 'box' }], edges: [
      { from: 'n1', to: 'n2', label: 'improves', strokeIds: ['edge'] }, { from: 'n2', to: 'n1', kind: 'line' }, { from: 'n1', to: 'n1' },
    ] });
    expect(out.terms.map(t => t.term)).toEqual(['Policy', 'Reward']);
    expect(out.terms[0].prov.strokeIds).toEqual(['node']);
    expect(out.relations.map(r => r.kind)).toEqual(['follows', 'mentions', 'contains']);
    expect(out.relations[0]).toMatchObject({ label: 'improves', prov: { strokeIds: ['edge'], surface: 'improves' } });
  });
  it('extracts tree and mind-map hierarchy', () => {
    const nodes = [{ id: 'root', label: 'Learning' }, { id: 'branch', label: 'Policy', parent: 'root' }, { id: 'leaf', label: 'Reward', parent: 'branch' }];
    for (const kind of ['tree', 'mindmap'] as const) {
      const out = extractFigure({ kind, nodes, edges: [{ from: 'root', to: 'branch' }, { from: 'branch', to: 'leaf' }] });
      expect(out.relations.map(r => [r.from, r.to, r.kind])).toEqual([['Learning', 'Policy', 'contains'], ['Policy', 'Reward', 'contains']]);
    }
  });
  it('extracts Venn overlap membership', () => {
    const out = extractFigure({ nodes: [{ id: 'a', label: 'Mammals', shape: 'circle' }, { id: 'b', label: 'Swimmers', shape: 'circle' }, { id: 'c', label: 'Whales', parents: ['a', 'b'], strokeIds: ['whale'] }] });
    expect(out.relations.map(r => [r.from, r.to, r.kind])).toEqual([['Mammals', 'Whales', 'contains'], ['Swimmers', 'Whales', 'contains']]);
  });
  it('extracts ordered sequence steps and actors without actor edges', () => {
    const out = extractFigure({ kind: 'sequence', nodes: [{ id: 'client', label: 'Client' }, { id: 'server', label: 'Server' }], sequence: ['Request', 'Response', 'Request'], edges: [{ from: 'client', to: 'server', label: 'Request' }] });
    expect(out.terms.map(t => t.term)).toEqual(['Client', 'Server', 'Request', 'Response']);
    expect(out.relations.map(r => [r.from, r.to])).toEqual([['Request', 'Response'], ['Response', 'Request']]);
  });
  it('extracts table headers and two-way row headers only', () => {
    expect(extractFigure({ kind: 'table', cells: [['', 'Reward', 'Policy'], ['Learning', '42', 'value']] }).terms.map(t => t.term)).toEqual(['Reward', 'Policy', 'Learning']);
    expect(extractFigure({ kind: 'table', cells: [['Metric', 'Reward'], ['Learning', '42']] }).terms.map(t => t.term)).toEqual(['Metric', 'Reward']);
  });
  it.each(['plot', 'sketch', 'cube', 'shape'] as const)('ignores %s structure', kind => {
    expect(extractFigure({ kind, labels: ['Policy'], nodes: [{ id: 'a', label: 'Reward' }] }).terms).toEqual([]);
  });
  it('handles an empty page', () => expect(extractPage(page('empty', []), { glossary: ['Policy'] })).toEqual({ pageId: 'empty', extractor: 'deterministic', terms: [], relations: [], texts: [] }));
  it('excludes links, partial headings, and overlapping shorter glossary matches', () => {
    const out = extractPage(page('p', [
      { kind: 'heading', text: 'Advantage function (AF)' },
      { text: '[[Stochastic gradient descent|SGD]]' },
      { text: 'stochastic gradient descent and gradient.' },
    ]), { glossary: ['advantage', 'Advantage function', 'AF', 'stochastic gradient descent', 'gradient descent', 'gradient', 'SGD'] });
    expect(out.terms.filter(t => t.prov.extractor === 'det:glossary').map(t => [t.term, t.prov.blockId])).toEqual([
      ['Advantage function', 'b0'], ['AF', 'b0'], ['stochastic gradient descent', 'b2'], ['gradient', 'b2'],
    ]);
  });
});
