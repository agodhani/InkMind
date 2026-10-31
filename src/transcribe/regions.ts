import type { BoundingBox } from '../types';
import { getStrokeBoundingBox } from '../types/brush';
import type { DigitalBlock, InkStroke } from '../model/page';
import { boundsIntersect, expandBounds, newId, sortBlocksForReading, unionBounds } from '../model/page';
import { clusterStrokes } from '../ink/StrokeClustering';
import type { RawBlock, StrokeGroupMeta } from './types';

export const REGION_PAD = 40;

export interface DirtyRegion {
  bounds: BoundingBox;
  strokes: InkStroke[];
  /** Existing blocks that overlap the region and will be replaced. */
  replacedBlockIds: string[];
}

export function strokeBounds(stroke: InkStroke): BoundingBox {
  return getStrokeBoundingBox(stroke) ?? { left: 0, top: 0, right: 0, bottom: 0 };
}

export function strokesBounds(strokes: InkStroke[]): BoundingBox | null {
  if (strokes.length === 0) return null;
  return strokes.map(strokeBounds).reduce(unionBounds);
}

/**
 * Given the strokes that changed since the last transcription, compute the
 * regions that must be re-transcribed. A region is the dirty strokes plus any
 * existing block they touch plus all strokes inside that expanded area, so a
 * word added to an existing line re-transcribes the whole line.
 */
export function computeDirtyRegions(
  page: { strokes: InkStroke[]; blocks: DigitalBlock[] },
  dirtyStrokeIds: Set<string>,
  deletedStrokeIds: Set<string> = new Set(),
): DirtyRegion[] {
  const byId = new Map(page.strokes.map((s) => [s.id, s]));
  const dirtyStrokes = [...dirtyStrokeIds].map((id) => byId.get(id)).filter((s): s is InkStroke => !!s);

  // Blocks whose strokes were deleted must be re-transcribed too.
  const seedBlocks = page.blocks.filter((b) => b.strokeIds.some((id) => deletedStrokeIds.has(id)));

  if (dirtyStrokes.length === 0 && seedBlocks.length === 0) return [];

  const seeds: BoundingBox[] = [
    ...clusterStrokes(dirtyStrokes, { spatialThreshold: 80, temporalThreshold: 60_000 }).map((c) => c.bounds),
    ...seedBlocks.map((b) => b.bbox),
  ];

  const regions: DirtyRegion[] = seeds.map((bounds) => ({ bounds: expandBounds(bounds, REGION_PAD), strokes: [], replacedBlockIds: [] }));

  // Grow each region to swallow overlapping blocks (and their strokes), then merge overlapping regions.
  let changed = true;
  while (changed) {
    changed = false;
    for (const region of regions) {
      for (const block of page.blocks) {
        if (region.replacedBlockIds.includes(block.id)) continue;
        if (block.kind === 'diagram' && !block.strokeIds.some((id) => dirtyStrokeIds.has(id) || deletedStrokeIds.has(id)) && !boundsIntersect(region.bounds, block.bbox, -REGION_PAD)) {
          // Do not pull in a neighbouring diagram just because of padding overlap.
          continue;
        }
        if (boundsIntersect(region.bounds, block.bbox)) {
          region.replacedBlockIds.push(block.id);
          region.bounds = unionBounds(region.bounds, expandBounds(block.bbox, REGION_PAD / 2));
          changed = true;
        }
      }
    }
    for (let i = 0; i < regions.length; i++) {
      for (let j = regions.length - 1; j > i; j--) {
        if (boundsIntersect(regions[i].bounds, regions[j].bounds)) {
          regions[i].bounds = unionBounds(regions[i].bounds, regions[j].bounds);
          regions[i].replacedBlockIds = [...new Set([...regions[i].replacedBlockIds, ...regions[j].replacedBlockIds])];
          regions.splice(j, 1);
          changed = true;
        }
      }
    }
  }

  for (const region of regions) {
    const blockStrokeIds = new Set(page.blocks.filter((b) => region.replacedBlockIds.includes(b.id)).flatMap((b) => b.strokeIds));
    region.strokes = page.strokes.filter(
      (s) => dirtyStrokeIds.has(s.id) || blockStrokeIds.has(s.id) || boundsIntersect(region.bounds, strokeBounds(s), -REGION_PAD / 2),
    );
    const sb = strokesBounds(region.strokes);
    if (sb) region.bounds = expandBounds(sb, REGION_PAD / 2);
  }

  return regions.filter((r) => r.strokes.length > 0 || r.replacedBlockIds.length > 0);
}

