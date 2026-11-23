import mlData from './resources/ml.json';
import type { SubjectMap } from './model';

export interface Resource {
  id: string; title: string; author: string; url: string;
  format: 'video' | 'paper' | 'book' | 'course' | 'docs' | 'code';
  minutes: number; level: 'intro' | 'intermediate' | 'advanced';
  free: boolean; concepts: string[]; checked: string; note?: string;
}
export interface ResourceCatalog { mapId: string; version: number; resources: Resource[] }
export const mlCatalog = mlData as ResourceCatalog;

function normalizedUrl(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}

export function validateCatalog(map: SubjectMap, catalog: ResourceCatalog): string[] {
  const errors: string[] = [], ids = new Set<string>(), urls = new Set<string>();
  const concepts = new Set(map.concepts.map(c => c.id));
  if (catalog.mapId !== map.id) errors.push('mapId mismatch');
  if (!Number.isInteger(catalog.version) || catalog.version <= 0) errors.push('Invalid version');
  if (!Array.isArray(catalog.resources)) return [...errors, 'Missing resources'];
  for (const resource of catalog.resources) {
    if (!resource || typeof resource !== 'object') { errors.push('Invalid resource'); continue; }
    const name = resource.id || '(missing id)';
    for (const key of ['id', 'title', 'author', 'url', 'checked'] as const) {
      if (typeof resource[key] !== 'string' || !resource[key].trim()) errors.push(`Missing ${key}: ${name}`);
    }
    if (typeof resource.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resource.id)) errors.push(`Invalid id: ${name}`);
    if (ids.has(resource.id)) errors.push(`Duplicate id: ${name}`);
    ids.add(resource.id);
    try {
      if (new URL(resource.url).protocol !== 'https:') errors.push(`Non-https URL: ${name}`);
      const url = normalizedUrl(resource.url);
      if (urls.has(url)) errors.push(`Duplicate URL: ${name}`);
      urls.add(url);
    } catch { errors.push(`Invalid URL: ${name}`); }
    if (!['video', 'paper', 'book', 'course', 'docs', 'code'].includes(resource.format)) errors.push(`Invalid format: ${name}`);
    if (!['intro', 'intermediate', 'advanced'].includes(resource.level)) errors.push(`Invalid level: ${name}`);
    if (!Number.isInteger(resource.minutes) || resource.minutes <= 0) errors.push(`Invalid minutes: ${name}`);
    if (typeof resource.free !== 'boolean') errors.push(`Invalid free: ${name}`);
    if (typeof resource.checked !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(resource.checked)
      || !Number.isFinite(Date.parse(resource.checked)) || new Date(resource.checked).toISOString().slice(0, 10) !== resource.checked) errors.push(`Invalid checked: ${name}`);
    if (!Array.isArray(resource.concepts) || !resource.concepts.length) errors.push(`Empty concepts: ${name}`);
    else for (const id of resource.concepts) if (!concepts.has(id)) errors.push(`Unknown concept ${id}: ${name}`);
  }
  return errors;
}

export function uncoveredConcepts(map: SubjectMap, catalog: ResourceCatalog, ids: string[] = map.concepts.map(c => c.id)): string[] {
  const covered = new Set(catalog.resources.flatMap(r => r.concepts));
  return ids.filter(id => !covered.has(id));
}
