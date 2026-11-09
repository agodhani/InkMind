import { describe, expect, it } from 'vitest';
import { BRUSH_SIZES, stepBrushSize } from './brush';
import { ratioFromPointer, readSplitRatio, SPLIT_MAX, SPLIT_MIN } from './splitPane';
import { describeStatus } from './status';

describe('stepBrushSize', () => {
  it('snaps to the next preset and clamps at the ends', () => {
    expect(stepBrushSize(2.5, 1)).toBe(4);
    expect(stepBrushSize(2.5, -1)).toBe(1.5);
    expect(stepBrushSize(3, 1)).toBe(4);
    expect(stepBrushSize(3, -1)).toBe(2.5);
    expect(stepBrushSize(BRUSH_SIZES.at(-1)!.value, 1)).toBe(7);
    expect(stepBrushSize(1.5, -1)).toBe(1);
    expect(stepBrushSize(1, -1)).toBe(1);
  });
});

describe('split pane', () => {
  it('maps pointer position to a clamped ratio', () => {
    expect(ratioFromPointer(500, 0, 1000)).toBe(0.5);
    expect(ratioFromPointer(50, 0, 1000)).toBe(SPLIT_MIN);
    expect(ratioFromPointer(990, 0, 1000)).toBe(SPLIT_MAX);
    expect(ratioFromPointer(300, 100, 400)).toBe(0.5);
    expect(ratioFromPointer(10, 0, 0)).toBe(0.5);
  });
  it('reads a sane ratio from storage', () => {
    expect(readSplitRatio({ getItem: () => '0.3' })).toBe(0.3);
    expect(readSplitRatio({ getItem: () => '5' })).toBe(SPLIT_MAX);
    expect(readSplitRatio({ getItem: () => 'nope' })).toBe(0.5);
    expect(readSplitRatio({ getItem: () => null })).toBe(0.5);
  });
});

describe('describeStatus', () => {
  it('covers every state with a stable short label', () => {
    expect(describeStatus({ state: 'running', pendingRegions: 1 }, true, 'Ollama').text).toBe('Transcribing…');
    expect(describeStatus({ state: 'running', pendingRegions: 3 }, true, 'Ollama').text).toBe('Transcribing 3 regions…');
    expect(describeStatus({ state: 'waiting', pendingRegions: 0 }, true, 'Ollama').tone).toBe('waiting');
    const err = describeStatus({ state: 'error', pendingRegions: 0, lastError: 'boom' }, true, 'Ollama');
    expect(err.tone).toBe('error');
    expect(err.detail).toBe('boom');
    expect(describeStatus({ state: 'idle', pendingRegions: 0 }, false, 'Ollama').tone).toBe('off');
    const idle = describeStatus({ state: 'idle', pendingRegions: 0, lastModel: 'qwen2.5vl:3b', lastDurationMs: 1234 }, true, 'Ollama');
    expect(idle.tone).toBe('idle');
    expect(idle.detail).toBe('qwen2.5vl:3b in 1.2 s');
  });
});
