import { clamp } from './format';

export const SPLIT_MIN = 0.2;
export const SPLIT_MAX = 0.8;
export const SPLIT_KEY = 'inkmind.split';

/** Pure: pointer position → pane ratio, clamped so neither pane collapses. */
export function ratioFromPointer(pos: number, start: number, length: number): number {
  if (length <= 0) return 0.5;
  return clamp((pos - start) / length, SPLIT_MIN, SPLIT_MAX);
}

export function readSplitRatio(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): number {
  try {
    const n = Number(storage?.getItem(SPLIT_KEY));
    return Number.isFinite(n) && n > 0 ? clamp(n, SPLIT_MIN, SPLIT_MAX) : 0.5;
  } catch {
    return 0.5;
  }
}
