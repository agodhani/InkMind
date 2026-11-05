import { useCallback, useEffect, useRef, useState } from 'react';
import type { DigitalBlock, InkStroke, Page } from '../model/page';
import type { HandwritingProfile, Transcriber } from './types';
import { buildStrokeGroups, computeDirtyRegions, mergeBlocks, protectEditedBlocks, rawToDigitalBlock, strokesBounds, type DirtyRegion } from './regions';
import { MODEL_RENDER, renderStrokesToPng } from './render';

/**
 * region: re-transcribe only the lines you changed (cheap, but small crops starve the model of context).
 * page: re-transcribe the whole page on every idle (what vision models do best; one request, more tokens).
 */
export type TranscriptionScope = 'region' | 'page';

export const IDLE_DEBOUNCE_MS = 1200;

export interface TranscriptionStatus {
  state: 'idle' | 'waiting' | 'running' | 'error';
  pendingRegions: number;
  lastError?: string;
  lastModel?: string;
  lastDurationMs?: number;
}

interface Params {
  page: Page | null;
  transcriber: Transcriber;
  profile: HandwritingProfile;
  enabled: boolean;
  scope?: TranscriptionScope;
  onBlocks: (pageId: string, update: (blocks: DigitalBlock[]) => DigitalBlock[]) => void;
}

/**
 * Tracks which strokes changed since the last run; after the pen has been idle
 * for IDLE_DEBOUNCE_MS, re-transcribes only the dirty regions and merges the
 * resulting blocks into the page.
 */
export function useTranscription({ page, transcriber, profile, enabled, scope = 'page', onBlocks }: Params) {
  const dirty = useRef<Set<string>>(new Set());
  const deleted = useRef<Set<string>>(new Set());
  const timer = useRef<number | null>(null);
  const running = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [status, setStatus] = useState<TranscriptionStatus>({ state: 'idle', pendingRegions: 0 });

  const run = useCallback(async () => {
    const current = pageRef.current;
    if (!current || running.current || !enabled) return;
    if (dirty.current.size === 0 && deleted.current.size === 0) return;

    const dirtyIds = new Set(dirty.current);
    const deletedIds = new Set(deleted.current);
    dirty.current.clear();
    deleted.current.clear();

    const regions: DirtyRegion[] = scope === 'page' ? wholePageRegion(current) : computeDirtyRegions(current, dirtyIds, deletedIds);
    if (regions.length === 0) {
      setStatus((s) => ({ ...s, state: 'idle', pendingRegions: 0 }));
      return;
    }
    running.current = true;
    abort.current = new AbortController();
    setStatus((s) => ({ ...s, state: 'running', pendingRegions: regions.length }));

    try {
      for (const region of regions) {
        if (region.strokes.length === 0) {
          onBlocks(current.id, (blocks) => mergeBlocks(blocks, region.replacedBlockIds, []));
          continue;
        }
        const rendered = renderStrokesToPng(region.strokes, region.bounds, MODEL_RENDER);
        if (!rendered) continue;
        const groups = buildStrokeGroups(region.strokes);
        const contextText = current.blocks
          .filter((b) => !region.replacedBlockIds.includes(b.id))
          .map((b) => b.text)
          .join('\n');
        const result = await transcriber.transcribe(
          {
            imageDataUrl: rendered.dataUrl,
            imageBounds: rendered.bounds,
            imageSize: rendered.size,
            strokes: region.strokes,
            groups,
            contextText,
            pageTitle: current.title,
            profile: profileRef.current,
          },
          abort.current.signal,
        );
        let incoming = result.blocks.map((raw) => rawToDigitalBlock(raw, groups, rendered.bounds, rendered.size, region.strokes));
        let replacedBlockIds = region.replacedBlockIds;
        if (scope === 'page') {
          const protectedResult = protectEditedBlocks(current.blocks, incoming, new Set([...dirtyIds, ...deletedIds]));
          incoming = protectedResult.incoming;
          replacedBlockIds = protectedResult.replacedIds;
        }
        // Any region stroke the model didn't claim is still "covered" so it is not re-sent forever.
        const claimed = new Set(incoming.flatMap((b) => b.strokeIds));
        const unclaimed = region.strokes.filter((s) => !claimed.has(s.id)).map((s) => s.id);
        if (unclaimed.length && incoming.length) {
          incoming[incoming.length - 1] = { ...incoming[incoming.length - 1], strokeIds: [...incoming[incoming.length - 1].strokeIds, ...unclaimed] };
        }
        onBlocks(current.id, (blocks) => mergeBlocks(blocks, replacedBlockIds, incoming));
        setStatus((s) => ({ ...s, pendingRegions: Math.max(0, s.pendingRegions - 1), lastModel: result.model, lastDurationMs: result.durationMs }));
      }
      setStatus((s) => ({ ...s, state: 'idle', pendingRegions: 0, lastError: undefined }));
    } catch (err) {
      // Put the strokes back so the next idle retries them.
      dirtyIds.forEach((id) => dirty.current.add(id));
      deletedIds.forEach((id) => deleted.current.add(id));
      setStatus((s) => ({ ...s, state: 'error', pendingRegions: 0, lastError: err instanceof Error ? err.message : String(err) }));
    } finally {
      running.current = false;
      abort.current = null;
      if (dirty.current.size || deleted.current.size) schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scope, transcriber, onBlocks]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setStatus((s) => (s.state === 'running' ? s : { ...s, state: 'waiting' }));
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void run();
    }, IDLE_DEBOUNCE_MS);
  }, [run]);

  const markStrokesDirty = useCallback(
    (strokes: InkStroke[]) => {
      strokes.forEach((s) => dirty.current.add(s.id));
      schedule();
    },
    [schedule],
  );

  const markStrokesDeleted = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => {
        dirty.current.delete(id);
        deleted.current.add(id);
      });
      schedule();
    },
    [schedule],
  );

  const retranscribeAll = useCallback(() => {
    const current = pageRef.current;
    if (!current) return;
    onBlocks(current.id, () => []);
    current.strokes.forEach((s) => dirty.current.add(s.id));
    schedule();
  }, [onBlocks, schedule]);

  // Reset tracking when switching pages.
  useEffect(() => {
    dirty.current.clear();
    deleted.current.clear();
    abort.current?.abort();
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setStatus({ state: 'idle', pendingRegions: 0 });
  }, [page?.id]);

  return { status, markStrokesDirty, markStrokesDeleted, retranscribeAll, flushNow: run };
}

function wholePageRegion(page: Page): DirtyRegion[] {
  const bounds = strokesBounds(page.strokes);
  const replacedBlockIds = page.blocks.map((b) => b.id);
  if (!bounds) return replacedBlockIds.length ? [{ bounds: { left: 0, top: 0, right: 0, bottom: 0 }, strokes: [], replacedBlockIds }] : [];
  return [{ bounds, strokes: page.strokes, replacedBlockIds }];
}
