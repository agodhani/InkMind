import { termKey } from '../kb/normalize';
import { forms, type SubjectMap } from './model';
import type { ConceptMatch, Evidence } from './match';
import type { PathPlan, PathStep } from './plan';

export type StepStatus = 'notes' | 'declared' | 'assumed' | 'partial' | 'next' | 'later' | 'skipped';
export const statusLabels: Record<StepStatus, string> = {
  notes: 'Known from notes', declared: 'Declared', assumed: 'Assumed covered', partial: 'Partly known',
  next: 'Next', later: 'Later', skipped: 'Skipped',
};

export const readySteps = (plan: PathPlan, skipped: string[]) => plan.next.filter(id => !skipped.includes(id));

export function stepStatus(step: PathStep, match: ConceptMatch | undefined, next: boolean, skipped: boolean): StepStatus {
  if (step.status === 'done') return match?.basis === 'notes' ? 'notes' : match?.declared ? 'declared' : 'assumed';
  return skipped ? 'skipped' : step.status === 'partial' ? 'partial' : next ? 'next' : 'later';
}

export function searchConcepts(map: SubjectMap, query: string) {
  const key = termKey(query);
  if (!key) return map.concepts;
  const score = (c: SubjectMap['concepts'][number]) => {
    const keys = forms(c);
    return keys.includes(key) ? 0 : keys.some(k => k.startsWith(key)) ? 1 : keys.some(k => k.includes(key)) ? 2 : 3;
  };
  return map.concepts.map(c => ({ c, rank: score(c) })).filter(x => x.rank < 3).sort((a, b) => a.rank - b.rank).map(x => x.c);
}

export interface NoteSource { pageId: string; blockId: string; surface: string }
export function noteSources(evidence: Evidence[]): NoteSource[] {
  const references = evidence.flatMap(e => e.kind === 'note' ? e.provenance : e.kind === 'mention' ? [{ pageId: e.pageId, blockId: e.blockId, surface: e.surface }] : []);
  return [...new Map(references.map(s => [JSON.stringify([s.pageId, s.blockId]), s])).values()];
}

export function pathReason(step: PathStep): string {
  // Page titles and block links are shown separately; the planner's raw page ids aren't user-facing.
  return step.reason.replace(/ \(page [^)]*\)/g, '');
}

export function notesProgress(current: string[], checkpoint: string[] | null) {
  if (!checkpoint) return { done: [], lost: [] };
  return { done: current.filter(id => !checkpoint.includes(id)), lost: checkpoint.filter(id => !current.includes(id)) };
}
