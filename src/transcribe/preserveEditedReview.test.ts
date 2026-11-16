import { describe, expect, it } from 'vitest';
import type { DigitalBlock, FigureInfo } from '../model/page';
import { mergeBlocks } from './regions';
import { figureEndpointLabel } from '../views/figureView';

function reread(edited: FigureInfo, incoming: FigureInfo, retained?: string[]): FigureInfo {
  const ink = (figure: FigureInfo) => [...(figure.nodes ?? []), ...figure.edges].flatMap(record => record.strokeIds ?? []);
  const block = (figure: FigureInfo, strokeIds: string[]): DigitalBlock => ({ id: 'edited', kind: 'diagram', text: '',
    bbox: { left: 0, top: 0, right: 200, bottom: 200 }, confidence: 1, strokeIds, figure });
  return mergeBlocks([{ ...block(edited, ink(edited)), userEdited: true }], ['edited'],
    [block(incoming, retained ?? [...ink(edited), ...ink(incoming)])])[0].figure!;
}

describe('edited table identity matching', () => {
  const cells = [['item', 'qty', 'note'], ['apple', '12', 'red'], ['pear', '9', 'green']];
  it.each([
    { fresh: [['qty', '?header', 'note'], ['?qty', '?apple', '?note'], ['?qty', '?pear', '?note']],
      expected: [['qty', '?header', 'note'], ['12', '?apple', 'red'], ['9', '?pear', 'green']] },
    { fresh: [['?header', 'item', 'note'], ['?qty', 'apple', '?note'], ['?qty', 'pear', '?note']],
      expected: [['?header', 'item', 'note'], ['?qty', 'apple', 'red'], ['?qty', 'pear', 'green']] },
    { fresh: [['item', 'qty', 'note'], ['pear', '?qty', '?note'], ['?key', 'fresh qty', 'fresh note']],
      expected: [['item', 'qty', 'note'], ['pear', '9', 'green'], ['?key', 'fresh qty', 'fresh note']] },
    { fresh: [['item', 'qty', 'note'], ['?key', 'fresh qty', 'fresh note'], ['apple', '?qty', '?note']],
      expected: [['item', 'qty', 'note'], ['?key', 'fresh qty', 'fresh note'], ['apple', '12', 'red']] },
  ])('does not reuse an identity-matched old row or column for positional fallback: $fresh', ({ fresh, expected }) => {
    const edited: FigureInfo = { kind: 'table', shapes: [], labels: [], edges: [], cells };
    expect(reread(edited, { ...edited, cells: fresh }).cells).toEqual(expected);
  });
});

describe('edited arrow direction', () => {
  it.each([
    { ink: ['shaft', 'old-head', 'label'], expected: ['left', 'right'] },
    { ink: ['shaft', 'label'], expected: ['left', 'right'] },
    { ink: ['shaft', 'new-head', 'label'], expected: ['right', 'left'] },
  ])('preserves endpoints only for unchanged/subset arrow ink: $ink', ({ ink, expected }) => {
    const edited: FigureInfo = { kind: 'flowchart', shapes: [], labels: [], nodes: [
      { id: 'a', label: 'left', strokeIds: ['left-node'] }, { id: 'b', label: 'right', strokeIds: ['right-node'] },
    ], edges: [{ from: 'a', to: 'b', label: 'corrected relationship', strokeIds: ['shaft', 'old-head', 'label'] }] };
    const incoming: FigureInfo = { ...edited, nodes: edited.nodes!.map(node => ({ ...node, id: `new-${node.id}`, label: '[unread]' })),
      edges: [{ from: 'new-b', to: 'new-a', label: '[unread edge]', strokeIds: ink }] };
    const retained = ['left-node', 'right-node', ...ink];
    const result = reread(edited, incoming, retained), edge = result.edges[0];
    expect([figureEndpointLabel(result, edge.from), figureEndpointLabel(result, edge.to)]).toEqual(expected);
    expect(edge.label).toBe('corrected relationship');
    expect(edge.strokeIds!.every(id => retained.includes(id))).toBe(true);
    expect(edge.strokeIds).toEqual(expect.arrayContaining(ink));
    expect(result.edges).toHaveLength(1);
  });
});

