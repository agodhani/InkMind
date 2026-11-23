import { stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import type { StarterProject } from './projects';

export async function checkProjectFiles(projects: StarterProject[], root = process.cwd()): Promise<string[]> {
  const errors: string[] = [];
  for (const project of projects) {
    for (const file of [...project.files, ...project.solutionFiles]) {
      const path = resolve(root, project.dir, file), rel = relative(resolve(root), path);
      if (rel.startsWith('..') || isAbsolute(rel)) { errors.push(`Outside repository: ${path}`); continue; }
      try { if (!(await stat(path)).isFile()) errors.push(`Not a file: ${path}`); }
      catch { errors.push(`Missing file: ${path}`); }
    }
  }
  return errors;
}
