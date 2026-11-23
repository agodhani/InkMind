import { describe, expect, it } from 'vitest';
import { mlMap } from './model';
import { mlCatalog, uncoveredConcepts, validateCatalog } from './resources';
import type { Resource } from './resources';
import userCase from '../../eval/path/cases/backprop-minimax-to-rlhf-rlvr.json';

const fixture = () => ({ mapId: 'ml', version: 1, resources: [structuredClone(mlCatalog.resources[0])] });
describe('resource catalog', () => {
  it('validates the ML catalog and covers the full user path with free resources', () => {
    expect(validateCatalog(mlMap, mlCatalog)).toEqual([]);
    expect(uncoveredConcepts(mlMap, mlCatalog, userCase.expected.steps)).toEqual([]);
    expect(mlCatalog.resources.every(r => r.free)).toBe(true);
  });
  it('accepts an empty catalog and reports uncovered concepts in requested order', () => {
    const catalog = { ...fixture(), resources: [] };
    expect(validateCatalog(mlMap, catalog)).toEqual([]);
    expect(uncoveredConcepts(mlMap, catalog)).toEqual(mlMap.concepts.map(c => c.id));
    expect(uncoveredConcepts(mlMap, catalog, ['ppo', 'rl'])).toEqual(['ppo', 'rl']);
    expect(uncoveredConcepts(mlMap, mlCatalog, [])).toEqual([]);
  });
  it.each(['id', 'title', 'author', 'url', 'checked', 'format', 'level', 'minutes', 'free', 'concepts'] as const)('rejects missing %s', key => {
    const catalog = fixture();
    delete (catalog.resources[0] as Partial<Resource>)[key];
    expect(validateCatalog(mlMap, catalog).length).toBeGreaterThan(0);
  });
  it.each(['id', 'title', 'author', 'url', 'checked'] as const)('rejects blank %s', key => {
    const catalog = fixture();
    catalog.resources[0][key] = '  ';
    expect(validateCatalog(mlMap, catalog).length).toBeGreaterThan(0);
  });
  it.each([
    ['id', 'Not kebab'], ['concepts', []], ['concepts', ['made-up']],
    ['format', 'podcast'], ['level', 'expert'], ['minutes', 0], ['minutes', -1], ['minutes', 1.5],
    ['minutes', NaN], ['free', 'true'], ['url', 'http://example.com'], ['url', 'not a URL'],
    ['checked', '2026-02-30'], ['checked', '2026-13-01'], ['checked', 'yesterday'], ['checked', '2026-1-1'],
  ])('rejects invalid %s (%j)', (key, value) => {
    const catalog = fixture();
    Object.assign(catalog.resources[0], { [key]: value });
    expect(validateCatalog(mlMap, catalog).length).toBeGreaterThan(0);
  });
  it('rejects duplicate ids', () => {
    const catalog = fixture();
    catalog.resources.push({ ...catalog.resources[0], url: 'https://example.com/other' });
    expect(validateCatalog(mlMap, catalog)).toContain('Duplicate id: zero-to-hero');
  });
  it.each(['https://EXAMPLE.com/topic/', 'https://www.example.com/topic#section', 'https://example.com/topic/#section'])('normalizes duplicate URLs: %s', url => {
    const catalog = fixture();
    catalog.resources[0].url = 'https://example.com/topic';
    catalog.resources.push({ ...catalog.resources[0], id: 'other', url });
    expect(validateCatalog(mlMap, catalog)).toContain('Duplicate URL: other');
  });
  it('rejects mismatched or missing mapId, invalid version and missing resource array', () => {
    expect(validateCatalog(mlMap, { ...fixture(), mapId: 'other' })).toContain('mapId mismatch');
    expect(validateCatalog(mlMap, { ...fixture(), mapId: '' })).toContain('mapId mismatch');
    expect(validateCatalog(mlMap, { ...fixture(), version: 0 })).toContain('Invalid version');
    expect(validateCatalog(mlMap, { ...fixture(), resources: undefined } as never)).toContain('Missing resources');
  });
});
