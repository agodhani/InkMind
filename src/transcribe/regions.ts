import type { BoundingBox } from '../types';
import { getStrokeBoundingBox } from '../types/brush';
import type { DigitalBlock, FigureInfo, InkStroke } from '../model/page';
import { boundsIntersect, expandBounds, newId, sortBlocksForReading, unionBounds } from '../model/page';
import { clusterStrokes } from '../ink/StrokeClustering';
import { analyseInk, namedEdges, type FigureHint } from '../ink/shapeHints';
import { figureCaption } from './figure';
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

/**
 * Group region strokes into line-ish clusters with written order, then run the geometric
 * shape classifier so each group carries a hint (circle, arrow, axes, looks like text…) and,
 * when it is part of a drawing, the figure it belongs to.
 */
export function buildStrokeGroups(strokes: InkStroke[]): StrokeGroupMeta[] {
  const clusters = clusterStrokes(strokes, { spatialThreshold: 30, temporalThreshold: 4000 });
  const ordered = [...clusters].sort((a, b) => a.startTime - b.startTime);
  const writtenOrder = new Map(ordered.map((c, i) => [c, i]));
  const groups: StrokeGroupMeta[] = clusters
    .map((c) => ({
      strokeIds: (c.strokes as InkStroke[]).map((s) => s.id),
      bbox: c.bounds,
      writtenOrder: writtenOrder.get(c) ?? 0,
    }))
    .sort((a, b) => (Math.abs(a.bbox.top - b.bbox.top) > 18 ? a.bbox.top - b.bbox.top : a.bbox.left - b.bbox.left))
    .map((g, index) => ({ index, ...g }));
  const analysis = analyseInk(strokes, groups);
  return groups.map((g) => {
    const hint = analysis.hints.get(g.index);
    const figure = analysis.figures.find((f) => f.groupIndices.includes(g.index));
    return { ...g, ...(hint ? { hint } : {}), ...(figure ? { figure } : {}) };
  });
}

/** Figures detected by geometry in these groups, each once, in reading order. */
export function figuresOf(groups: StrokeGroupMeta[]): FigureHint[] {
  const seen = new Map<number, FigureHint>();
  for (const g of groups) if (g.figure && !seen.has(g.figure.id)) seen.set(g.figure.id, g.figure);
  return [...seen.values()].sort((a, b) => a.id - b.id);
}

/**
 * Geometry found figures (a shape with a label inside, box → arrow → box, axes + curve, a cube).
 * Whatever the model did with those groups — split the drawing into paragraphs, captioned only
 * part of it, or skipped it — each figure ends up as exactly ONE diagram block that owns all of the
 * figure's strokes. Text the geometry did not assign to the figure stays in its own text block.
 */
export function reconcileFigureBlocks(incoming: DigitalBlock[], groups: StrokeGroupMeta[], strokes: InkStroke[]): DigitalBlock[] {
  const figures = figuresOf(groups);
  if (figures.length === 0) return incoming;
  const strokeById = new Map(strokes.map((s) => [s.id, s]));
  const boundsOf = (ids: string[], fallback: BoundingBox) => strokesBounds(ids.map((id) => strokeById.get(id)).filter((s): s is InkStroke => !!s)) ?? fallback;
  let blocks = incoming;
  for (const fig of figures) {
    const figGroups = groups.filter((g) => g.figure?.id === fig.id);
    const figStrokeIds = new Set(figGroups.flatMap((g) => g.strokeIds));
    const labelStrokeIds = new Set(figGroups.filter((g) => fig.labelGroups.includes(g.index)).flatMap((g) => g.strokeIds));
    const members: DigitalBlock[] = [];
    const rest: DigitalBlock[] = [];
    for (const b of blocks) {
      const inside = b.strokeIds.filter((id) => figStrokeIds.has(id));
      if (inside.length === 0) rest.push(b);
      else if (b.kind === 'diagram' || inside.length === b.strokeIds.length || inside.length >= 0.5 * b.strokeIds.length) members.push(b);
      else {
        // A sentence beside the figure that the model lumped together with part of it: keep it as text.
        const outside = b.strokeIds.filter((id) => !figStrokeIds.has(id));
        rest.push({ ...b, strokeIds: outside, bbox: boundsOf(outside, b.bbox) });
      }
    }
    const diagram = members.find((b) => b.kind === 'diagram');
    const textMembers = members.filter((b) => b.kind !== 'diagram' && b.text.trim());
    // Text the model read on the figure's label groups are labels; text "read" on drawn strokes is noise.
    const labelTexts = textMembers.filter((b) => b.strokeIds.some((id) => labelStrokeIds.has(id))).flatMap((b) => b.text.split('\n')).map(cleanLabel).filter(Boolean);
    const labelFor = (groupIndex: number) => {
      const ids = new Set(groups[groupIndex]?.strokeIds ?? []);
      const hit = textMembers.find((b) => b.strokeIds.some((id) => ids.has(id) && labelStrokeIds.has(id)));
      return hit ? cleanLabel(hit.text) || undefined : undefined;
    };
    const prior = diagram?.figure;
    const labels = dedupe([...(prior?.labels ?? []), ...labelTexts]);
    const figure: FigureInfo = {
      kind: prior?.kind && prior.kind !== 'other' ? prior.kind : fig.kind,
      shapes: prior?.shapes.length ? prior.shapes : fig.shapes,
      labels,
      edges: prior?.edges.length ? prior.edges : namedEdges(fig, labelFor),
    };
    const strokeIds = dedupe([...members.flatMap((b) => b.strokeIds), ...figStrokeIds]);
    const bbox = boundsOf(strokeIds, diagram?.bbox ?? figGroups.map((g) => g.bbox).reduce(unionBounds));
    const text = diagram?.text.trim() || figureCaption(figure);
    const confidence = diagram?.confidence ?? (textMembers.length ? Math.min(...textMembers.map((b) => b.confidence)) : 0.4);
    const merged: DigitalBlock = { ...(diagram ?? { id: newId('blk') }), kind: 'diagram', text, bbox, strokeIds, confidence, figure };
    delete merged.marker;
    delete merged.level;
    blocks = [...rest, merged];
  }
  // Small models sometimes return an empty "diagram" for a line of text beside a figure: it carries nothing, drop it.
  const figureStrokeIds = new Set(groups.filter((g) => g.figure).flatMap((g) => g.strokeIds));
  blocks = blocks.filter((b) => b.kind !== 'diagram' || b.text.trim() || b.figure || b.strokeIds.some((id) => figureStrokeIds.has(id)));
  return sortBlocksForReading(blocks);
}