/** Group region strokes into line-ish clusters with written order. */
export function buildStrokeGroups(strokes: InkStroke[]): StrokeGroupMeta[] {
  const clusters = clusterStrokes(strokes, { spatialThreshold: 30, temporalThreshold: 4000 });
  const ordered = [...clusters].sort((a, b) => a.startTime - b.startTime);
  const writtenOrder = new Map(ordered.map((c, i) => [c, i]));
  return clusters
    .map((c) => ({
      strokeIds: (c.strokes as InkStroke[]).map((s) => s.id),
      bbox: c.bounds,
      writtenOrder: writtenOrder.get(c) ?? 0,
    }))
    .sort((a, b) => (Math.abs(a.bbox.top - b.bbox.top) > 18 ? a.bbox.top - b.bbox.top : a.bbox.left - b.bbox.left))
    .map((g, index) => ({ index, ...g }));
}

/** Map a raw model block to a DigitalBlock in page coordinates. */
export function rawToDigitalBlock(
  raw: RawBlock,
  groups: StrokeGroupMeta[],
  imageBounds: BoundingBox,
  imageSize: { width: number; height: number },
  regionStrokes: InkStroke[],
): DigitalBlock {
  const groupList = raw.groupIndices.map((i) => groups[i]).filter((g): g is StrokeGroupMeta => !!g);
  let strokeIds = groupList.flatMap((g) => g.strokeIds);
  let bbox: BoundingBox;
  if (groupList.length > 0) {
    bbox = groupList.map((g) => g.bbox).reduce(unionBounds);
  } else {
    const sx = (imageBounds.right - imageBounds.left) / Math.max(1, imageSize.width);
    const sy = (imageBounds.bottom - imageBounds.top) / Math.max(1, imageSize.height);
    bbox = {
      left: imageBounds.left + raw.bbox.left * sx,
      top: imageBounds.top + raw.bbox.top * sy,
      right: imageBounds.left + raw.bbox.right * sx,
      bottom: imageBounds.top + raw.bbox.bottom * sy,
    };
    strokeIds = regionStrokes.filter((s) => boundsIntersect(bbox, strokeBounds(s), -2)).map((s) => s.id);
  }
  return {
    id: newId('blk'),
    kind: raw.kind,
    text: raw.text,
    bbox,
    strokeIds,
    confidence: Math.max(0, Math.min(1, raw.confidence ?? 0.5)),
    marker: raw.marker,
    level: raw.level,
  };
}

/**
 * Replace the region's old blocks with the new ones. Keeps ids (and user edits)
 * for blocks whose text is unchanged, so the digital view stays stable.
 */
export function mergeBlocks(existing: DigitalBlock[], replacedIds: string[], incoming: DigitalBlock[]): DigitalBlock[] {
  const replaced = existing.filter((b) => replacedIds.includes(b.id));
  const kept = existing.filter((b) => !replacedIds.includes(b.id));
  const matched = incoming.map((nb) => {
    const same = replaced.find((ob) => ob.text.trim() === nb.text.trim() && ob.kind === nb.kind);
    if (same) return { ...nb, id: same.id, userEdited: same.userEdited };
    const edited = replaced.find((ob) => ob.userEdited && overlapRatio(ob.bbox, nb.bbox) > 0.6);
    if (edited) return { ...nb, id: edited.id, text: edited.text, userEdited: true };
    return nb;
  });
  return sortBlocksForReading([...kept, ...matched]);
}

export function overlapRatio(a: BoundingBox, b: BoundingBox): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  const areaA = (a.right - a.left) * (a.bottom - a.top);
  const areaB = (b.right - b.left) * (b.bottom - b.top);
  return inter / Math.max(1, Math.min(areaA, areaB));
}
