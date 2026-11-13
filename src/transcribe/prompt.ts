import type { BlockKind } from '../model/page';
import type { TranscribeRequest } from './types';

export const BLOCK_KINDS: BlockKind[] = [
  'heading', 'paragraph', 'list', 'checklist', 'footnote_ref', 'footnote_def', 'math', 'diagram', 'table', 'margin_note', 'unknown',
];

export const SYSTEM_PROMPT = `You transcribe a region of a page of handwritten study notes into structured digital blocks.

The writer's handwriting may be messy. Use the page topic, the glossary, the writer's habits and the example transcriptions to resolve ambiguous letters. Prefer a plausible technical term over a nonsense word.

Rules:
- Output ONLY a JSON object: {"blocks": [...]}. No prose, no markdown fences.
- Each block has exactly this shape (numbers are examples):
  {"kind": "list", "text": "- SFT on demos", "bbox": {"left": 120, "top": 80, "right": 640, "bottom": 130}, "groupIndices": [2], "confidence": 0.8, "marker": null, "level": null}
  bbox holds four numbers and nothing else; groupIndices and confidence are top-level fields of the block.
- kind is one of: ${BLOCK_KINDS.join(', ')}.
- bbox is in IMAGE PIXEL coordinates of the image you were given.
- groupIndices lists the stroke-group indices (from the metadata) that form the block. Every group should belong to exactly one block. Use [] only if you cannot tell.
- text is Markdown: "# " headings (set level 1-3), "- " bullets, "1. " numbered, "- [ ] / - [x]" checklists, $...$ for inline math, $$...$$ for display math. Keep the writer's line breaks inside a block only when they matter (lists).
- Footnotes: a marker such as *, †, ‡, (1), ¹ next to text is a footnote_ref (the block's text is the text that carries the marker; set "marker"). The definition elsewhere on the page (often the bottom or margin) is a footnote_def with the same "marker" and the definition text WITHOUT the marker.
- Diagrams, sketches, arrows between boxes, graphs, drawings: ONE block of kind "diagram" covering the WHOLE drawing, even when it spans several stroke groups. Never transcribe a drawing as paragraphs, and never invent words for strokes that are a drawing.
- Labels written inside or against a figure (text in a box, next to an arrow, on an axis) belong to the diagram block, not to separate paragraphs. A line of notes beside a figure that is not part of it stays a normal text block.
- Shape hints: the stroke-group metadata includes a geometric analysis of the ink ("closed shape: circle", "arrow → right", "axes (L-shaped corner)", "cube / 3D box", "looks like text"). Trust it: a group hinted as a shape, arrow, axes, lifeline or cube is a drawing and must NEVER be transcribed as text; a group hinted "looks like text" is handwriting. When the metadata lists a "Figure", output exactly one diagram block whose groupIndices are ALL of that figure's groups (drawing + labels).
- Figure hints encode RELATIONS and ORDER measured from the ink: "nodes" (n1, n2, … with the shape and the group holding each node's label), "edges" (which node each arrow leaves and points at, "(back-edge)" for an arrow that loops back to an earlier step, "↺ self-loop", "—" for a plain connecting line, "(label group N)" for text written on the arrow), "step order", "nested" (a shape drawn inside another), "lifelines" and "messages" (sequence diagrams), and "table grid" with "cells". These relations are reliable: use them. Your job is to READ THE WORDS in each label group and attach them to the right node/edge/cell; do not contradict an arrow's direction or drop an edge the geometry lists.
- Diagram caption format (the block's text): "Shape: <what is drawn>. Labels: <every label you can read, comma-separated>. Relations: <a → b, c → d>." Describe shapes plainly:
  circles/ellipses ("a circle with a word written inside"), rectangles/squares ("two boxes side by side"), cubes/3D boxes ("an isometric cube, 3 visible faces"),
  graphs/plots ("x/y axes, an increasing curve with a label, ticks"; bar charts: list bar labels and relative heights), flowcharts/trees ("box → diamond → box"; children of a tree node), tables ("3 rows × 2 columns"),
  arrows and connections ("arrow from <first node's word> to <second node's word>"). Say "Relations: none" when nothing connects and "Labels: none" when nothing is written.
- Diagram blocks also carry a "figure" object:
  {"kind": "flowchart|graph|plot|sketch|tree|cube|shape|table|sequence|mindmap|other",
   "shapes": ["<shape drawn>", ...],
   "labels": ["<word written in the figure>", ...],
   "nodes": [{"id": "<node id from the hints>", "group": <number of that node's label group from the hints>, "label": "<word written in/at that node>", "shape": "<its shape>", "parent": "<id of the node it is drawn inside, only when nested>"}],
   "edges": [{"from": "<label of the node the arrow leaves>", "to": "<label of the node it points at>", "label": "<text on the arrow, optional>", "kind": "arrow|line|self-loop"}],
   "sequence": ["<first step's label>", "<second step's label>", ...],
   "cells": [["<row 1 col 1>", "<row 1 col 2>"], ["<row 2 col 1>", ...]]}.
  labels are ONLY words physically written in the figure, verbatim (use [] when there are none). edges name nodes by their WRITTEN LABEL, never by node id or group number, and follow each drawn arrow from tail to head (a back-edge goes from the later step to the earlier one; a self-loop has from = to). sequence lists the steps/states in arrow order (the hints' "step order"), or reading order when nothing connects. nodes is for flowcharts, graphs, trees, state machines, mind maps and nested shapes — one entry per hinted node, in hint order, with parent set for a shape inside another. cells is for tables only, row by row, header row first. Omit sequence/nodes/cells when they do not apply. Never copy the placeholders or examples from these instructions, and never use group numbers ("group 3") or node ids ("n2") as labels — write the words the person wrote. If a label cannot be read, use its shape name ("diamond", "box 2") rather than inventing a word.
- margin_note: short text written in a margin or rotated, clearly separate from the main flow.
- Crossed-out text: omit it.
- Never describe or summarise what the writing is about. Every text block must be a transcription of
  words that are physically on the page. If a line is hard to read, give your best guess of the words
  with a low confidence; do not write captions like "diagram showing…" for text, and do not invent
  content for regions you cannot read.
- confidence reflects how sure you are of the text, not the layout.`;

