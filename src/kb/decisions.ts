import type { Concept, KbGraph } from './model';
import { termKey } from './normalize';

export interface KbDecisions {
  renames: { key: string; label: string }[];
  merges: { from: string; into: string }[];
  deletes: string[];
  rejected: { pageId: string; blockId: string; key: string }[];
  proposals?: { id: string; status: 'accepted' | 'rejected' }[];
}
export const emptyDecisions = (): KbDecisions => ({ renames: [], merges: [], deletes: [], rejected: [] });
export const conceptMatches = (c: Concept, key: string): boolean => [c.label, ...c.aliases].some(s => termKey(s) === termKey(key));
export function union<T>(items: T[]): T[] {
  return [...new Map(items.map(item => [JSON.stringify(item), item])).values()];
}
export function applyDecisions(graph: KbGraph, decisions: KbDecisions): KbGraph {
  const result = structuredClone(graph);
  const find = (key: string) => result.concepts.find(c => conceptMatches(c, key));
  for (const { key, label } of decisions.renames) {
    const c = find(key);
    if (c) { c.aliases = union([...c.aliases, c.label]).filter(a => a !== label); c.label = label; }
  }
  // Retry deferred merges so chains also work when recorded target-first.
  let pending = [...decisions.merges];
  for (let pass = 0; pass < decisions.merges.length; pass++) {
    const deferred: typeof pending = [];
    for (const m of pending) {
      const from = find(m.from), into = find(m.into);
      if (!from || !into) { deferred.push(m); continue; }
      if (from === into) continue;
      into.aliases = union([...into.aliases, from.label, ...from.aliases]).filter(a => a !== into.label);
      into.provenance = union([...into.provenance, ...from.provenance]);
      result.concepts = result.concepts.filter(c => c !== from);
      result.edges.forEach(e => { if (e.from === from.id) e.from = into.id; if (e.to === from.id) e.to = into.id; });
    }
    pending = deferred;
  }
  result.concepts = result.concepts.filter(c => !decisions.deletes.some(k => conceptMatches(c, k)));
  const ids = new Set(result.concepts.map(c => c.id));
  const edges = new Map<string, KbGraph['edges'][number]>();
  for (const e of result.edges) {
    if (e.from === e.to || !ids.has(e.from) || !ids.has(e.to)) continue;
    e.id = `${e.from}|${e.kind}|${e.to}`;
    const prev = edges.get(e.id);
    if (prev) { prev.labels = union([...prev.labels, ...e.labels]); prev.provenance = union([...prev.provenance, ...e.provenance]); }
    else edges.set(e.id, e);
  }
  result.edges = [...edges.values()];
  return result;
}
export function renameConcept(d: KbDecisions, key: string, label: string): KbDecisions {
  key = termKey(key);
  const old = d.renames.find(r => r.key === key || termKey(r.label) === key);
  return { ...d, renames: [...d.renames.filter(r => r !== old && r.key !== key), { key: old?.key ?? key, label }] };
}
export function mergeConcept(d: KbDecisions, from: string, into: string): KbDecisions {
  from = termKey(from); into = termKey(into);
  return from === into ? d : { ...d, merges: [...d.merges.filter(m => m.from !== from), { from, into }] };
}
export function deleteConcept(d: KbDecisions, key: string): KbDecisions {
  key = termKey(key);
  const keys = new Set([key, ...d.renames.filter(r => r.key === key || termKey(r.label) === key).map(r => r.key)]);
  return { ...d, deletes: union([...d.deletes, ...keys]), renames: d.renames.filter(r => !keys.has(r.key)), merges: d.merges.filter(m => !keys.has(m.from) && !keys.has(m.into)) };
}
export function rejectSuggestion(d: KbDecisions, pageId: string, blockId: string, key: string): KbDecisions {
  return { ...d, rejected: union([...d.rejected, { pageId, blockId, key: termKey(key) }]) };
}
export function decideProposal(d: KbDecisions, id: string, status: 'accepted' | 'rejected'): KbDecisions {
  return { ...d, proposals: [...(d.proposals ?? []).filter(p => p.id !== id), { id, status }] };
}
