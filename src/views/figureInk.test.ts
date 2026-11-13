import { describe, expect, it, vi } from 'vitest';
import type { DigitalBlock, InkStroke } from '../model/page';
import { InkToolType, StockBrush } from '../types';
import { buildStrokeGroups } from '../transcribe/regions';
import { nodeInkStrokes } from './figureInk';

vi.mock('../transcribe/regions', async importOriginal => ({ ...await importOriginal<typeof import('../transcribe/regions')>(), buildStrokeGroups: vi.fn() }));
const stroke = (id: string, x = 0): InkStroke => ({ id, brush: { size: 2, color: 0, stockBrush: StockBrush.BALLPOINT }, inputs: { tool: InkToolType.STYLUS, inputs: [{ x, y: 0, timeMillis: 0 }, { x: x + 10, y: 10, timeMillis: 10 }] } });
const block: DigitalBlock = { id: 'b', kind: 'diagram', text: '', bbox: { left: 0, top: 0, right: 100, bottom: 100 }, strokeIds: ['a', 'b', 'c'], confidence: 1 };
const group = (strokeIds: string[]) => ({ index: 0, strokeIds, bbox: block.bbox, writtenOrder: 0 });

describe('node ink lookup', () => {
  it('accepts a nonempty proper subset from the region grouping', () => {
    vi.mocked(buildStrokeGroups).mockReturnValue([group(['a', 'b'])]);
    expect(nodeInkStrokes(block, { id: 'n', label: 'N', group: 0 }, [stroke('a'), stroke('b'), stroke('c')])).toEqual(['a', 'b']);
  });
  it('tries local grouping when a nearby-region group includes unrelated ink', () => {
    vi.mocked(buildStrokeGroups).mockImplementation(strokes => [group(strokes.some(s => s.id === 'nearby') ? ['a', 'nearby'] : ['b'])]);
    expect(nodeInkStrokes(block, { id: 'n', label: 'N', group: 0 }, [stroke('a'), stroke('b'), stroke('c'), stroke('nearby', 110), stroke('far', 1000)])).toEqual(['b']);
    expect(vi.mocked(buildStrokeGroups).mock.calls.at(-2)![0].map(s => s.id)).not.toContain('far');
  });
  it('falls back for absent/invalid indices, empty groups, missing groups, whole blocks and external IDs', () => {
    for (const groupIndex of [undefined, -1, 0.5, 100]) {
      vi.mocked(buildStrokeGroups).mockReturnValue([]);
      expect(nodeInkStrokes(block, { id: 'n', label: 'N', group: groupIndex }, [])).toEqual(block.strokeIds);
    }
    for (const ids of [[], block.strokeIds, ['external']]) {
      vi.mocked(buildStrokeGroups).mockReturnValue([group(ids)]);
      expect(nodeInkStrokes(block, { id: 'n', label: 'N', group: 0 }, [stroke('a')])).toEqual(block.strokeIds);
    }
    expect(nodeInkStrokes(block, undefined, [])).toEqual(block.strokeIds);
  });
});
