import type { BoundingBox, Stroke } from '../types';

export type BlockKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'checklist'
  | 'footnote_ref'
  | 'footnote_def'
  | 'math'
  | 'diagram'
  | 'table'
  | 'margin_note'
  | 'unknown';

export interface DigitalBlock {
  id: string;
  kind: BlockKind;
  /** Markdown-ish text. For diagrams this is the caption. */
  text: string;
  bbox: BoundingBox;
  strokeIds: string[];
  confidence: number;
  /** Footnote marker such as "*", "†", "(1)" for footnote_ref / footnote_def. */
  marker?: string;
  /** Heading level 1-3 */
  level?: number;
  /** True when the user edited this block; survives re-transcription. */
  userEdited?: boolean;
}

export interface InkStroke extends Stroke {
  id: string;
}

export interface Page {
  id: string;
  title: string;
  strokes: InkStroke[];
  blocks: DigitalBlock[];
  createdAt: number;
  updatedAt: number;
}

export function createPage(title = 'Untitled'): Page {
  const now = Date.now();
  return { id: newId('page'), title, strokes: [], blocks: [], createdAt: now, updatedAt: now };
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function unionBounds(a: BoundingBox, b: BoundingBox): BoundingBox {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

export function boundsIntersect(a: BoundingBox, b: BoundingBox, pad = 0): boolean {
  return !(
    a.right + pad < b.left ||
    b.right + pad < a.left ||
    a.bottom + pad < b.top ||
    b.bottom + pad < a.top
  );
}

export function expandBounds(b: BoundingBox, pad: number): BoundingBox {
  return { left: b.left - pad, top: b.top - pad, right: b.right + pad, bottom: b.bottom + pad };
}

/** Reading order: top-to-bottom, then left-to-right, with footnote_def blocks last. */
export function sortBlocksForReading(blocks: DigitalBlock[]): DigitalBlock[] {
  const rowTolerance = 18;
  return [...blocks].sort((a, b) => {
    const aFoot = a.kind === 'footnote_def' ? 1 : 0;
    const bFoot = b.kind === 'footnote_def' ? 1 : 0;
    if (aFoot !== bFoot) return aFoot - bFoot;
    if (Math.abs(a.bbox.top - b.bbox.top) > rowTolerance) return a.bbox.top - b.bbox.top;
    return a.bbox.left - b.bbox.left;
  });
}
