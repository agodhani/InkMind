import { useEffect, useMemo, useState } from 'react';
import { matchNotes } from './match';
import type { SubjectMap } from './model';
import { planPath } from './plan';
import { notesProgress, readySteps } from './tracker';
import { emptyTracker, restoreTracker, type TrackerState, type TrackerStore } from './trackerStore';

export function useLearningPath(map: SubjectMap, { graph, extractions }: Parameters<typeof matchNotes>[1], ready: boolean, store: TrackerStore) {
  const [initial] = useState(() => {
    try { return { state: restoreTracker(map, store.load()), error: false }; }
    catch { return { state: emptyTracker(), error: true }; }
  });
  const [state, setState] = useState(initial.state);
  const [saveError, setSaveError] = useState(false);
  const matches = useMemo(() => matchNotes(map, { graph, extractions }, state.declared), [map, graph, extractions, state.declared]);
  const byId = useMemo(() => new Map(matches.map(m => [m.conceptId, m])), [matches]);
  const fullPath = useMemo(() => planPath(map, state.goals, []), [map, state.goals]);
  // Use the unpruned plan as the anchor so even prerequisites you already have
  // are visible and a step holds its position across replans and reloads.
  const plan = useMemo(() => planPath(map, state.goals, matches, fullPath), [map, state.goals, matches, fullPath]);
  const noteDone = useMemo(() => plan.steps.filter(s => byId.get(s.conceptId)?.basis === 'notes').map(s => s.conceptId), [plan, byId]);
  useEffect(() => {
    if (!ready || !state.goals.length || state.checkpoint !== null) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setState(s => s.checkpoint === null && s.goals === state.goals ? { ...s, checkpoint: noteDone } : s);
    });
    return () => { active = false; };
  }, [ready, state.goals, state.checkpoint, noteDone]);
  useEffect(() => {
    if (state === initial.state) return;
    let failed = false;
    try { store.save(state); } catch { failed = true; }
    let active = true;
    queueMicrotask(() => { if (active) setSaveError(failed); });
    return () => { active = false; };
  }, [state, initial.state, store]);

  const toggle = (key: 'goals' | 'declared' | 'skipped', id: string) => setState(s => ({
    ...s, [key]: s[key].includes(id) ? s[key].filter(x => x !== id) : [...s[key], id],
    ...(key === 'goals' ? { checkpoint: null } : {}),
  }));
  const setGoals = (ids: TrackerState['goals']) => setState(s =>
    ids.length === s.goals.length && ids.every(id => s.goals.includes(id)) ? s : { ...s, goals: ids, checkpoint: null });
  return {
    state, plan, matches: byId, ready, next: readySteps(plan, state.skipped),
    changes: notesProgress(noteDone, state.checkpoint),
    storageError: saveError ? 'Could not save learning path progress in this browser.' : initial.error && state === initial.state ? 'Could not read saved learning path progress.' : null,
    toggle, setGoals, acknowledge: () => setState(s => ({ ...s, checkpoint: noteDone })),
  };
}

export type LearningTracker = ReturnType<typeof useLearningPath>;
