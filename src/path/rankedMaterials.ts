import type { PathMaterialLink, PathMaterialsProvider } from './materials';
import type { SubjectMap } from './model';
import type { PathPlan } from './plan';
import type { StarterProject } from './projects';
import { rankProjects, rankResources } from './rank';
import type { Recommendation, ProjectRecommendation, ResourcePreferences } from './rank';
import type { Resource, ResourceCatalog } from './resources';

export interface RankedMaterialLink extends PathMaterialLink {
  reason: string; format: Resource['format']; minutes: number; free: boolean;
}
export interface RankedMaterials {
  resources: readonly RankedMaterialLink[];
  project?: RankedMaterialLink;
}
export interface RankedMaterialsProvider extends PathMaterialsProvider {
  forStep(mapId: string, conceptId: string): RankedMaterials | undefined;
  forStage(mapId: string, stageId: string): RankedMaterials | undefined;
}

export function createRankedMaterials(map: SubjectMap, plan: PathPlan, catalog: ResourceCatalog,
  projects: StarterProject[], prefs: ResourcePreferences = {}): RankedMaterialsProvider {
  const resources = rankResources(map, plan, catalog, prefs);
  const rankedProjects = rankProjects(map, plan, projects);
  const resourceById = new Map(catalog.resources.map(r => [r.id, r]));
  const projectById = new Map(projects.map(p => [p.id, p]));
  const remaining = plan.steps.filter(s => s.status !== 'done');
  const stepIds = new Set(remaining.map(s => s.conceptId));
  function resourceLinks(recommendations: Recommendation[]): RankedMaterialLink[] {
    return recommendations.slice(0, 3).map(r => {
      const item = resourceById.get(r.resourceId)!;
      return { title: item.title, href: item.url, reason: r.reason, format: item.format, minutes: item.minutes, free: item.free };
    });
  }
  function projectLink(recommendation?: ProjectRecommendation): RankedMaterialLink | undefined {
    if (!recommendation) return undefined;
    const item = projectById.get(recommendation.projectId)!;
    // This public repository URL resolves once the project is merged to main.
    return { title: item.title, href: `https://github.com/agodhani/InkMind/tree/main/${item.dir}`,
      reason: recommendation.reason, format: 'code', minutes: item.minutes, free: true };
  }
  return {
    forStep(mapId, conceptId) {
      if (mapId !== map.id || !stepIds.has(conceptId)) return undefined;
      return { resources: resourceLinks(resources.steps[conceptId] ?? []),
        project: projectLink(rankedProjects.find(p => p.covers.includes(conceptId))) };
    },
    forStage(mapId, stageId) {
      const stageSteps = new Set(remaining.filter(s => s.stage === stageId).map(s => s.conceptId));
      if (mapId !== map.id || !stageSteps.size) return undefined;
      return { resources: resourceLinks(resources.path.filter(r => r.covers.some(id => stageSteps.has(id)))),
        project: projectLink(rankedProjects.find(p => p.stage === stageId)) };
    },
  };
}
