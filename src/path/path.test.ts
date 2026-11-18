import { describe, expect, it } from 'vitest';
import { mlMap, validateMap } from './model';
import type { SubjectMap } from './model';
import { matchNotes } from './match';
import { planPath } from './plan';
import type { KbGraph, PageExtraction } from '../kb/model';

const tiny = (): SubjectMap => ({ id: 'tiny', subject: 'Tiny', version: 1, provenance: { status: 'unverified', source: 'test', model: 'fixture' }, concepts: [
  { id: 'a', label: 'Policy', aliases: [], description: 'A', prerequisites: [] },
  { id: 'b', label: 'Policy gradient', aliases: ['PG'], description: 'B', prerequisites: ['a'] },
  { id: 'c', label: 'Actor critic', aliases: [], description: 'C', prerequisites: ['b'] },
] });
const empty = { graph: { concepts: [], edges: [] }, extractions: [] };
describe('subject maps', () => {
  it('validates the curated ML map', () => expect(validateMap(mlMap)).toEqual([]));
  it.each([
    ['Duplicate id', (m: SubjectMap) => { m.concepts.push({ ...m.concepts[0] }); }],
    ['Unknown prerequisite', (m: SubjectMap) => { m.concepts[0].prerequisites = ['missing']; }],
    ['Self prerequisite', (m: SubjectMap) => { m.concepts[0].prerequisites = ['a']; }],
    ['Cycle: a -> c -> b -> a', (m: SubjectMap) => { m.concepts[0].prerequisites = ['c']; }],
    ['Empty label', (m: SubjectMap) => { m.concepts[0].label = ' '; }],
    ['Empty description', (m: SubjectMap) => { m.concepts[0].description = ''; }],
    ['Shared term', (m: SubjectMap) => { m.concepts[1].aliases.push('Policies'); }],
    ['Unknown area', (m: SubjectMap) => { m.areas = [{ id: 'x', label: 'X' }]; }],
    ['Area rank', (m: SubjectMap) => { m.areas = [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }]; m.concepts.forEach(c => { c.area = 'x'; }); m.concepts[0].area = 'y'; }],
  ])('detects %s', (message, mutate) => { const m = tiny(); mutate(m); expect(validateMap(m).join(';')).toContain(message); });
});
describe('notes and paths', () => {
  it('handles empty notes, no areas, unverified maps and errors', () => {
    const m = tiny(), matches = matchNotes(m, empty), p = planPath(m, ['Actor critic'], matches);
    expect(p.steps.map(s => s.conceptId)).toEqual(['a', 'b', 'c']);
    expect(p.next).toEqual(['a']); expect(p.provenance.status).toBe('unverified'); expect(p.stages.length).toBeGreaterThan(0);
    expect(() => planPath(m, ['unknown'], matches)).toThrow('Unknown concept');
    expect(() => matchNotes(m, empty, ['unknown'])).toThrow('Unknown concept');
    m.concepts[0].prerequisites = ['c']; expect(() => planPath(m, ['c'], matches)).toThrow('Cycle');
    expect(planPath(tiny(), [], matches).steps).toEqual([]);
  });
  it('keeps declarations separate, assumes prerequisites, and retains done steps', () => {
    const m = tiny(), initial = planPath(m, ['c'], matchNotes(m, empty));
    const matches = matchNotes(m, empty, ['PG']);
    expect(matches[1]).toMatchObject({ state: 'known', basis: 'declared', declared: true, evidence: [] });
    const p = planPath(m, ['c'], matches, initial);
    expect(p.steps.map(s => s.status)).toEqual(['done', 'done', 'todo']); expect(p.next).toEqual(['c']);
    expect(p.skipped.find(s => s.conceptId === 'a')?.reason).toContain('Policy gradient');
    expect(planPath(m, ['b'], matches).goalsKnown).toEqual(['b']);
  });
  it('uses longest contextual mentions, not isolated generic words', () => {
    const extractions: PageExtraction[] = [{ pageId: 'p', extractor: 'test', terms: [], relations: [], texts: [{ blockId: 'b', text: 'Policy gradient and Actor critic' }] },
      { pageId: 'history', extractor: 'test', terms: [], relations: [], texts: [{ blockId: 'h', text: 'tax policy' }] }];
    const matches = matchNotes(tiny(), { ...empty, extractions });
    expect(matches.map(m => m.state)).toEqual(['new', 'partial', 'partial']);
    expect(planPath(tiny(), ['c'], matches).steps[1].reason).toContain('page p');
    expect(matchNotes(tiny(), { ...empty, extractions: [extractions[0]], }, ['PG'])[1].evidence).toEqual([]);
  });
  it('does not trust proposals, but trusts accepted model concepts and preserves note evidence', () => {
    const provenance = [{ pageId: 'p', blockId: 'b', surface: 'PG', strokeIds: [], extractor: 'test' }];
    const graph: KbGraph = { concepts: [{ id: 'n', label: 'PG', aliases: [], provenance, origin: 'model', status: 'proposed' }], edges: [],
      proposals: [{ id: 'alias', kind: 'alias', label: 'Actor critic', conceptId: 'n', origin: 'model', status: 'proposed', provenance }] };
    expect(matchNotes(tiny(), { graph, extractions: [] }).map(m => m.state)).toEqual(['new', 'partial', 'partial']);
    graph.concepts[0].status = 'accepted'; graph.concepts[0].aliases = ['Actor critic'];
    const matches = matchNotes(tiny(), { graph, extractions: [] }, ['PG']);
    expect(matches[1]).toMatchObject({ basis: 'notes', declared: true }); expect(matches[1].evidence).toHaveLength(1);
    expect(matches[2].state).toBe('partial');
    const first = planPath(tiny(), ['c'], matches);
    expect(planPath(tiny(), ['c'], matchNotes(tiny(), { graph: { ...graph, concepts: [...graph.concepts].reverse(), edges: [...graph.edges].reverse() }, extractions: [] }, ['PG']))).toEqual(first);
  });
});
