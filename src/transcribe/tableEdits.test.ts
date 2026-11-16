// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { FigureEditor, type FigureEdit } from '../views/FigureEditor';
import { buildScene } from '../sim/scenes';
import { expectedBlocks } from '../sim/expectedBlocks';
import { fromPoints } from '../__tests__/shapes';
import { MockTranscriber } from './mock';
import { attachUnclaimedStrokes, buildStrokeGroups, mergeBlocks, protectEditedBlocks, rawToDigitalBlock, reconcileFigureBlocks } from './regions';
import type { TranscribeRequest } from './types';

describe('edited expected table through Mock retranscription', () => {
  it.each([
    [],
    [['[Handwriting 1: 2 strokes]', '[Handwriting 2: 3 strokes]']],
    [['', '', '', ''], ['[Handwriting 1: 2 strokes]', '', '', ''], ['', '', '', ''], ['', '', '', '']],
    [['', '', ''], ['[Handwriting 1: 2 strokes]', 'wrong', ''], ['', '', '']],
    [['', 'train'], ['loss', '[Handwriting 1: 2 strokes]']],
    [['', 'train', 'val', 'new column'], ['loss', '[Handwriting 1: 2 strokes]', '', 'new value']],
  ].map(cells => ({ cells })))('keeps the known table through empty, resized or partially recognised grids: $cells', ({ cells }) => {
    const scene = buildScene('table', 2, 'normal');
    const edited = expectedBlocks(scene, new Map())[0];
    edited.figure!.cells![1][1] = '0.25';
    edited.userEdited = true;
    const fresh = { ...edited, figure: { ...edited.figure!, cells } };
    const result = mergeBlocks([edited], [edited.id], [fresh])[0];
    expect(result.figure!.cells).toEqual(edited.figure!.cells);
    expect(result.userEdited).toBe(true);
  });

  it('adds recognised rows and columns when their identities still locate every saved cell', () => {
    const scene = buildScene('table', 2, 'normal');
    const edited = expectedBlocks(scene, new Map())[0];
    edited.figure!.cells = [['item', 'qty'], ['apple', '0.25']];
    edited.userEdited = true;
    const cells = [['item', 'qty', 'status'], ['apple', '[Handwriting 1: 2 strokes]', 'fresh status'], ['pear', '5', 'new']];
    const fresh = { ...edited, figure: { ...edited.figure!, cells } };
    expect(mergeBlocks([edited], [edited.id], [fresh])[0].figure!.cells).toEqual([
      ['item', 'qty', 'status'], ['apple', '0.25', 'fresh status'], ['pear', '5', 'new'],
    ]);
  });

  it('allows real recognition to replace an old placeholder without replacing saved text or blanks', () => {
    const scene = buildScene('table', 2, 'normal');
    const edited = expectedBlocks(scene, new Map())[0];
    edited.figure!.cells![1][1] = '0.25';
    edited.figure!.cells![2][2] = '[Handwriting 1: 2 strokes]';
    edited.userEdited = true;
    const fresh = { ...edited, figure: { ...edited.figure!, cells: [['', 'train', 'val'], ['loss', 'wrong', 'wrong'], ['acc', 'wrong', '91']] } };
    const result = mergeBlocks([edited], [edited.id], [fresh])[0];
    expect(result.figure!.cells).toEqual([['', 'train', 'val'], ['loss', '0.25', '0.31'], ['acc', '98', '91']]);
  });

  it.each(['', '   ', '[Handwriting 9: 3 strokes]'])('keeps a saved unread-cell marker when that cell gains no real recognition: %j', cell => {
    const scene = buildScene('table', 2, 'normal');
    const edited = expectedBlocks(scene, new Map())[0];
    edited.figure!.cells![1][1] = '0.25';
    edited.figure!.cells![2][1] = '[Handwriting 1: 2 strokes]';
    edited.figure!.cells![2][2] = '[Handwriting 2: 4 strokes]';
    edited.userEdited = true;
    const cells = [['', 'train', 'val'], ['loss', cell, '0.31'], ['acc', '98', cell]];
    const fresh = { ...edited, figure: { ...edited.figure!, cells } };
    const result = mergeBlocks([edited], [edited.id], [fresh])[0];
    expect(result.figure!.cells).toEqual([
      ['', 'train', 'val'], ['loss', '0.25', '0.31'], ['acc', '98', '[Handwriting 2: 4 strokes]'],
    ]);
  });

  it('keeps the saved cell and all previously read cells after new ink over row 2, column 2', async () => {
    const scene = buildScene('table', 2, 'normal');
    const initial = expectedBlocks(scene, new Map(scene.strokes.map(s => [s.id, s.id])))[0];
    expect(initial.figure!.cells).toEqual([['', 'train', 'val'], ['loss', '0.12', '0.31'], ['acc', '98', '91']]);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let next: FigureEdit | undefined;
    try {
      act(() => root.render(createElement(FigureEditor, { block: initial, onSave: saved => { next = saved; }, onCancel: () => {} })));
      const input = [...container.querySelectorAll('label')].find(label => label.textContent === 'Row 2, column 2')!.querySelector('input')!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0.25');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    } finally {
      act(() => root.unmount());
      container.remove();
    }
    const edited = { ...initial, ...next!, userEdited: true, confidence: 1 };
    expect(edited.figure!.cells![1][1]).toBe('0.25');
    const added = fromPoints([{ x: 310, y: 140 }, { x: 329, y: 148 }], 100000, 'cell-mark');
    const strokes = [...scene.strokes, added], groups = buildStrokeGroups(strokes);
    const req: TranscribeRequest = { strokes, groups, imageBounds: { left: 0, top: 0, right: scene.width, bottom: scene.height },
      imageSize: { width: scene.width, height: scene.height }, imageDataUrl: '', contextText: '', pageTitle: '', profile: { glossary: [], habits: [], examples: [] } };
    const response = await new MockTranscriber().transcribe(req);
    const incoming = reconcileFigureBlocks(response.blocks.map(raw => rawToDigitalBlock(raw, groups, req.imageBounds, req.imageSize, strokes)), groups, strokes);
    const protectedResult = protectEditedBlocks([edited], incoming, new Set([added.id]));
    const result = mergeBlocks([edited], protectedResult.replacedIds, attachUnclaimedStrokes(protectedResult.incoming, strokes)).find(b => b.id === edited.id)!;
    expect(result.figure!.cells).toEqual(edited.figure!.cells);
    expect(result.userEdited).toBe(true);
    expect(result.strokeIds).toEqual(expect.arrayContaining([...initial.strokeIds, added.id]));
  });
});
