import { describe, expect, it } from 'vitest';
import type { PathMaterialsProvider } from './materials';
import { matchNotes } from './match';
import type { SubjectMap } from './model';
import { planPath } from './plan';
import { starterProjects } from './projects';
import { rankProjects, rankResources } from './rank';
import { createRankedMaterials } from './rankedMaterials';
import type { Resource, ResourceCatalog } from './resources';

const map: SubjectMap = { id: 'tiny', subject: 'Tiny', version: 1, provenance: { status: 'verified', source: 'test' },
  areas: [{ id: 'first', label: 'First' }, { id: 'last', label: 'Last' }],
  concepts: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, label: id, description: id, aliases: [], prerequisites: [],
    area: id === 'a' ? 'first' : 'last' })) };
const empty = { graph: { concepts: [], edges: [] }, extractions: [] };
const plan = () => planPath(map, ['a', 'b', 'c', 'd', 'e'], matchNotes(map, empty));
const resource = (id: string, concepts: string[], changes: Partial<Resource> = {}): Resource => ({
  id, title: `Title ${id}`, author: 'Test', url: `https://example.com/${id}`, format: 'docs', minutes: 60,
  level: 'intermediate', free: true, concepts, checked: '2026-11-18', ...changes,
});
const catalog: ResourceCatalog = { mapId: map.id, version: 1, resources: [
  resource('cross-stage', ['a', 'b'], { minutes: 1 }), resource('b', ['b']), resource('c', ['c']),
  resource('d', ['d']), resource('e', ['e']), resource('a', ['a']), resource('a-second', ['a']),
  resource('paid', ['a', 'b', 'c', 'd', 'e'], { free: false, format: 'video' }),
] };
const projects = [
  { ...starterProjects[0], id: 'small', title: 'Small', mapId: map.id, stage: 'last', concepts: ['a'], dir: 'projects/small' },
  { ...starterProjects[0], id: 'large', title: 'Large', mapId: map.id, stage: 'last', concepts: ['a', 'b'], dir: 'projects/large' },
];
describe('ranked materials adapter', () => {
  it('implements the provider with the top three per-step links and rich resource metadata', () => {
    const p = plan(), prefs = { freeOnly: false, formats: ['video' as const] };
    const provider = createRankedMaterials(map, p, catalog, projects, prefs);
    const compatible: PathMaterialsProvider = provider;
    const ranked = rankResources(map, p, catalog, prefs);
    const links = provider.forStep(map.id, 'a')!.resources;
    expect(compatible.forStep(map.id, 'a')).toEqual(provider.forStep(map.id, 'a'));
    expect(links).toHaveLength(3);
    expect(links.map(r => r.href)).toEqual(ranked.steps.a.slice(0, 3).map(r => catalog.resources.find(x => x.id === r.resourceId)!.url));
    expect(links[0]).toEqual({ title: 'Title paid', href: 'https://example.com/paid', reason: ranked.steps.a[0].reason,
      format: 'video', minutes: 60, free: false });
    expect(createRankedMaterials(map, p, catalog, projects).forStep(map.id, 'a')!.resources.some(r => !r.free)).toBe(false);
  });
  it('filters path recommendations by any remaining coverage in the stage, retaining path order and capping at three', () => {
    const p = plan(), ranked = rankResources(map, p, catalog);
    const provider = createRankedMaterials(map, p, catalog, projects);
    const last = provider.forStage(map.id, 'last')!;
    expect(last.resources.map(r => r.href)).toEqual(['cross-stage', 'c', 'd'].map(id => `https://example.com/${id}`));
    expect(last.resources[0].reason).toBe(ranked.path[0].reason);
    expect(provider.forStage(map.id, 'first')!.resources.map(r => r.href)).toEqual(['https://example.com/cross-stage']);
    expect(createRankedMaterials(map, p, catalog, projects, { limit: 1 }).forStage(map.id, 'last')!.resources).toHaveLength(1);
  });
  it('chooses the highest ranked exercising project for steps and the attached project for stages', () => {
    const p = plan(), provider = createRankedMaterials(map, p, catalog, projects);
    const project = provider.forStep(map.id, 'a')!.project;
    expect(project).toEqual({ title: 'Large', href: 'https://github.com/agodhani/InkMind/tree/main/projects/large',
      reason: rankProjects(map, p, projects)[0].reason, format: 'code', minutes: 300, free: true });
    expect(provider.forStage(map.id, 'last')!.project).toEqual(project);
    expect(provider.forStage(map.id, 'first')!.project).toBeUndefined();
    expect(provider.forStep(map.id, 'c')!.project).toBeUndefined();
  });
  it('returns undefined for foreign maps, unknown/done steps and empty/unknown stages', () => {
    const p = plan(); p.steps[0].status = 'done';
    const provider = createRankedMaterials(map, p, catalog, projects);
    expect(provider.forStep('other', 'b')).toBeUndefined();
    expect(provider.forStage('other', 'last')).toBeUndefined();
    expect(provider.forStep(map.id, 'unknown')).toBeUndefined();
    expect(provider.forStep(map.id, 'a')).toBeUndefined();
    expect(provider.forStage(map.id, 'first')).toBeUndefined();
    expect(provider.forStage(map.id, 'unknown')).toBeUndefined();
    const known = planPath(map, ['a'], matchNotes(map, empty, ['a']));
    expect(createRankedMaterials(map, known, catalog, projects).forStep(map.id, 'a')).toBeUndefined();
  });
  it('handles empty materials and empty plans without inventing links', () => {
    const provider = createRankedMaterials(map, plan(), { ...catalog, resources: [] }, []);
    expect(provider.forStep(map.id, 'a')).toEqual({ resources: [], project: undefined });
    expect(provider.forStage(map.id, 'last')).toEqual({ resources: [], project: undefined });
    const p = planPath(map, [], []);
    expect(createRankedMaterials(map, p, catalog, projects).forStage(map.id, 'last')).toBeUndefined();
  });
  it('is deterministic and does not mutate its inputs', () => {
    const p = plan(), inputs = structuredClone({ map, p, catalog, projects });
    const a = createRankedMaterials(map, p, catalog, projects);
    const b = createRankedMaterials(map, p, { ...catalog, resources: [...catalog.resources].reverse() }, [...projects].reverse());
    expect(a.forStep(map.id, 'a')).toEqual(b.forStep(map.id, 'a'));
    expect(a.forStage(map.id, 'last')).toEqual(b.forStage(map.id, 'last'));
    expect({ map, p, catalog, projects }).toEqual(inputs);
  });
});
