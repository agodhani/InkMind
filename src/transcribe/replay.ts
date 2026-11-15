import { parseOllamaOutput } from './ollama';

export function replayResponses(saved: string, fallbackStyle: 'full' | 'compact') {
  const chunks = saved.split(/\r?\n---\r?\n/).filter((s) => s.trim());
  if (!chunks.length) throw new Error('No saved model responses');
  return chunks.map((chunk) => {
    const input = chunk.match(/^\[ollama-input: (.+)\]\s*$/m);
    const meta = input ? JSON.parse(input[1]) : {};
    const raw = chunk.replace(/^\[(?:ollama-(?:timing|input)|loop-guard):[^\r\n]*\]\s*$/gm, '').trim();
    const style = meta.promptStyle === 'compact' || meta.promptStyle === 'full' ? meta.promptStyle : fallbackStyle;
    return { blocks: parseOllamaOutput(raw, style), imageSize: meta.imageSize as { width: number; height: number } | undefined, raw: chunk, model: 'replay', durationMs: 0 };
  });
}
