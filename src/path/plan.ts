import { resolveConcept, validateMap } from './model';
import type { SubjectMap } from './model';
import type { ConceptMatch, Evidence } from './match';

export interface PathStep {
  conceptId: string; label: string; description: string; status: 'todo' | 'partial' | 'done'; goal: boolean;
  stage: string; neededBy: string[]; missing: string[]; evidence: Evidence[]; reason: string;
}
export interface PathPlan {
  mapId: string; provenance: SubjectMap['provenance']; goals: string[]; goalsKnown: string[];
  steps: PathStep[]; stages: { id: string; title: string; concepts: string[] }[];
  skipped: { conceptId: string; status: 'known' | 'assumed'; reason: string }[]; next: string[];
}
export function planPath(map: SubjectMap, goals: string[], match: ConceptMatch[], previous?: PathPlan): PathPlan {
  const errors = validateMap(map);
  if (errors.length) throw new Error(errors.join('; '));
  const byId = new Map(map.concepts.map(c => [c.id, c])), matches = new Map(match.map(m => [m.conceptId, m]));
  const resolvedGoals = new Set(goals.map(g => resolveConcept(map, g).id));
  const goalIds = map.concepts.filter(c => resolvedGoals.has(c.id)).map(c => c.id);
  const known = new Set(match.filter(m => m.state === 'known').map(m => m.conceptId));
  const assumed = new Map<string, string>();
  function assume(id: string, source: string) {
    for (const p of byId.get(id)!.prerequisites) if (!assumed.has(p)) { assumed.set(p, source); assume(p, source); }
  }
  map.concepts.filter(c => known.has(c.id)).forEach(c => assume(c.id, c.id));
  const skipped = map.concepts.filter(c => known.has(c.id) || assumed.has(c.id)).map(c => {
    const m = matches.get(c.id);
    const note = m?.evidence.find(e => e.kind === 'note');
    return { conceptId: c.id, status: known.has(c.id) ? 'known' as const : 'assumed' as const,
      reason: known.has(c.id) ? note ? `your notes cover it${note.provenance.length ? ` (page ${note.provenance[0].pageId})` : ''}` : 'you said you already know it'
        : `assumed: you ${matches.get(assumed.get(c.id)!)?.basis === 'declared' ? 'said you know' : 'wrote about'} ${byId.get(assumed.get(c.id)!)!.label}, which builds on it` };
  });
  const skip = new Map(skipped.map(s => [s.conceptId, s]));
  const wanted = new Set<string>();
  function visit(id: string) { if (skip.has(id) || wanted.has(id)) return; wanted.add(id); byId.get(id)!.prerequisites.forEach(visit); }
  goalIds.forEach(visit);
  const order: string[] = [], remaining = new Set(map.concepts.map(c => c.id));
  const rank = (id: string) => map.areas?.findIndex(a => a.id === byId.get(id)!.area) ?? 0;
  while (remaining.size) {
    const available = map.concepts.filter(c => remaining.has(c.id) && c.prerequisites.every(p => !remaining.has(p))).sort((a, b) => rank(a.id) - rank(b.id));
    const id = available[0].id; order.push(id); remaining.delete(id);
  }
  const previousIds = previous?.steps.map(s => s.conceptId) ?? [];
  const ids = previous ? [...previousIds, ...order.filter(id => wanted.has(id) && !previousIds.includes(id))] : order.filter(id => wanted.has(id));
  const steps = ids.map(id => {
    const c = byId.get(id)!, m = matches.get(id), done = skip.has(id) || previous?.steps.find(s => s.conceptId === id)?.status === 'done';
    const neededBy = order.filter(other => (ids.includes(other) || goalIds.includes(other)) && byId.get(other)!.prerequisites.includes(id));
    const context = goalIds.includes(id) ? 'Your goal' : `${neededBy.map(n => byId.get(n)!.label).join(', ') || 'Your learning path'} needs ${c.label}`;
    const mention = m?.evidence.find(e => e.kind === 'mention');
    const detail = done ? skip.get(id)?.reason ?? 'your notes previously covered it' : m?.state === 'partial'
      ? mention?.kind === 'mention' ? `your notes mention it (page ${mention.pageId}) but don't cover it yet` : 'a proposal suggests it; your notes do not cover it yet'
      : 'nothing in your notes on it yet';
    return { conceptId: id, label: c.label, description: c.description, status: done ? 'done' : m?.state === 'partial' ? 'partial' : 'todo', goal: goalIds.includes(id),
      stage: c.area ?? `depth-${Math.min(2, Math.floor(order.indexOf(id) * 3 / order.length))}`,
      neededBy, missing: c.prerequisites.filter(p => ids.includes(p) && !skip.has(p) && previous?.steps.find(s => s.conceptId === p)?.status !== 'done'), evidence: m?.evidence ?? [], reason: `${context}; ${detail}` } as PathStep;
  });
  const stages: PathPlan['stages'] = [];
  for (const s of steps) {
    if (stages.at(-1)?.id !== s.stage) stages.push({ id: s.stage, title: map.areas?.find(a => a.id === s.stage)?.label ?? `Stage ${stages.length + 1}`, concepts: [] });
    stages.at(-1)!.concepts.push(s.conceptId);
  }
  return { mapId: map.id, provenance: { ...map.provenance }, goals: goalIds, goalsKnown: goalIds.filter(id => skip.has(id)), steps, stages, skipped,
    next: steps.filter(s => s.status !== 'done' && s.missing.every(p => steps.find(s => s.conceptId === p)?.status === 'done')).map(s => s.conceptId) };
}
