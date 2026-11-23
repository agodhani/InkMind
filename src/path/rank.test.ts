import { describe, expect, it } from 'vitest';
import type { SubjectMap } from './model';
import type { Resource, ResourceCatalog } from './resources';
import { matchNotes } from './match';
import { planPath } from './plan';
import { rankProjects, rankResources } from './rank';
import { starterProjects } from './projects';

const map: SubjectMap = { id: 'tiny', subject: 'Tiny', version: 1, provenance: { status: 'verified', source: 'test' }, areas: [{ id: 'learn', label: 'Learn' }],
  concepts: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, label: id.toUpperCase(), description: id, aliases: [], prerequisites: i === 1 ? ['a'] : [], area: 'learn' })) };
const empty = { graph: { concepts: [], edges: [] }, extractions: [] };
const plan = () => planPath(map, ['b', 'c', 'd'], matchNotes(map, empty));
const resource = (id: string, concepts: string[], changes: Partial<Resource> = {}): Resource => ({
  id, title: id, author: 'Test', url: `https://example.com/${id}`, format: 'docs', minutes: 240, level: 'intermediate', free: true, concepts, checked: '2026-11-18', ...changes,
});
const catalog = (...resources: Resource[]): ResourceCatalog => ({ mapId: 'tiny', version: 1, resources });
describe('resource ranking', () => {
  it('caps prerequisite labels at three and omits zero additional coverage', () => {
    const m = structuredClone(map);
    m.concepts.push({ id: 'e', label: 'E', description: 'E', aliases: [], prerequisites: ['a', 'b', 'c', 'd'], area: 'learn' });
    const p = planPath(m, ['e'], matchNotes(m, empty));
    const r = rankResources(m, p, catalog(resource('advanced', ['e'], { level: 'advanced' })));
    expect(r.steps.e[0].reason).toBe('teaches E; docs, 4 h; assumes A, B, C and 1 more first');
    expect(r.path[0].reason).toContain('assumes A, B, C and 1 more first');
    expect(r.steps.e[0].reason).not.toContain('also covers');
  });
  it('is deterministic across resource ordering, breaks ties by value, minutes, then id', () => {
    const a = resource('a', ['a']), z = resource('z', ['a']);
    expect(rankResources(map, plan(), catalog(z, a))).toEqual(rankResources(map, plan(), catalog(a, z)));
    expect(rankResources(map, plan(), catalog(z, a)).path[0].resourceId).toBe('a');
    const short = resource('short', ['a'], { minutes: 120 });
    const more = resource('more', ['b'], { minutes: 300 });
    expect(rankResources(map, plan(), catalog(short, more)).path[0].resourceId).toBe('more');
    const partial = plan(); partial.steps[0].status = 'partial';
    expect(rankResources(map, partial, catalog(resource('long', ['a']), resource('short', ['a'], { minutes: 239 }))).path[0].resourceId).toBe('short');
  });
  it('defaults to free-only, permits opting out, ignores irrelevant resources', () => {
    const c = catalog(resource('paid', ['b'], { free: false }), resource('irrelevant', ['unknown']));
    expect(rankResources(map, plan(), c).path).toEqual([]);
    expect(rankResources(map, plan(), c, { freeOnly: false }).path.map(r => r.resourceId)).toEqual(['paid']);
  });
  it('applies exact format, time, partial and goal weights with rounding', () => {
    const c = catalog(resource('video', ['a', 'b'], { format: 'video' }));
    const p = plan(); p.steps[0].status = 'partial';
    expect(rankResources(map, p, c).path[0].score).toBe(1);
    expect(rankResources(map, p, c, { formats: ['video'] }).path[0].score).toBe(1.5);
    expect(rankResources(map, p, c, { maxMinutes: 60 }).path[0].score).toBe(0.5);
    expect(rankResources(map, p, c, { maxMinutes: 240 }).path[0].score).toBe(1);
    expect(rankResources(map, p, catalog(resource('odd', ['a'], { minutes: 13 }))).path[0].score).toBe(0.4743);
  });
  it('penalizes advanced prerequisites only when not done and not covered', () => {
    const c = catalog(resource('advanced', ['b'], { level: 'advanced' }));
    const r = rankResources(map, plan(), c).path[0];
    expect(r.score).toBe(0.5625); expect(r.reason).toContain('assumes A first');
    expect(rankResources(map, plan(), catalog(resource('complete', ['a', 'b'], { level: 'advanced' }))).path[0].score).toBe(1.25);
    const p = plan(); p.steps[0].status = 'done';
    expect(rankResources(map, p, c).path[0].score).toBe(0.75);
  });
  it('penalizes intro resources when at least half of concepts are known/assumed/done', () => {
    const p = plan(); p.steps[0].status = 'done';
    const r = rankResources(map, p, catalog(resource('review', ['a', 'b'], { level: 'intro' }))).path[0];
    expect(r.score).toBe(0.5625); expect(r.reason).toContain('mostly reviews what you know');
    const known = planPath(map, ['b'], matchNotes(map, empty, ['a']));
    expect(rankResources(map, known, catalog(resource('review', ['a', 'b'], { level: 'intro' }))).path[0].score).toBe(0.5625);
  });
  it('uses greedy marginal coverage but per-step full value and plan-order covers', () => {
    const c = catalog(resource('first', ['b', 'a'], { minutes: 1 }), resource('overlap', ['a', 'b', 'c'], { minutes: 240 }), resource('fresh', ['d', 'c'], { minutes: 200 }));
    const r = rankResources(map, plan(), c);
    expect(r.path.map(x => x.resourceId)).toEqual(['first', 'fresh']);
    expect(r.path[0].covers).toEqual(['a', 'b']);
    expect(r.steps.c[0].resourceId).toBe('overlap');
    expect(r.steps.c[0].score).toBe(2);
    expect(rankResources(map, plan(), c, { limit: 1 }).path).toHaveLength(1);
    expect(rankResources(map, plan(), c, { limit: 0 }).path).toEqual([]);
  });
  it('never counts done steps and returns empty rankings for a known goal', () => {
    const p = plan(); p.steps[0].status = 'done';
    const r = rankResources(map, p, catalog(resource('all', ['a', 'b', 'c', 'd'])));
    expect(r.path[0].covers).toEqual(['b', 'c', 'd']); expect(r.steps.a).toBeUndefined();
    expect(r.path[0].score).toBe(2.25);
    const done = planPath(map, ['b'], matchNotes(map, empty, ['b']));
    expect(rankResources(map, done, catalog(resource('all', ['a', 'b'])))).toEqual({ path: [], steps: {} });
    expect(rankResources(map, plan(), catalog())).toEqual({ path: [], steps: { a: [], b: [], c: [], d: [] } });
  });
});
describe('project ranking', () => {
  const project = (id: string, concepts: string[]) => ({ ...starterProjects[0], id, mapId: map.id, stage: 'learn', concepts });
  it('attaches stages, orders by covered count then id, and excludes done/irrelevant projects', () => {
    const p = plan(); p.steps[0].status = 'done';
    const projects = [project('z', ['a', 'b']), project('a', ['b']), project('more', ['b', 'c']), project('none', ['a'])];
    const r = rankProjects(map, p, projects);
    expect(r.map(p => p.projectId)).toEqual(['more', 'a', 'z']);
    expect(r[0]).toEqual({ projectId: 'more', stage: 'learn', covers: ['b', 'c'], reason: 'exercises 2 of your remaining steps (B, C)' });
    expect(rankProjects(map, p, [...projects].reverse())).toEqual(r);
    expect(rankProjects(map, p, [])).toEqual([]);
    expect(rankProjects(map, planPath(map, ['b'], matchNotes(map, empty, ['b'])), projects)).toEqual([]);
  });
});
