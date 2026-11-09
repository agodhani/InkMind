import type { TranscribeRequest, TranscribeResult, Transcriber } from './types';
import { toImagePx } from './prompt';

/**
 * Offline stand-in: one paragraph per stroke group, text is a placeholder.
 * Lets the whole UI pipeline run without an API key.
 *
 * Texts carry the group's writing order so no two blocks read identically:
 * `mergeBlocks` reuses an existing block's id for an incoming block with the same
 * text, and identical placeholders made every mock block collapse onto one id.
 * Writing order (not the positional index) is used so ink added above existing
 * lines does not shift labels — and ids — onto the wrong ink.
 */
export class MockTranscriber implements Transcriber {
  readonly name = 'mock';

  async transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
    const started = performance.now();
    await new Promise((r) => setTimeout(r, 300));
    const blocks = req.groups.map((g) => {
      const b = toImagePx(g.bbox, req);
      const wide = b.right - b.left > 260 && b.bottom - b.top > 120;
      const n = g.writtenOrder + 1;
      return {
        kind: wide ? ('diagram' as const) : ('paragraph' as const),
        text: wide ? `Sketch ${n} with ${g.strokeIds.length} strokes` : `[Handwriting ${n}: ${g.strokeIds.length} strokes]`,
        bbox: b,
        groupIndices: [g.index],
        confidence: 0.2,
      };
    });
    return { blocks, model: 'mock', durationMs: performance.now() - started };
  }
}
