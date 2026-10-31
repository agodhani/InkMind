import type { TranscribeRequest, TranscribeResult, Transcriber } from './types';
import { toImagePx } from './prompt';

/**
 * Offline stand-in: one paragraph per stroke group, text is a placeholder.
 * Lets the whole UI pipeline run without an API key.
 */
export class MockTranscriber implements Transcriber {
  readonly name = 'mock';

  async transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
    const started = performance.now();
    await new Promise((r) => setTimeout(r, 300));
    const blocks = req.groups.map((g) => {
      const b = toImagePx(g.bbox, req);
      const wide = b.right - b.left > 260 && b.bottom - b.top > 120;
      return {
        kind: wide ? ('diagram' as const) : ('paragraph' as const),
        text: wide ? `Sketch with ${g.strokeIds.length} strokes` : `[${g.strokeIds.length} strokes of handwriting]`,
        bbox: b,
        groupIndices: [g.index],
        confidence: 0.2,
      };
    });
    return { blocks, model: 'mock', durationMs: performance.now() - started };
  }
}
