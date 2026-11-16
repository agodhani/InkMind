import type { BoundingBox } from '../types';
import { getStrokeBoundingBox, getStrokeStartTime } from '../types/brush';
import type { DigitalBlock, FigureEdge, FigureInfo, FigureNode, InkStroke } from '../model/page';
import { boundsIntersect, expandBounds, newId, sortBlocksForReading, unionBounds } from '../model/page';
import { clusterStrokes } from '../ink/StrokeClustering';
import { analyseGroup, analyseInk, figureFromGeometry, fullyContains, type FigureHint, type FigureNodeHint } from '../ink/shapeHints';
import { cellGrid, figureCaption, isGroupRef, resolveNodeRefs, sequenceEdgeIndices, stringList } from './figure';
import type { RawBlock, StrokeGroupMeta } from './types';

export const REGION_PAD = 40;

function isPlotLabel(fig: FigureHint, box: BoundingBox): boolean {
  return fig.plotLabelBounds?.some((bbox) => fullyContains({ bbox, shape: 'rectangle' }, { bbox: box, shape: 'text' }) && box.bottom - box.top <= 0.15 * (fig.plotLabelBounds![0].bottom - fig.plotLabelBounds![0].top)) ?? false;
}

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
  const initial = clusterStrokes(strokes, { spatialThreshold: 30, temporalThreshold: 4000 });
  const clusters = initial.flatMap((c) => {
    const ink = c.strokes as InkStroke[];
    const a = analyseGroup({ index: 0, strokeIds: ink.map((s) => s.id), bbox: c.bounds }, ink);
    if (a.closed.length < 2 || a.axes || a.cube) return [c];
    const box = a.closed.map((s) => s.bbox).reduce(unionBounds);
    const outside = new Set(a.textStrokes.filter((s) => !boundsIntersect(s.bbox, box)).map((s) => s.strokeId));
    if (!outside.size) return [c];
    return [ink.filter((s) => !outside.has(s.id)), ink.filter((s) => outside.has(s.id))].flatMap((part) => clusterStrokes(part, { spatialThreshold: 30, temporalThreshold: 4000 }));
  });
  const ordered = [...clusters].sort((a, b) => a.startTime - b.startTime);
  const writtenOrder = new Map(ordered.map((c, i) => [c, i]));
  const groups: StrokeGroupMeta[] = clusters
    .map((c) => ({
      strokeIds: [...c.strokes as InkStroke[]].sort((a, b) => getStrokeStartTime(a) - getStrokeStartTime(b)).map((s) => s.id),
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
  const drawingIds = new Set(groups.filter((g) => g.figure).flatMap((g) => g.strokeIds));
  if (incoming.some((b) => b.kind === 'diagram')) incoming = incoming.map((b) => b.kind === 'diagram' && b.strokeIds.length && b.strokeIds.every((id) => !drawingIds.has(id)) &&
    b.figure?.labels.length && !b.figure.shapes.length && !b.figure.edges.length && !b.figure.cells?.length && !b.figure.sequence?.length && !b.figure.nodes?.some((n) => (n.shape && n.shape !== 'text') || n.parent || n.parents?.length)
    ? { ...b, kind: 'paragraph', text: b.figure.labels.join('\n'), figure: undefined } : b);
  const figures = figuresOf(groups);
  if (figures.length === 0) return incoming;
  if (figures.length === 1 && groups.every((g) => g.figure)) incoming = incoming.map((b) => b.kind !== 'diagram' && !b.strokeIds.length && b.text.trim() && (!figures[0].plotLabelBounds || isPlotLabel(figures[0], b.bbox))
    ? { ...b, strokeIds: groups.flatMap((g) => g.strokeIds) } : b);
  const strokeById = new Map(strokes.map((s) => [s.id, s]));
  const boundsOf = (ids: string[], fallback: BoundingBox) => strokesBounds(ids.map((id) => strokeById.get(id)).filter((s): s is InkStroke => !!s)) ?? fallback;
  // A diagram the model placed by bbox only (no groups) describes the figure it overlaps, else the nearest one.
  const figBoxOf = (fig: FigureHint) => groups.filter((g) => g.figure?.id === fig.id).map((g) => g.bbox).reduce(unionBounds);
  const orphanOwner = new Map<DigitalBlock, number>();
  for (const b of incoming) {
    if (b.kind !== 'diagram' || b.strokeIds.length > 0) continue;
    const c = { x: (b.bbox.left + b.bbox.right) / 2, y: (b.bbox.top + b.bbox.bottom) / 2 };
    const ranked = figures
      .map((f) => ({ f, box: figBoxOf(f) }))
      .map(({ f, box }) => ({ f, hit: boundsIntersect(b.bbox, box), near: boundsIntersect(b.bbox, expandBounds(box, Math.max(box.right - box.left, box.bottom - box.top))), d: Math.hypot(c.x - (box.left + box.right) / 2, c.y - (box.top + box.bottom) / 2) }))
      .filter((r) => r.hit || r.near)
      .sort((p, q) => Number(q.hit) - Number(p.hit) || p.d - q.d);
    if (ranked.length) orphanOwner.set(b, ranked[0].f.id);
  }
  let blocks = incoming;
  for (const fig of figures) {
    const figGroups = groups.filter((g) => g.figure?.id === fig.id);
    const figStrokeIds = new Set(figGroups.flatMap((g) => g.strokeIds));
    const labelStrokeIds = new Set(figGroups.filter((g) => fig.labelGroups.includes(g.index) || fig.labelHostGroups.includes(g.index)).flatMap((g) => g.strokeIds));
    const members: DigitalBlock[] = [];
    const rest: DigitalBlock[] = [];
    for (const b of blocks) {
      const inside = b.strokeIds.filter((id) => figStrokeIds.has(id));
      if (orphanOwner.get(b) === fig.id) members.push(b);
      else if (inside.length === 0) rest.push(b);
      else if (inside.length === b.strokeIds.length) members.push(b);
      else {
        // Text the model lumped together with part of the figure: its words must survive, so it
        // stays a text block on the strokes outside the figure (the figure takes the rest).
        const outside = b.strokeIds.filter((id) => !figStrokeIds.has(id));
        if (b.kind === 'diagram') {
          const insideMajority = inside.length >= outside.length;
          const remainingDrawing = outside.some((id) => drawingIds.has(id));
          members.push({ ...b, strokeIds: inside, bbox: boundsOf(inside, b.bbox), figure: insideMajority || !remainingDrawing ? b.figure : undefined, text: insideMajority ? b.text : '' });
          rest.push({ ...b, id: newId('blk'), kind: remainingDrawing ? 'diagram' : 'paragraph', figure: insideMajority || !remainingDrawing ? undefined : b.figure, text: insideMajority ? '' : b.text, strokeIds: outside, bbox: boundsOf(outside, b.bbox) });
        } else rest.push({ ...b, strokeIds: outside, bbox: boundsOf(outside, b.bbox) });
      }
    }
    const diagrams = members.filter((b) => b.kind === 'diagram');
    const diagram = diagrams[0];
    const textMembers = members.filter((b) => b.kind !== 'diagram' && b.text.trim());
    // Text the model read on the figure's label groups are labels; text "read" on drawn strokes is noise.
    const labelTexts = textMembers.filter((b) => fig.plotLabelBounds ? isPlotLabel(fig, b.bbox) : b.strokeIds.some((id) => labelStrokeIds.has(id))).flatMap((b) => b.text.split('\n')).map(cleanLabel).filter(Boolean);
    const labelGroupIdx = new Set([...fig.labelGroups, ...fig.labelHostGroups]);
    const labelFor = (groupIndex: number) => {
      const ids = new Set(groups[groupIndex]?.strokeIds ?? []);
      const hit = textMembers.find((b) => b.strokeIds.some((id) => ids.has(id) && labelStrokeIds.has(id)));
      if (!hit) return undefined;
      // One text block read over several label groups: give each group its own line when the counts match.
      const covered = figGroups.filter((g) => labelGroupIdx.has(g.index) && hit.strokeIds.some((id) => g.strokeIds.includes(id)));
      const lines = hit.text.split('\n').map(cleanLabel).filter(Boolean);
      if (fig.nodes.filter((n) => (n.labelGroup ?? n.groupIndex) === groupIndex).length > 1) return undefined;
      if (covered.length > 1 && lines.length === covered.length) {
        const ordered = [...covered].sort((a, b) => (Math.abs(a.bbox.top - b.bbox.top) > 18 ? a.bbox.top - b.bbox.top : a.bbox.left - b.bbox.left));
        const i = ordered.findIndex((g) => g.index === groupIndex);
        if (i >= 0) return lines[i];
      }
      if (covered.length > 1) return undefined;
      return cleanLabel(hit.text) || undefined;
    };
    // The model may have answered with several diagram blocks for one figure: fold them into one.
    const prior = diagrams.map((b) => b.figure).filter((f): f is FigureInfo => !!f).reduce<FigureInfo | undefined>((acc, f) => (acc ? mergeFigures(acc, f) : f), undefined);
    const labels = dedupe([...(prior?.labels ?? []), ...labelTexts]);
    const figure = mergeWithGeometry(prior, fig, labels, figureFromGeometry(fig, labelFor, groups, (node) => {
      const ids = new Set(node.strokeIds ?? []);
      const hit = textMembers.filter((b) => b.strokeIds.length && b.strokeIds.filter((id) => ids.has(id)).length > b.strokeIds.length / 2)
        .sort((a, b) => a.strokeIds.length - b.strokeIds.length)[0];
      return hit ? cleanLabel(hit.text) : undefined;
    }));
    if (figure.kind === 'table' && fig.cellBounds) {
      const tableText = textMembers.find((b) => b.kind === 'table') ?? textMembers.find((b) => b.text.includes('\n'));
      const fallback = prior?.cells ?? (tableText ? cellGrid(tableText.text) : []);
      const fits = fallback.length > 0 && fallback.length <= fig.cellBounds.length && fallback.every((row, r) => row.length <= fig.cellBounds![r].length);
      figure.cells = fig.cellBounds.map((row) => row.map((cell) => {
        const within = (box: BoundingBox) => box.left >= cell.left - 6 && box.right <= cell.right + 6 && box.top >= cell.top - 6 && box.bottom <= cell.bottom + 6;
        const located = [
          ...textMembers.filter((b) => b.text.trim() && within(b.bbox)).map((b) => ({ text: b.text, bbox: b.bbox })),
          ...(prior?.nodes ?? []).flatMap((n) => {
            const anchored = (n.strokeIds ?? []).flatMap((id) => strokeById.has(id) ? [strokeById.get(id)!] : []);
            const bbox = n.bbox ?? strokesBounds(anchored);
            return bbox && within(bbox) ? [{ text: n.label, bbox }] : [];
          }),
        ];
        const unique = located.filter((b, i) => located.findIndex((other) => sameText(other.text, b.text)) === i);
        unique.sort((a, b) => Math.abs(a.bbox.top - b.bbox.top) > 12 ? a.bbox.top - b.bbox.top : a.bbox.left - b.bbox.left);
        return unique.map((b) => cleanLabel(b.text)).join(' ');
      }));
      if (!figure.cells.flat().some(Boolean) && fits) figure.cells = fig.cellBounds.map((row, r) => row.map((_, c) => fallback[r]?.[c] ?? ''));
      figure.labels = dedupe([...figure.labels, ...figure.cells.flat().filter(Boolean)]);
    } else if (figure.kind === 'table' && !prior?.cells?.length) {
      const tableText = textMembers.find((b) => b.kind === 'table') ?? textMembers.find((b) => b.text.includes('\n'));
      const cells = tableText ? cellGrid(tableText.text) : [];
      if (cells.flat().filter(Boolean).length >= 2) {
        // Keep the drawn grid's size: a row the model skipped (empty cells) stays a row.
        const rows = Math.max(cells.length, fig.cells?.length ?? 0), cols = Math.max(cells[0].length, fig.cells?.[0]?.length ?? 0);
        figure.cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => cells[r]?.[c] ?? ''));
        figure.labels = dedupe([...figure.labels.filter((l) => !cells.some((row) => row.join(' ') === l)), ...cells.flat().filter(Boolean)]);
      }
    }
    const strokeIds = dedupe([...figStrokeIds, ...members.flatMap((b) => b.strokeIds)]);
    const bbox = boundsOf(strokeIds, diagram?.bbox ?? figGroups.map((g) => g.bbox).reduce(unionBounds));
    const text = diagrams.map((b) => b.text.trim()).find(Boolean) || figureCaption(figure);
    const confidence = diagrams.length ? Math.min(...diagrams.map((b) => b.confidence)) : textMembers.length ? Math.min(...textMembers.map((b) => b.confidence)) : 0.4;
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

export function attachUnclaimedStrokes(incoming: DigitalBlock[], strokes: InkStroke[]): DigitalBlock[] {
  if (!incoming.length) return incoming;
  const claimed = new Set(incoming.flatMap((b) => b.strokeIds));
  const unclaimed = strokes.filter((s) => !claimed.has(s.id));
  if (!unclaimed.length) return incoming;
  const target = incoming.findLastIndex((b) => b.kind !== 'diagram');
  const blocks = [...incoming];
  if (target < 0) {
    blocks.push({ id: newId('blk'), kind: 'paragraph', text: '', strokeIds: unclaimed.map((s) => s.id), bbox: strokesBounds(unclaimed)!, confidence: 0.4 });
  } else {
    const b = blocks[target];
    const strokeIds = [...b.strokeIds, ...unclaimed.map((s) => s.id)];
    const ids = new Set(strokeIds);
    blocks[target] = { ...b, strokeIds, bbox: strokesBounds(strokes.filter((s) => ids.has(s.id))) ?? b.bbox };
  }
  return sortBlocksForReading(blocks);
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Union of two model figures for the same drawing (labels, nodes, edges; the longer sequence; the first table). */
export function mergeFigures(a: FigureInfo, b: FigureInfo): FigureInfo {
  const out: FigureInfo = {
    kind: a.kind !== 'other' ? a.kind : b.kind,
    shapes: dedupe([...a.shapes, ...b.shapes]),
    labels: dedupe([...a.labels, ...b.labels]),
    edges: [...a.edges],
  };
  for (const e of b.edges) {
    // The same arrow described twice, once without its label: one edge, labelled.
    const same = out.edges.find((x) => sameEdge(x, e) && (x.kind ?? 'arrow') === (e.kind ?? 'arrow') && (!x.label || !e.label || x.label === e.label));
    if (!same) out.edges.push(e);
    else if (!same.label && e.label) same.label = e.label;
  }
  const nodes = (a.nodes ?? []).map((n) => ({ ...n }));
  for (const n of b.nodes ?? []) {
    const same = nodes.find((x) => sameText(x.label, n.label));
    if (!same) nodes.push({ ...n });
    else {
      if (same.strokeIds || n.strokeIds) same.strokeIds = dedupe([...(same.strokeIds ?? []), ...(n.strokeIds ?? [])]);
      if (same.parents || n.parents) same.parents = dedupe([...(same.parents ?? []), ...(n.parents ?? [])]);
    }
  }
  if (nodes.length) out.nodes = nodes;
  const sequence = (a.sequence?.length ?? 0) >= (b.sequence?.length ?? 0) ? a.sequence : b.sequence;
  if (sequence?.length) out.sequence = sequence;
  const cells = a.cells?.length ? a.cells : b.cells;
  if (cells?.length) out.cells = cells;
  return out;
}

/**
 * Geometry nodes whose word was not read as a text block ("rectangle 2") take the label the model
 * gave the node with the same hint id ("n2"), so geometry edges/sequence speak in the model's words.
 */
function modelNodeFor(g: FigureNode, geoNodes: FigureNode[], modelNodes: FigureNode[], hint?: FigureNodeHint): FigureNode | undefined {
  if (g.bbox) {
    const positioned = modelNodes.map((n) => {
      const overlap = n.strokeIds?.filter((id) => (hint?.strokeIds ?? g.strokeIds)?.includes(id)).length ?? 0;
      const c = n.bbox ? { x: (n.bbox.left + n.bbox.right) / 2, y: (n.bbox.top + n.bbox.bottom) / 2 } : undefined;
      const box = expandBounds(g.bbox!, 12);
      const inside = c && c.x >= box.left && c.x <= box.right && c.y >= box.top && c.y <= box.bottom;
      const error = (b: BoundingBox) => n.bbox ? (Math.abs(n.bbox.left - b.left) + Math.abs(n.bbox.right - b.right)) / Math.max(1, b.right - b.left) + (Math.abs(n.bbox.top - b.top) + Math.abs(n.bbox.bottom - b.bottom)) / Math.max(1, b.bottom - b.top) : Infinity;
      const fit = Math.min(error(g.bbox!), hint ? error(hint.bbox) : Infinity);
      return { n, overlap, inside, fit, d: c ? Math.hypot(c.x - (g.bbox!.left + g.bbox!.right) / 2, c.y - (g.bbox!.top + g.bbox!.bottom) / 2) : Infinity };
    }).filter((m) => m.overlap > 0 || m.inside || m.fit < 0.25).sort((a, b) => b.overlap - a.overlap || a.fit - b.fit || a.d - b.d);
    if (positioned.length) return positioned[0].n;
    modelNodes = modelNodes.filter((n) => !n.bbox && !n.strokeIds?.length);
  }
  return (g.group !== undefined && geoNodes.filter((n) => n.group === g.group).length === 1 ? modelNodes.find((n) => n.group === g.group) : undefined) ??
    modelNodes.find((n) => sameText(n.id, g.id) && (n.group === undefined || n.group === g.group || !geoNodes.some((o) => o.group === n.group)));
}

function nameGeometryNodes(geo: ReturnType<typeof figureFromGeometry>, prior: FigureInfo | undefined, fig: FigureHint, labels: string[]): ReturnType<typeof figureFromGeometry> {
  const rename = new Map<string, string>();
  for (const g of geo.nodes ?? []) {
    if (!geo.unnamed.includes(g.label)) continue;
    // The label group number is the most reliable link (small models echo numbers faithfully); hint id second.
    const m = modelNodeFor(g, geo.nodes ?? [], prior?.nodes ?? [], fig.nodes.find((n) => n.id === g.id));
    if (m && m.label && !geo.unnamed.includes(m.label) && !/^n\d+$/i.test(m.label)) {
      rename.set(g.label, m.label);
    }
  }
  const pending = (geo.nodes ?? []).filter((n) => geo.unnamed.includes(n.label) && !rename.has(n.label));
  const attached = new Set([
    ...(geo.nodes ?? []).filter((n) => !geo.unnamed.includes(n.label)).map((n) => n.label),
    ...(prior?.nodes?.map((n) => n.label) ?? []), ...rename.values(),
    ...[...geo.edges, ...(prior?.edges ?? [])].flatMap((e) => e.label ? [e.label] : []),
    ...(geo.cells?.flat() ?? []), ...(prior?.cells?.flat() ?? []),
    ...(geo.sequence ?? []), ...(prior?.sequence ?? []),
  ].map((s) => s.trim().toLowerCase()));
  const unused = [...new Map(labels.flatMap(stringList).filter((s) => s.trim() && !attached.has(s.toLowerCase()) && !geo.unnamed.includes(s) && !isGroupRef(s)).map((s) => [s.toLowerCase(), s])).values()];
  if (pending.length && unused.length === pending.length) {
    const spatialOrder = ['left→right', 'top→bottom'].includes(fig.orderBasis) ? fig.order : [];
    const order = dedupe([...spatialOrder, ...fig.nodes.map((n) => n.id), ...pending.map((n) => n.id)]);
    pending.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    pending.forEach((n, i) => rename.set(n.label, unused[i]));
  }
  if (fig.kind === 'mindmap') {
    const used = new Set<string>();
    for (const n of geo.nodes ?? []) {
      const base = rename.get(n.label) ?? n.label;
      let name = base, suffix = 2;
      while (used.has(name.toLowerCase())) name = `${base} (${suffix++})`;
      used.add(name.toLowerCase());
      if (name !== n.label) rename.set(n.label, name);
    }
  }
  if (rename.size === 0) return geo;
  const r = (s: string) => rename.get(s) ?? s;
  return {
    ...geo,
    nodes: geo.nodes?.map((n) => ({ ...n, label: r(n.label) })),
    edges: geo.edges.map((e) => ({ ...e, from: r(e.from), to: r(e.to) })),
    ...(geo.sequence ? { sequence: geo.sequence.map(r) } : {}),
    unnamed: geo.unnamed.filter((u) => !rename.has(u)),
  };
}

function sameEdge(a: FigureEdge, b: FigureEdge): boolean {
  return sameText(a.from, b.from) && sameText(a.to, b.to);
}

/**
 * Geometry owns structure; the model supplies words and only fills structural gaps.
 */
export function mergeWithGeometry(prior: FigureInfo | undefined, fig: FigureHint, labels: string[], geoIn: ReturnType<typeof figureFromGeometry>): FigureInfo {
  const kind = fig.kind;
  const geo = nameGeometryNodes(geoIn, prior, fig, labels);
  const geometryNesting = fig.nodes.filter((n) => n.shape !== 'text' && n.shape !== 'lifeline').length >= 2;
  const nodes = (geo.nodes ?? []).map((n) => ({ ...n }));
  const matched = new Set<FigureNode>();
  const aliases = new Map<string, string>();
  for (const g of nodes) {
    const m = modelNodeFor(g, nodes, prior?.nodes ?? [], fig.nodes.find((n) => n.id === g.id));
    if (m) { matched.add(m); aliases.set(m.label.toLowerCase(), g.label); aliases.set(m.id.toLowerCase(), g.label); }
  }
  for (const m of prior?.nodes ?? []) if (fig.kind !== 'mindmap' && !matched.has(m) && (!nodes.some((n) => sameText(n.id, m.id)) || (geometryNesting && m.bbox))) {
    const extra = { ...m };
    while (nodes.some((n) => sameText(n.id, extra.id))) extra.id = `model-${extra.id}`;
    if (geometryNesting || geo.nodes?.some((n) => n.parent !== undefined)) { delete extra.parent; delete extra.parents; }
    if (geometryNesting && extra.bbox) {
      const enclosing = fig.nodes.filter((n) => n.shape !== 'text' && n.shape !== 'lifeline' && fullyContains(n, { bbox: extra.bbox!, shape: extra.shape ?? 'text' }));
      const nearest = enclosing.filter((n) => !enclosing.some((other) => other !== n && fullyContains(n, other)));
      if (nearest.length) {
        extra.parent = nearest[0].id;
        extra.parents = nearest.map((n) => n.id);
      }
    }
    nodes.push(extra);
  }
  const resolve = (s: string) => aliases.get(s.toLowerCase()) ?? resolveNodeRefs(s, nodes);
  const knownNode = (s: string) => nodes.find((n) => sameText(n.label, resolve(s)) || sameText(n.id, s));
  const hasNesting = geo.nodes?.some((n) => n.parent !== undefined);
  if (!hasNesting && !geometryNesting) for (const g of nodes) {
    const m = modelNodeFor(g, geo.nodes ?? [], prior?.nodes ?? [], fig.nodes.find((n) => n.id === g.id));
    const parent = m?.parent && knownNode(m.parent);
    if (!g.parent && parent && parent.id !== g.id) g.parent = parent.id;
    const parents = m?.parents?.map(knownNode).filter((p): p is FigureNode => !!p && p.id !== g.id).map((p) => p.id);
    if (!g.parents?.length && parents?.length) g.parents = dedupe(parents);
  }
  const modelEdges = (prior?.edges ?? []).map((e) => ({ ...e, from: resolve(e.from), to: resolve(e.to) }));
  const edges: FigureEdge[] = geo.edges.map((e, i) => {
    const reverse = { from: e.to, to: e.from };
    const single = geo.edges.filter((g) => sameEdge(g, e) || sameEdge(g, reverse)).length === 1;
    const match = modelEdges.find((m) => sameEdge(e, m)) ?? (single && !geo.edges.some((g) => sameEdge(g, reverse))
      ? modelEdges.find((m) => sameEdge(reverse, m)) : undefined);
    const label = e.label ?? match?.label ?? (fig.messageGroups?.length === prior?.sequence?.length ? prior?.sequence?.[i] : undefined);
    return { ...e, ...(label ? { label } : {}), inferred: true };
  });
  if (fig.kind !== 'mindmap' && modelEdges.length > geo.edges.length) for (const e of modelEdges) {
    const from = knownNode(e.from), to = knownNode(e.to);
    if (!from || !to || from.id === to.id || !geo.nodes?.some((n) => n.id === from.id) || !geo.nodes?.some((n) => n.id === to.id)) continue;
    const candidate = { ...e, from: from.label, to: to.label };
    if (edges.some((g) => sameEdge(g, candidate) || (sameText(g.from, candidate.to) && sameText(g.to, candidate.from)))) continue;
    edges.push({ ...candidate, inferred: false });
  }
  const sequence = (geo.sequence?.length ?? 0) >= 2 && !geo.sequence!.every((s) => geo.unnamed.includes(s))
    ? geo.sequence : prior?.sequence?.flatMap((s) => stringList(s).map(resolve));
  let cells = geo.cells?.length ? geo.cells : prior?.cells;
  if (kind === 'table' && geo.cells?.length && prior?.cells?.length) {
    cells = geo.cells.map((row, r) => row.map((value, c) => value || prior.cells?.[r]?.[c] || ''));
  }
  // Words written on arrows are labels of the figure too.
  const allLabels = dedupe([...labels.flatMap((s) => stringList(s).flatMap((word) => /^n\d+$/i.test(word) ? [resolve(word)] : [word, resolve(word)])), ...(prior?.cells?.flat().filter(Boolean) ?? []), ...(prior?.nodes?.map((n) => n.label) ?? []), ...nodes.filter((n) => !geo.unnamed.includes(n.label)).map((n) => n.label), ...edges.flatMap((e) => e.label ? [e.label] : [])]);
  const figure: FigureInfo = { kind, shapes: dedupe([...fig.shapes, ...(prior?.shapes ?? [])]), labels: allLabels, edges };
  if (nodes?.length) figure.nodes = nodes;
  if (sequence) {
    figure.sequence = sequence;
    const sequenceEdges = sequence === geo.sequence ? geo.sequenceEdges : sequenceEdgeIndices(figure);
    if (sequenceEdges?.some((index) => index !== null)) figure.sequenceEdges = sequenceEdges;
  }
  if (cells) figure.cells = cells;
  return figure;
}

function cleanLabel(s: string): string {
  return s.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, '').replace(/^#+\s*/, '').trim();
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
  const sx = (imageBounds.right - imageBounds.left) / Math.max(1, imageSize.width);
  const sy = (imageBounds.bottom - imageBounds.top) / Math.max(1, imageSize.height);
  const pageBox = (b: BoundingBox): BoundingBox => ({ left: imageBounds.left + b.left * sx, top: imageBounds.top + b.top * sy, right: imageBounds.left + b.right * sx, bottom: imageBounds.top + b.bottom * sy });
  const figure = raw.figure?.nodes ? { ...raw.figure, nodes: raw.figure.nodes.map((n) => {
    const located = n.groupIndices?.flatMap((i) => groups[i]?.strokeIds ?? []) ?? [];
    return { ...n, ...(n.bbox ? { bbox: pageBox(n.bbox) } : {}), ...(located.length ? { strokeIds: dedupe([...(n.strokeIds ?? []), ...located]) } : {}) };
  }) } : raw.figure;
  const groupList = raw.groupIndices.map((i) => groups[i]).filter((g): g is StrokeGroupMeta => !!g);
  let strokeIds = groupList.flatMap((g) => g.strokeIds);
  let bbox: BoundingBox;
  if (groupList.length > 0) {
    bbox = groupList.map((g) => g.bbox).reduce(unionBounds);
    const positioned = pageBox(raw.bbox);
    const table = groupList.find((g) => g.figure?.cellBounds)?.figure;
    const plot = groupList.find((g) => g.figure?.plotLabelBounds)?.figure;
    const cellPosition = table?.cellBounds?.flat().some((cell) => fullyContains({ bbox: expandBounds(cell, 6), shape: 'rectangle' }, { bbox: positioned, shape: 'text' }));
    if (raw.kind !== 'diagram' && positioned.right > positioned.left && positioned.bottom > positioned.top && (cellPosition || plot)) {
      bbox = positioned;
      const ids = new Set(strokeIds);
      strokeIds = regionStrokes.filter((s) => ids.has(s.id) && boundsIntersect(positioned, strokeBounds(s))).map((s) => s.id);
    }
  } else {
    bbox = pageBox(raw.bbox);
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
    ...(figure ? { figure } : {}),
  };
}

function preserveEditedCells(edited: string[][], fresh: string[][]): string[][] {
  const uniqueIndex = (values: string[], value: string) => {
    if (!value.trim()) return undefined;
    const indices = values.flatMap((word, i) => sameText(word, value) ? [i] : []);
    return indices.length === 1 ? indices[0] : undefined;
  };
  const headers = fresh[0] ?? [];
  const columns = headers.map((word) => uniqueIndex(headers, word) === undefined ? undefined : uniqueIndex(edited[0] ?? [], word));
  const keyColumn = columns.indexOf(0);
  const oldKeys = edited.slice(1).map((row) => row[0] ?? '');
  const newKeys = fresh.slice(1).map((row) => row[keyColumn] ?? '');
  return fresh.map((row, r) => {
    const key = row[keyColumn] ?? '';
    const match = keyColumn >= 0 && uniqueIndex(newKeys, key) !== undefined ? uniqueIndex(oldKeys, key) : undefined;
    const oldRow = r === 0 ? 0 : match === undefined ? undefined : match + 1;
    return row.map((cell, c) => {
      const oldColumn = columns[c];
      return oldRow === undefined || oldColumn === undefined ? cell : edited[oldRow]?.[oldColumn] ?? cell;
    });
  });
}

function preserveEditedFigure(edited: FigureInfo, fresh: FigureInfo): FigureInfo {
  const oldNodes = edited.nodes ?? [], newNodes = fresh.nodes ?? [];
  const matches = new Map<string, FigureNode>();
  const used = new Set<FigureNode>();
  for (const basis of ['stroke', 'group', 'label', 'id'] as const) for (const node of newNodes) {
    if (matches.has(node.id)) continue;
    const overlap = (old: FigureNode) => {
      const shared = (node.strokeIds ?? []).filter((id) => old.strokeIds?.includes(id)).length;
      return shared / Math.max(1, (node.strokeIds?.length ?? 0) + (old.strokeIds?.length ?? 0) - shared);
    };
    const best = Math.max(0, ...oldNodes.filter((old) => !used.has(old)).map(overlap));
    let candidates = oldNodes.filter((old) => !used.has(old) && (basis === 'stroke' ? best > 0 && overlap(old) === best
      : basis === 'id' ? !(old.strokeIds?.length && node.strokeIds?.length) && sameText(old.id, node.id)
      : basis === 'label' ? sameText(old.label, node.label)
      : node.group !== undefined && old.group === node.group && newNodes.filter((n) => n.group === node.group).length === 1));
    if (basis === 'stroke' && candidates.length > 1 && best === 1) {
      const unchanged = candidates.filter((old) => sameText(old.id, node.id));
      if (unchanged.length === 1) candidates = unchanged;
    }
    if (candidates.length === 1) { matches.set(node.id, candidates[0]); used.add(candidates[0]); }
  }
  const nodeFor = (nodes: FigureNode[], ref: string) => nodes.find((n) => sameText(n.id, ref)) ?? nodes.find((n) => sameText(n.label, ref));
  const newNodeForOld = (ref: string) => {
    const old = nodeFor(oldNodes, ref);
    return old && newNodes.find((n) => matches.get(n.id) === old);
  };
  const renamed = (ref: string) => {
    const node = nodeFor(newNodes, ref);
    return node ? matches.get(node.id)?.label ?? node.label : ref;
  };
  const edgeMatches = new Map<number, number>();
  const usedEdges = new Set<number>();
  const sameEndpoint = (oldRef: string, ref: string) => {
    const old = nodeFor(oldNodes, oldRef), node = nodeFor(newNodes, ref);
    return old && node ? matches.get(node.id) === old : !old && !node && sameText(oldRef, ref);
  };
  for (const basis of ['stroke', 'endpoint'] as const) fresh.edges.forEach((edge, i) => {
    if (edgeMatches.has(i)) return;
    const overlap = (old: FigureEdge) => {
      const a = new Set(old.strokeIds), b = new Set(edge.strokeIds);
      const shared = [...a].filter((id) => b.has(id)).length;
      return shared / Math.max(1, a.size + b.size - shared);
    };
    let candidates = edited.edges.flatMap((old, j) => {
      if (usedEdges.has(j)) return [];
      const forward = sameEndpoint(old.from, edge.from) && sameEndpoint(old.to, edge.to);
      const compatible = forward || (edited.kind !== 'sequence' && sameEndpoint(old.from, edge.to) && sameEndpoint(old.to, edge.from));
      if (!compatible) return [];
      return (basis === 'stroke' ? overlap(old) > 0 : !old.strokeIds?.length || !edge.strokeIds?.length) ? [j] : [];
    });
    if (basis === 'stroke') {
      const best = Math.max(0, ...candidates.map((j) => overlap(edited.edges[j])));
      candidates = candidates.filter((j) => overlap(edited.edges[j]) === best);
      if (candidates.length !== 1) return;
    }
    if (candidates.length) { edgeMatches.set(i, candidates[0]); usedEdges.add(candidates[0]); }
  });
  const edges = fresh.edges.map((edge, i) => {
    const index = edgeMatches.get(i);
    const match = index === undefined ? undefined : edited.edges[index];
    return { ...edge, from: renamed(edge.from), to: renamed(edge.to), ...(match?.label !== undefined ? { label: match.label } : {}) };
  });
  const sequenceWords = new Map<string, string>();
  for (const word of edited.sequence ?? []) {
    const old = nodeFor(oldNodes, word);
    if (old) sequenceWords.set(old.id, sameText(word, old.id) ? old.label : word);
  }
  const positionalSteps = edited.kind !== 'sequence' && edited.sequence?.length === oldNodes.length;
  if (positionalSteps) oldNodes.forEach((node, i) => {
    if (!sequenceWords.has(node.id) && !nodeFor(oldNodes, edited.sequence![i])) sequenceWords.set(node.id, edited.sequence![i]);
  });
  const oldStepEdges = sequenceEdgeIndices(edited), freshStepEdges = sequenceEdgeIndices(fresh);
  const oldOccurrences = new Map<string, number>();
  const wordKey = (word: string) => word.trim().toLowerCase();
  const textSources = edited.sequenceBaseline
    ? [edited.sequenceBaseline.filter((step) => step.edge === null || !edited.edges[step.edge]?.strokeIds?.length).map((step) => step.text)]
    : [edited.labels, edited.sequence ?? [], edited.edges.flatMap((e) => e.label ? [e.label] : [])];
  for (const source of textSources) {
    const counts = new Map<string, number>();
    for (const word of source) counts.set(wordKey(word), (counts.get(wordKey(word)) ?? 0) + 1);
    for (const [word, count] of counts) oldOccurrences.set(word, Math.max(count, oldOccurrences.get(word) ?? 0));
  }
  const consume = (word: string) => {
    const count = oldOccurrences.get(wordKey(word)) ?? 0;
    if (count) oldOccurrences.set(wordKey(word), count - 1);
    return count > 0;
  };
  const sequence: string[] | undefined = edited.sequence ? [] : fresh.sequence?.map(renamed);
  const sequenceEdges: (number | null)[] = [];
  const newMessages: string[] = [];
  const unanchoredSlots = new Map<string, number[]>();
  const append = (word: string, edge: number | null) => { sequence!.push(word); sequenceEdges.push(edge); };
  const textStep = (word: string, edge: number | null) => {
    if (consume(word)) {
      const slot = unanchoredSlots.get(wordKey(word))?.shift();
      if (slot !== undefined) sequenceEdges[slot] = edge;
    } else { append(word, edge); newMessages.push(word); }
  };
  if (edited.sequence) {
    edited.edges.forEach((edge, i) => {
      const matched = [...edgeMatches.values()].includes(i);
      if (edited.sequenceBaseline ? edge.strokeIds?.length || !matched : !edge.strokeIds?.length && !matched) return;
      const words = [edge.label, ...edited.sequence!.filter((_, j) => oldStepEdges[j] === i),
        ...(edited.sequenceBaseline ?? []).filter((step) => step.edge === i).map((step) => step.text)];
      for (const key of new Set(words.filter((w): w is string => w !== undefined).map(wordKey))) consume(key);
    });
    edited.sequence.forEach((word, i) => {
      const oldEdge = oldStepEdges[i];
      const anchored = oldEdge !== null;
      const old = anchored ? undefined : nodeFor(oldNodes, word) ?? (positionalSteps ? oldNodes[i] : undefined);
      const freshEdge = oldEdge === null ? undefined : [...edgeMatches].find(([, index]) => index === oldEdge)?.[0];
      if (old) {
        if (newNodeForOld(old.id)) append(sequenceWords.get(old.id) ?? old.label, freshEdge ?? null);
      } else if (!anchored || freshEdge !== undefined) {
        if (!anchored) unanchoredSlots.set(wordKey(word), [...(unanchoredSlots.get(wordKey(word)) ?? []), sequence!.length]);
        append(word, freshEdge ?? null);
      }
    });
    (fresh.sequence ?? []).forEach((word, i) => {
      const edge = freshStepEdges[i];
      const node = nodeFor(newNodes, word);
      if (edge !== null && (edgeMatches.has(edge) || fresh.edges[edge].strokeIds?.length)) {
        const oldEdge = edgeMatches.get(edge);
        if (oldEdge === undefined) textStep(word, edge);
      } else if (node) {
        if (!matches.has(node.id)) append(renamed(word), edge);
      } else textStep(word, edge);
    });
  }
  return {
    ...fresh, labels: [...edited.labels, ...dedupe(newMessages)], edges,
    ...(edited.cells ? { cells: fresh.cells ? preserveEditedCells(edited.cells, fresh.cells) : edited.cells.map((row) => [...row]) } : {}),
    ...(fresh.nodes ? { nodes: fresh.nodes.map((n) => {
      const old = matches.get(n.id);
      return { ...n, label: old?.label ?? n.label, ...(n.strokeIds === undefined && old?.strokeIds ? { strokeIds: [...old.strokeIds] } : {}) };
    }) } : {}),
    ...(sequence ? { sequence } : {}),
    ...(edited.sequence && (edited.sequenceBaseline || newMessages.length || edited.sequenceEdges || fresh.sequenceEdges) ? {
      sequenceEdges, sequenceBaseline: (fresh.sequence ?? []).map((text, i) => ({ text, edge: freshStepEdges[i] })),
    } : {}),
  };
}

function preserveEditedBlock(edited: DigitalBlock, fresh: DigitalBlock): DigitalBlock {
  return {
    ...fresh, id: edited.id, text: edited.text, userEdited: true,
    ...(edited.figure ? { figure: fresh.figure ? preserveEditedFigure(edited.figure, fresh.figure) : edited.figure } : {}),
  };
}

/**
 * Replace the region's old blocks with the new ones. Keeps ids (and user edits)
 * for blocks whose text is unchanged, so the digital view stays stable.
 */
export function mergeBlocks(existing: DigitalBlock[], replacedIds: string[], incoming: DigitalBlock[]): DigitalBlock[] {
  const replaced = existing.filter((b) => replacedIds.includes(b.id));
  const kept = existing.filter((b) => !replacedIds.includes(b.id));
  // Each replaced block hands its id to at most one incoming block: two byte-identical incoming
  // blocks must not end up sharing an id (duplicate React keys, both selected).
  const take = (pred: (ob: DigitalBlock) => boolean) => {
    const i = replaced.findIndex(pred);
    return i < 0 ? undefined : replaced.splice(i, 1)[0];
  };
  const matched = incoming.map((nb) => {
    const same = take((ob) => ob.text.trim() === nb.text.trim() && ob.kind === nb.kind);
    if (same) return same.userEdited ? preserveEditedBlock(same, nb) : { ...nb, id: same.id, userEdited: same.userEdited };
    const edited = take((ob) => !!ob.userEdited && overlapRatio(ob.bbox, nb.bbox) > 0.6);
    if (edited) return preserveEditedBlock(edited, nb);
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
  const protectedBlocks = existing.filter((b) => b.userEdited && b.strokeIds.length > 0 && !b.strokeIds.some((id) => changedStrokeIds.has(id)) &&
    !(b.kind === 'diagram' && incoming.some((next) => next.kind === 'diagram' && next.strokeIds.some((id) => b.strokeIds.includes(id)) && next.strokeIds.some((id) => changedStrokeIds.has(id)))));
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
