import { describe, expect, it } from 'vitest';
import type { DigitalBlock, FigureInfo } from '../model/page';
import { mergeBlocks } from './regions';

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
