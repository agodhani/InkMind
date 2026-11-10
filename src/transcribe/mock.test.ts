import { describe, expect, it } from 'vitest';
import { MockTranscriber } from './mock';
import { mergeBlocks, rawToDigitalBlock } from './regions';
import type { StrokeGroupMeta, TranscribeRequest } from './types';

const group = (index: number, top: number, writtenOrder = index): StrokeGroupMeta => ({
  index,
  strokeIds: [`s${writtenOrder}a`, `s${writtenOrder}b`],
  bbox: { left: 0, top, right: 100, bottom: top + 20 },
  writtenOrder,
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

  it('keeps ids on the same ink when a new line is written above existing ones', async () => {
    const mock = new MockTranscriber();
    const before = request([group(0, 40, 0), group(1, 80, 1)]);
    const old = (await mock.transcribe(before)).blocks.map((b) => rawToDigitalBlock(b, before.groups, before.imageBounds, before.imageSize, []));
    // New group at the top: positional indices shift, writing order does not.
    const after = request([group(0, 0, 2), group(1, 40, 0), group(2, 80, 1)]);
    const incoming = (await mock.transcribe(after)).blocks.map((b) => rawToDigitalBlock(b, after.groups, after.imageBounds, after.imageSize, []));
    const merged = mergeBlocks(old, old.map((b) => b.id), incoming);
    const byStroke = (blocks: typeof merged, sid: string) => blocks.find((b) => b.strokeIds.includes(sid))!.id;
    expect(byStroke(merged, 's0a')).toBe(byStroke(old, 's0a'));
    expect(byStroke(merged, 's1a')).toBe(byStroke(old, 's1a'));
    expect(old.map((b) => b.id)).not.toContain(byStroke(merged, 's2a'));
  });
});
