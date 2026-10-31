import type { BlockKind } from '../model/page';
import type { TranscribeRequest } from './types';

export const BLOCK_KINDS: BlockKind[] = [
  'heading', 'paragraph', 'list', 'checklist', 'footnote_ref', 'footnote_def', 'math', 'diagram', 'table', 'margin_note', 'unknown',
];

export const SYSTEM_PROMPT = `You transcribe a region of a page of handwritten study notes into structured digital blocks.

The writer's handwriting may be messy. Use the page topic, the glossary, the writer's habits and the example transcriptions to resolve ambiguous letters. Prefer a plausible technical term over a nonsense word.

Rules:
- Output ONLY a JSON object: {"blocks": [...]}. No prose, no markdown fences.
- Each block: {"kind","text","bbox":{"left","top","right","bottom"},"groupIndices":[...],"confidence":0-1,"marker"?,"level"?}
- kind is one of: ${BLOCK_KINDS.join(', ')}.
- bbox is in IMAGE PIXEL coordinates of the image you were given.
- groupIndices lists the stroke-group indices (from the metadata) that form the block. Every group should belong to exactly one block. Use [] only if you cannot tell.
- text is Markdown: "# " headings (set level 1-3), "- " bullets, "1. " numbered, "- [ ] / - [x]" checklists, $...$ for inline math, $$...$$ for display math. Keep the writer's line breaks inside a block only when they matter (lists).
- Footnotes: a marker such as *, †, ‡, (1), ¹ next to text is a footnote_ref (the block's text is the text that carries the marker; set "marker"). The definition elsewhere on the page (often the bottom or margin) is a footnote_def with the same "marker" and the definition text WITHOUT the marker.
- Diagrams, sketches, arrows between boxes, graphs, drawings: ONE block of kind "diagram" covering the whole drawing. Its text is a one- or two-sentence caption describing what it shows, and any labels you can read, e.g. "Flow: policy → reward model → PPO update; labels: 'rollouts', 'KL'". Never transcribe a diagram as paragraphs.
- Labels that belong to a diagram are part of the diagram block, not separate paragraphs.
- margin_note: short text written in a margin or rotated, clearly separate from the main flow.
- Crossed-out text: omit it.
- confidence reflects how sure you are of the text, not the layout.`;

export function buildUserPrompt(req: TranscribeRequest): string {
  const parts: string[] = [];
  parts.push(`Page title: ${req.pageTitle || '(untitled)'}`);
  if (req.contextText.trim()) parts.push(`Already-transcribed nearby text (context only, do not repeat):\n${req.contextText.trim().slice(0, 1500)}`);
  if (req.profile.glossary.length) parts.push(`Writer's glossary (terms they often write): ${req.profile.glossary.slice(0, 80).join(', ')}`);
  if (req.profile.habits.length) parts.push(`Writer's habits:\n- ${req.profile.habits.slice(0, 20).join('\n- ')}`);
  parts.push(`Image size: ${req.imageSize.width}x${req.imageSize.height} px.`);
  parts.push(
    `Stroke groups (index: bbox in image px, strokes, written order):\n` +
      req.groups
        .map((g) => {
          const b = toImagePx(g.bbox, req);
          return `${g.index}: [${b.left},${b.top},${b.right},${b.bottom}] n=${g.strokeIds.length} order=${g.writtenOrder}`;
        })
        .join('\n'),
  );
  parts.push('Transcribe the region in the image into blocks.');
  return parts.join('\n\n');
}

export function toImagePx(b: { left: number; top: number; right: number; bottom: number }, req: TranscribeRequest) {
  const sx = req.imageSize.width / Math.max(1, req.imageBounds.right - req.imageBounds.left);
  const sy = req.imageSize.height / Math.max(1, req.imageBounds.bottom - req.imageBounds.top);
  return {
    left: Math.round((b.left - req.imageBounds.left) * sx),
    top: Math.round((b.top - req.imageBounds.top) * sy),
    right: Math.round((b.right - req.imageBounds.left) * sx),
    bottom: Math.round((b.bottom - req.imageBounds.top) * sy),
  };
}

/** Pull a JSON object out of a model reply that may contain fences or prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('Model reply did not contain JSON');
  }
}