function cleanLabel(s: string): string {
  return s.replace(/^[-*•\d.)\s]+/, '').replace(/^#+\s*/, '').trim();
}

function dedupe<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)];
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
    ...(raw.figure ? { figure: raw.figure } : {}),
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

/**
 * Whole-page runs re-transcribe everything, including lines the user already
 * corrected. Keep a user-edited block verbatim when none of its strokes changed,
 * and reconcile incoming blocks that claim those strokes so the correction is not
 * overwritten or duplicated by a re-read:
 * - mostly protected strokes → the incoming block is the re-read of the correction; drop it;
 * - mostly new strokes → keep it for the new ink, minus the protected strokes, and strip
 *   the corrected text from it when the model repeated it verbatim (a mixed block whose
 *   wording differs can still echo a few corrected words; the next pause re-groups them).
 */
export function protectEditedBlocks(
  existing: DigitalBlock[],
  incoming: DigitalBlock[],
  changedStrokeIds: Set<string>,
): { replacedIds: string[]; incoming: DigitalBlock[] } {
  const protectedBlocks = existing.filter((b) => b.userEdited && b.strokeIds.length > 0 && !b.strokeIds.some((id) => changedStrokeIds.has(id)));
  if (protectedBlocks.length === 0) return { replacedIds: existing.map((b) => b.id), incoming };
  const strokeOwner = new Map(protectedBlocks.flatMap((b) => b.strokeIds.map((id) => [id, b] as const)));
  const protectedIds = new Set(protectedBlocks.map((b) => b.id));
  const reconciled: DigitalBlock[] = [];
  for (const b of incoming) {
    const owners = new Set(b.strokeIds.map((id) => strokeOwner.get(id)).filter((o): o is DigitalBlock => !!o));
    if (owners.size === 0) {
      reconciled.push(b);
      continue;
    }
    const own = b.strokeIds.filter((id) => !strokeOwner.has(id));
    if (own.length === 0 || own.length / b.strokeIds.length < 0.5) continue;
    let text = b.text;
    for (const o of owners) text = stripText(text, o.text);
    if (text.trim()) reconciled.push({ ...b, strokeIds: own, text });
  }
  return { replacedIds: existing.filter((b) => !protectedIds.has(b.id)).map((b) => b.id), incoming: reconciled };
}

/** Remove `needle` from `haystack` only as a whole word/phrase (so "cat" never eats into "catalog"). */
function stripText(haystack: string, needle: string): string {
  const n = needle.trim();
  if (!n) return haystack;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  // Scripts without word spacing (CJK) get no boundary requirement on that side.
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  const lead = cjk.test(n[0]) ? '()' : '(^|[^\\p{L}\\p{N}])';
  const trail = cjk.test(n[n.length - 1]) ? '' : '(?=$|[^\\p{L}\\p{N}])';
  const re = new RegExp(`${lead}${escaped}${trail}`, 'iu');
  const m = re.exec(haystack);
  if (!m) return haystack;
  return (haystack.slice(0, m.index) + m[1] + haystack.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim();
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
