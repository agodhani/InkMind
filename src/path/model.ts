import mlData from './maps/ml.json';
import { termKey } from '../kb/normalize';

export interface SubjectConcept {
  id: string; label: string; aliases: string[]; description: string; prerequisites: string[]; area?: string;
}
export interface SubjectMap {
  id: string; subject: string; version: number;
  provenance: { status: 'verified' | 'unverified'; source: string; model?: string };
  areas?: { id: string; label: string }[];
  concepts: SubjectConcept[];
}
export const mlMap = mlData as SubjectMap;
export const forms = (c: SubjectConcept) => [c.label, ...c.aliases].map(termKey);
export function resolveConcept(map: SubjectMap, input: string): SubjectConcept {
  const c = map.concepts.find(c => c.id === input || forms(c).includes(termKey(input)));
  if (!c) throw new Error(`Unknown concept: ${input}`);
  return c;
}
export function validateMap(map: SubjectMap): string[] {
  const errors: string[] = [], ids = new Set<string>(), terms = new Map<string, string>();
  const byId = new Map(map.concepts.map(c => [c.id, c]));
  const ranks = new Map(map.areas?.map((a, i) => [a.id, i]));
  for (const c of map.concepts) {
    if (ids.has(c.id)) errors.push(`Duplicate id: ${c.id}`);
    ids.add(c.id);
    if (!c.label.trim()) errors.push(`Empty label: ${c.id}`);
    if (!c.description.trim()) errors.push(`Empty description: ${c.id}`);
    for (const key of new Set(forms(c))) {
      if (terms.has(key) && terms.get(key) !== c.id) errors.push(`Shared term ${key}: ${terms.get(key)}, ${c.id}`);
      terms.set(key, c.id);
    }
    if (map.areas && !ranks.has(c.area ?? '')) errors.push(`Unknown area: ${c.id}`);
    for (const p of c.prerequisites) {
      if (!byId.has(p)) errors.push(`Unknown prerequisite ${p}: ${c.id}`);
      if (p === c.id) errors.push(`Self prerequisite: ${c.id}`);
      if (map.areas && ranks.get(byId.get(p)?.area ?? '')! > ranks.get(c.area ?? '')!) errors.push(`Area rank: ${p} before ${c.id}`);
    }
  }
  const done = new Set<string>(), visiting: string[] = [];
  function visit(id: string) {
    if (visiting.includes(id)) { errors.push(`Cycle: ${[...visiting.slice(visiting.indexOf(id)), id].join(' -> ')}`); return; }
    if (done.has(id)) return;
    visiting.push(id);
    byId.get(id)?.prerequisites.forEach(visit);
    visiting.pop(); done.add(id);
  }
  map.concepts.forEach(c => visit(c.id));
  return errors;
}
