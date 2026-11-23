import type { SubjectMap } from './model';
import type { PathPlan } from './plan';
import type { Resource, ResourceCatalog } from './resources';
import type { StarterProject } from './projects';

export type Format = Resource['format'];
export interface ResourcePreferences { formats?: Format[]; maxMinutes?: number; freeOnly?: boolean; limit?: number }
export interface Recommendation { resourceId: string; score: number; covers: string[]; reason: string }
export interface ProjectRecommendation { projectId: string; stage: string; covers: string[]; reason: string }
const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const duration = (minutes: number) => minutes >= 60 ? `${Number((minutes / 60).toFixed(1))} h` : `${minutes} min`;

export function rankResources(map: SubjectMap, plan: PathPlan, catalog: ResourceCatalog, prefs: ResourcePreferences = {}): { path: Recommendation[]; steps: Record<string, Recommendation[]> } {
  const remaining = plan.steps.filter(s => s.status !== 'done');
  const remainingIds = new Set(remaining.map(s => s.conceptId));
  const known = new Set([...plan.skipped.map(s => s.conceptId), ...plan.steps.filter(s => s.status === 'done').map(s => s.conceptId)]);
  const byId = new Map(map.concepts.map(c => [c.id, c]));
  const labels = (ids: string[]) => ids.map(id => byId.get(id)?.label ?? id).join(', ');
  const assumptionsLabel = (ids: string[]) => labels(ids.slice(0, 3)) + (ids.length > 3 ? ` and ${ids.length - 3} more` : '');
  const eligible = catalog.resources.filter(r => !(prefs.freeOnly ?? true) || r.free);
  function score(resource: Resource, available: Set<string>) {
    const covered = remaining.filter(s => available.has(s.conceptId) && resource.concepts.includes(s.conceptId));
    const covers = covered.map(s => s.conceptId);
    const value = covered.reduce((sum, s) => sum + (s.status === 'partial' ? 0.5 : 1) + (s.goal ? 0.5 : 0), 0);
    const assumptions = [...new Set(remaining.filter(s => resource.concepts.includes(s.conceptId)).flatMap(s => byId.get(s.conceptId)?.prerequisites ?? [])
      .filter(id => remainingIds.has(id) && !resource.concepts.includes(id)))];
    const reviews = resource.concepts.filter(id => known.has(id)).length >= resource.concepts.length / 2;
    const levelNote = resource.level === 'advanced' && assumptions.length ? `assumes ${assumptionsLabel(assumptions)} first`
      : resource.level === 'intro' && reviews ? 'mostly reviews what you know' : '';
    const formatFactor = prefs.formats?.includes(resource.format) ? 1.5 : 1;
    const timeNote = prefs.maxMinutes && resource.minutes > prefs.maxMinutes ? 'exceeds your available time' : '';
    const timeFactor = 1 / (1 + resource.minutes / 240) * (timeNote ? 0.5 : 1);
    return { resource, covers, value, score: Math.round(value * formatFactor * (levelNote ? 0.75 : 1) * timeFactor * 10000) / 10000,
      suffix: [`${resource.format}, ${duration(resource.minutes)}`, levelNote, timeNote].filter(Boolean).join('; ') };
  }
  type Scored = ReturnType<typeof score>;
  const compare = (a: Scored, b: Scored) => b.score - a.score || b.value - a.value || a.resource.minutes - b.resource.minutes || compareIds(a.resource.id, b.resource.id);
  const full = eligible.map(r => score(r, remainingIds)).filter(r => r.covers.length).sort(compare);
  const steps: Record<string, Recommendation[]> = {};
  for (const step of remaining) {
    steps[step.conceptId] = full.filter(r => r.covers.includes(step.conceptId)).map(r => ({
      resourceId: r.resource.id, score: r.score, covers: r.covers,
      reason: `teaches ${step.label}${r.covers.length > 1 ? `; also covers ${r.covers.length - 1} more of your remaining steps` : ''}; ${r.suffix}`,
    }));
  }
  const path: Recommendation[] = [], available = new Set(remainingIds), used = new Set<string>();
  const limit = Math.max(0, Math.floor(prefs.limit ?? 10));
  while (path.length < limit) {
    const best = eligible.filter(r => !used.has(r.id)).map(r => score(r, available)).filter(r => r.covers.length).sort(compare)[0];
    if (!best) break;
    const totalCovers = remaining.filter(s => best.resource.concepts.includes(s.conceptId)).map(s => s.conceptId);
    path.push({ resourceId: best.resource.id, score: best.score, covers: totalCovers,
      reason: `covers ${totalCovers.length} of your ${remaining.length} remaining steps (${best.covers.length} new: ${labels(best.covers)}); ${best.suffix}` });
    best.covers.forEach(id => available.delete(id));
    used.add(best.resource.id);
  }
  return { path, steps };
}

export function rankProjects(map: SubjectMap, plan: PathPlan, projects: StarterProject[]): ProjectRecommendation[] {
  const remaining = plan.steps.filter(s => s.status !== 'done');
  return projects.filter(p => p.mapId === map.id && map.areas?.some(a => a.id === p.stage)).map(p => {
    const covered = remaining.filter(s => p.concepts.includes(s.conceptId));
    return { projectId: p.id, stage: p.stage, covers: covered.map(s => s.conceptId),
      reason: `exercises ${covered.length} of your remaining steps (${covered.map(s => s.label).join(', ')})` };
  }).filter(p => p.covers.length).sort((a, b) => b.covers.length - a.covers.length || compareIds(a.projectId, b.projectId));
}