describe('retained edited node parents', () => {
  const figure = (nodes: FigureInfo['nodes']): FigureInfo => ({ kind: 'shape', shapes: [], labels: [], edges: [], nodes });

  it('remaps every old parent when the reread renumbers sets and reuses an old id for an unrelated node', () => {
    const edited = figure([
      { id: 'a', label: 'Cats', strokeIds: ['cats'] }, { id: 'b', label: 'Dogs', strokeIds: ['dogs'] },
      { id: 'member', label: 'Corrected member', strokeIds: ['member'], parent: 'a', parents: ['a', 'b'] },
    ]);
    const incoming = figure([
      { id: 'new-a', label: '[unread a]', strokeIds: ['cats'] }, { id: 'new-b', label: '[unread b]', strokeIds: ['dogs'] },
      { id: 'a', label: 'Unrelated', strokeIds: ['new ink'] },
    ]);
    const saved = structuredClone(edited), freshSaved = structuredClone(incoming);
    const result = reread(edited, incoming);
    expect(result.nodes!.find(node => node.label === 'Corrected member')).toMatchObject({ parent: 'new-a', parents: ['new-a', 'new-b'] });
    expect(result.nodes!.find(node => node.id === 'a')!.label).toBe('Unrelated');
    expect(edited).toEqual(saved);
    expect(incoming).toEqual(freshSaved);
  });

  it('drops missing old parents rather than attaching to a new owner of the old id', () => {
    const edited = figure([
      { id: 'parent', label: 'Erased parent', strokeIds: ['erased'] },
      { id: 'child', label: 'Saved child', strokeIds: ['child'], parent: 'parent', parents: ['parent', 'missing'] },
    ]);
    const result = reread(edited, figure([{ id: 'parent', label: 'New shape', strokeIds: ['new'] }]), ['child', 'new']);
    const child = result.nodes!.find(node => node.label === 'Saved child')!;
    expect(child.parent).toBeUndefined();
    expect(child.parents ?? []).toEqual([]);
    expect(result.nodes!.map(node => node.label)).not.toContain('Erased parent');
  });

  it('resolves references after all retained nodes receive collision-safe ids, regardless of node order', () => {
    const edited = figure([
      { id: 'child', label: 'Old child', strokeIds: ['old-child'], parent: 'parent', parents: ['parent'] },
      { id: 'parent', label: 'Old parent', strokeIds: ['old-parent'] },
    ]);
    const incoming = figure([
      { id: 'parent', label: 'New parent', strokeIds: ['new-parent'] },
      { id: 'parent-edited', label: 'Another new shape', strokeIds: ['another'] },
      { id: 'child', label: 'New child', strokeIds: ['new-child'], parent: 'parent', parents: ['parent'] },
    ]);
    const result = reread(edited, incoming);
    expect(result.nodes!.find(node => node.label === 'Old parent')!.id).toBe('parent-edited-edited');
    expect(result.nodes!.find(node => node.label === 'Old child')).toMatchObject({ id: 'child-edited', parent: 'parent-edited-edited', parents: ['parent-edited-edited'] });
    expect(result.nodes!.find(node => node.label === 'New child')).toMatchObject({ id: 'child', parent: 'parent', parents: ['parent'] });
  });

  it('remaps legacy single-parent label references without requiring a parents array', () => {
    const edited = figure([
      { id: 'parent', label: 'Container', strokeIds: ['parent'] },
      { id: 'child', label: 'Saved child', strokeIds: ['child'], parent: 'Container' },
    ]);
    const result = reread(edited, figure([{ id: 'renumbered', label: '[unread]', strokeIds: ['parent'] }]));
    expect(result.nodes!.find(node => node.label === 'Saved child')).toMatchObject({ parent: 'renumbered' });
  });
});
