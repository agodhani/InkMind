import type { DigitalBlock, FigureNode, InkStroke } from '../model/page';
import { boundsIntersect, expandBounds } from '../model/page';
import { buildStrokeGroups, strokeBounds } from '../transcribe/regions';

export function nodeInkStrokes(block: DigitalBlock, node: FigureNode | undefined, pageStrokes: InkStroke[]): string[] {
  if (node?.group === undefined || !Number.isInteger(node.group) || node.group < 0) return block.strokeIds;
  const ids = new Set(block.strokeIds);
  const nearby = pageStrokes.filter(stroke => boundsIntersect(strokeBounds(stroke), expandBounds(block.bbox, 18)));
  const local = pageStrokes.filter(stroke => ids.has(stroke.id));
  for (const strokes of [nearby, local]) {
    const candidate = buildStrokeGroups(strokes)[node.group]?.strokeIds;
    if (candidate?.length && candidate.length < ids.size && candidate.every(id => ids.has(id))) return candidate;
  }
  return block.strokeIds;
}
