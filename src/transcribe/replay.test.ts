import { describe, expect, it } from 'vitest';
import { replayResponses } from './replay';

describe('saved model response replay', () => {
  it('strips debug markers and reuses compact normalization including duplicate words', () => {
    const saved = '{"blocks":[{"kind":"diagram","figure":{"names":{"n1":"one","n1":"two"}}}]}\n[ollama-timing: {"eval_count":30}]\n[ollama-input: {"promptStyle":"compact","imageSize":{"width":1024,"height":700}}]\n---\n';
    const [result] = replayResponses(saved, 'full');
    expect(result.blocks[0].figure!.labels).toEqual(['one', 'two']);
    expect(result.imageSize).toEqual({ width: 1024, height: 700 });
    expect(result.durationMs).toBe(0);
  });
  it('handles multiple requests and repairs a guarded partial prefix', () => {
    const saved = '{"blocks":[{"kind":"paragraph","text":"hello"}]}\n---\n{"blocks":[{"kind":"diagram","figure":{"labels":["word"\n[loop-guard: aborted at 300 chars]\n---\n';
    expect(replayResponses(saved, 'full').map((r) => r.blocks.length)).toEqual([1, 1]);
  });
  it('rejects empty or unusable saved responses', () => {
    expect(() => replayResponses('', 'full')).toThrow('No saved');
    expect(() => replayResponses('not JSON', 'compact')).toThrow();
  });
});