export function buildUserPrompt(req: TranscribeRequest): string {
  const parts: string[] = [];
  parts.push(`Page title: ${req.pageTitle || '(untitled)'}`);
  if (req.contextText.trim()) parts.push(`Already-transcribed nearby text (context only, do not repeat):\n${req.contextText.trim().slice(0, 1500)}`);
  if (req.profile.glossary.length) parts.push(`Writer's glossary (terms they often write): ${req.profile.glossary.slice(0, 80).join(', ')}`);
  if (req.profile.habits.length) parts.push(`Writer's habits:\n- ${req.profile.habits.slice(0, 20).join('\n- ')}`);
  parts.push(`Image size: ${req.imageSize.width}x${req.imageSize.height} px.`);
  parts.push(
    `Stroke groups (index: bbox in image px, strokes, written order, shape hint):\n` +
      req.groups
        .map((g) => {
          const b = toImagePx(g.bbox, req);
          return `${g.index}: [${b.left},${b.top},${b.right},${b.bottom}] n=${g.strokeIds.length} order=${g.writtenOrder}${g.hint ? ` — ${g.hint}` : ''}`;
        })
        .join('\n'),
  );
  const figures = figureSummaries(req.groups);
  if (figures.length) {
    parts.push(
      `Figures found by geometry (each must be exactly ONE diagram block with all of its groups; read the words in each label group and put them in figure.labels, on the matching node/edge/cell, and in the caption; keep every listed edge and the step order; never transcribe the drawing groups as text):\n${figures.join('\n')}`,
    );
  }
  parts.push('Transcribe the region in the image into blocks.');
  return parts.join('\n\n');
}

function figureSummaries(groups: TranscribeRequest['groups']): string[] {
  const seen = new Map<number, string>();
  for (const g of groups) if (g.figure && !seen.has(g.figure.id)) seen.set(g.figure.id, g.figure.summary);
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
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

export class ModelOutputError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = 'ModelOutputError';
    this.raw = raw;
  }
}

/**
 * Pull a JSON object out of a model reply that may contain fences or prose.
 * Small models often truncate or corrupt the tail; in that case salvage every
 * complete block object we can find rather than losing the whole region.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        const blocks = salvageObjects(candidate.slice(start + 1));
        if (blocks.length) return { blocks };
      }
    }
    throw new ModelOutputError('Model reply did not contain usable JSON', text);
  }
}

/** Parse every complete top-level `{...}` object in `text` (string-aware brace matching). */
export function salvageObjects(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const obj = JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
          if (obj && typeof obj === 'object' && 'kind' in obj) out.push(obj);
        } catch {
          /* skip corrupt object */
        }
        start = -1;
      } else if (depth < 0) depth = 0;
    }
  }
  return out;
}
