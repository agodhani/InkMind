import { describe, expect, it } from 'vitest';
import { mlMap, resolveConcept, validateMap } from './model';
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
  it.each(['label', 'alias'])('resolves exact ids before another concept %s', form => {
    const m = tiny();
    if (form === 'label') m.concepts[0].label = 'b';
    else m.concepts[0].aliases.push('b');
    expect(validateMap(m)).toEqual([]);
    expect(resolveConcept(m, 'b')).toBe(m.concepts[1]);
    expect(resolveConcept(m, ' B ')).toBe(m.concepts[0]);
    expect(resolveConcept(m, 'PG')).toBe(m.concepts[1]);
  });
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
  it('does not treat SARSA notes as knowledge of Q-learning', () => {
    const graph: KbGraph = { concepts: [{ id: 'sarsa', label: 'SARSA', aliases: [], provenance: [
      { pageId: 'sarsa-page', blockId: 'heading', surface: 'SARSA', strokeIds: [], extractor: 'det:heading' },
    ] }], edges: [] };
    expect(matchNotes(mlMap, { graph, extractions: [] }).find(m => m.conceptId === 'q-learning'))
      .toMatchObject({ state: 'new', basis: 'none', evidence: [] });
  });
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
  it('restores deleted-page evidence steps at canonical positions without ordering violations', () => {
    const m = tiny(), initial = planPath(m, ['c'], matchNotes(m, empty));
    const notes = { graph: { concepts: [{ id: 'pg', label: 'PG', aliases: [], provenance: [{ pageId: 'p', blockId: 'b', surface: 'PG', strokeIds: [], extractor: 'test' }] }], edges: [] }, extractions: [] };
    const covered = planPath(m, ['c'], matchNotes(m, notes), initial);
    expect(covered.steps.map(s => s.status)).toEqual(['done', 'done', 'todo']);
    const restored = planPath(m, ['c'], matchNotes(m, empty), covered);
    expect(restored.steps.map(s => [s.conceptId, s.status])).toEqual([['a', 'todo'], ['b', 'todo'], ['c', 'todo']]);
    expect(restored.steps.flatMap((s, i) => m.concepts.find(c => c.id === s.conceptId)!.prerequisites.filter(p => restored.steps.findIndex(s => s.conceptId === p) > i))).toHaveLength(0);
    expect(restored.steps[1].missing).toEqual(['a']); expect(restored.next).toEqual(['a']);
  });
  it('inserts extra goals canonically and drops obsolete uncovered steps on goal changes', () => {
    const m = tiny();
    m.concepts.push({ id: 'd', label: 'Independent', aliases: [], description: 'D', prerequisites: [] });
    const matches = matchNotes(m, empty), initial = planPath(m, ['d'], matches);
    const expanded = planPath(m, ['c', 'd'], matches, initial);
    expect(expanded.steps.map(s => s.conceptId)).toEqual(['a', 'b', 'c', 'd']);
    const changed = planPath(m, ['c'], matches, expanded);
    expect(changed.steps.map(s => s.conceptId)).toEqual(['a', 'b', 'c']);
    const retained = planPath(m, ['c'], matchNotes(m, empty, ['Independent']), expanded);
    expect(retained.steps.at(-1)).toMatchObject({ conceptId: 'd', status: 'done' });
  });
  it('preserves the remaining order under monotone replanning', () => {
    const m = tiny(), initial = planPath(m, ['c'], matchNotes(m, empty));
    const next = planPath(m, ['c'], matchNotes(m, empty, ['Policy']), initial);
    const remaining = next.steps.filter(s => s.status !== 'done').map(s => s.conceptId);
    expect(remaining).toEqual(initial.steps.map(s => s.conceptId).filter(id => id !== 'a'));
  });
  it('uses grammatical dependent lists and names goals that are also prerequisites', () => {
    const m = tiny();
    m.concepts.push({ id: 'd', label: 'Fourth', aliases: [], description: 'D', prerequisites: ['a'] },
      { id: 'e', label: 'Fifth', aliases: [], description: 'E', prerequisites: ['a'] });
    const p = planPath(m, ['b', 'c', 'd', 'e'], matchNotes(m, empty));
    expect(p.steps[0].reason).toBe('Policy gradient, Fourth and Fifth need Policy; nothing in your notes on it yet');
    expect(p.steps[1].reason).toBe('Your goal: Policy gradient, and Actor critic needs it; nothing in your notes on it yet');
    expect(p.steps[2].reason).toBe('Your goal: Actor critic; nothing in your notes on it yet');
    expect(planPath(tiny(), ['c'], matchNotes(tiny(), empty)).steps[0].reason).toContain('Policy gradient needs Policy;');
  });
  it('chooses the first known dependent in canonical rather than file or match order', () => {
    const m = tiny();
    m.concepts = [m.concepts[2], m.concepts[1], m.concepts[0]];
    const matches = matchNotes(m, empty, ['Actor critic', 'PG']);
    const p = planPath(m, ['c'], matches);
    expect(p.skipped.find(s => s.conceptId === 'a')?.reason).toBe('assumed: you said you know Policy gradient, which builds on it');
    expect(planPath(m, ['c'], [...matches].reverse())).toEqual(p);
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
