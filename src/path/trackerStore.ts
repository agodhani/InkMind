import type { SubjectMap } from './model';

export interface TrackerState {
  goals: string[];
  declared: string[];
  skipped: string[];
  /** Notes-backed steps at the last acknowledgement, for the currently selected goals. */
  checkpoint: string[] | null;
}

export interface TrackerStore {
  load(): unknown;
  save(state: TrackerState): void;
}

export const emptyTracker = (): TrackerState => ({ goals: [], declared: [], skipped: [], checkpoint: null });

export function restoreTracker(map: SubjectMap, value: unknown): TrackerState {
  if (!value || typeof value !== 'object') return emptyTracker();
  const state = value as Partial<TrackerState>;
  const ids = (list: unknown) => Array.isArray(list) ? map.concepts.filter(c => list.includes(c.id)).map(c => c.id) : [];
  const goals = ids(state.goals);
  return { goals, declared: ids(state.declared), skipped: ids(state.skipped),
    checkpoint: Array.isArray(state.goals) && state.goals.length === goals.length && Array.isArray(state.checkpoint) ? ids(state.checkpoint) : null };
}

export function localTrackerStore(mapId: string): TrackerStore {
  const key = `inkmind.path.${mapId}.v1`;
  return {
    load: () => JSON.parse(localStorage.getItem(key) ?? 'null') as unknown,
    save: state => localStorage.setItem(key, JSON.stringify(state)),
  };
}
