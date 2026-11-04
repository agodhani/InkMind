import { describe, expect, it } from 'vitest';
import { pagesFromStrokeExport } from './importStrokes';
import { stroke } from '../__tests__/helpers';

describe('pagesFromStrokeExport', () => {
  it('creates one page per exported page with fresh stroke ids', () => {
    const s = stroke(0, 0, 10, 0, 0, 'dup');
    const pages = pagesFromStrokeExport({ source: 'Notes.pdf', pages: [{ index: 1, strokes: [s] }, { index: 2, strokes: [s] }, { index: 3, strokes: [] }] });
    expect(pages.map((p) => p.title)).toEqual(['Notes · p1', 'Notes · p2']);
    expect(pages[0].strokes[0].id).not.toBe('dup');
    expect(pages[0].strokes[0].id).not.toBe(pages[1].strokes[0].id);
  });
  it('accepts a bare strokes array', () => {
    const pages = pagesFromStrokeExport({ strokes: [stroke(0, 0, 1, 1)] }, 'Scan.json');
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('Scan');
  });
});
