import toy from '../../projects/rlhf-rlvr-toy/project.json';
import type { SubjectMap } from './model';
import type { Resource } from './resources';

export interface StarterProject {
  id: string; title: string; mapId: string; stage: string; concepts: string[];
  minutes: number; level: Resource['level']; dir: string; files: string[];
  solutionFiles: string[]; run: string; requirements: string[];
}
export const starterProjects = [toy] as StarterProject[];
export function validateProjects(map: SubjectMap, projects: StarterProject[]): string[] {
  const errors: string[] = [], ids = new Set<string>();
  const concepts = new Set(map.concepts.map(c => c.id));
  for (const p of projects) {
    if (ids.has(p.id)) errors.push(`Duplicate project id: ${p.id}`);
    ids.add(p.id);
    if (p.mapId !== map.id) errors.push(`mapId mismatch: ${p.id}`);
    if (!map.areas?.some(a => a.id === p.stage)) errors.push(`Unknown stage ${p.stage}: ${p.id}`);
    for (const id of p.concepts) if (!concepts.has(id)) errors.push(`Unknown concept ${id}: ${p.id}`);
    if (!p.files.length) errors.push(`Empty files: ${p.id}`);
    const safe = (path: string) => !!path && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(s => s === '..' || s === '.' || !s);
    if (!safe(p.dir)) errors.push(`Invalid project dir: ${p.id}`);
    for (const file of [...p.files, ...p.solutionFiles]) if (!safe(file)) errors.push(`Invalid project path: ${file}`);
    for (const file of p.solutionFiles) if (p.files.includes(file)) errors.push(`Solution exported: ${file}`);
  }
  return errors;
}
