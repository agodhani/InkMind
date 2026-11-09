import { describe, expect, it } from 'vitest';
import { MockTranscriber } from './mock';
import { mergeBlocks, rawToDigitalBlock } from './regions';
import type { StrokeGroupMeta, TranscribeRequest } from './types';

const group = (index: number, top: number): StrokeGroupMeta => ({
  index,
  strokeIds: [`s${index}a`, `s${index}b`],
  bbox: { left: 0, top, right: 100, bottom: top + 20 },
  writtenOrder: index,
});

const request = (groups: StrokeGroupMeta[]): TranscribeRequest => ({
  imageDataUrl: '',
  imageBounds: { left: 0, top: 0, right: 200, bottom: 200 },
  imageSize: { width: 200, height: 200 },
  strokes: [],
  groups,
  contextText: '',
  pageTitle: '',
  profile: { glossary: [], habits: [], examples: [] },
});

describe('MockTranscriber', () => {
  it('gives every group a distinct placeholder so merged blocks keep distinct ids', async () => {
    const req = request([group(0, 0), group(1, 40), group(2, 80)]);
    const { blocks } = await new MockTranscriber().transcribe(req);
    expect(blocks).toHaveLength(3);
    expect(new Set(blocks.map((b) => b.text)).size).toBe(3);

    const toDigital = () => blocks.map((b) => rawToDigitalBlock(b, req.groups, req.imageBounds, req.imageSize, []));
    const first = toDigital();
    const merged = mergeBlocks(first, first.map((b) => b.id), toDigital());
    expect(new Set(merged.map((b) => b.id)).size).toBe(3);
    expect(merged.map((b) => b.id).sort()).toEqual(first.map((b) => b.id).sort());
  });
});
