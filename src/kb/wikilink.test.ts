import { describe, expect, it } from 'vitest';
import { conceptForLink, parseWikilink } from './wikilink';
import type { KbGraph } from './model';

describe('wikilinks in the digital view', () => {
  it('shows the alias and targets the concept', () => {
    expect(parseWikilink('[[Generalized Advantage Estimation|GAE]]')).toEqual({ target: 'Generalized Advantage Estimation', shown: 'GAE' });
    expect(parseWikilink('[[PPO]]')).toEqual({ target: 'PPO', shown: 'PPO' });
    expect(parseWikilink('[[PPO|]]')).toEqual({ target: 'PPO', shown: 'PPO' });
  });

  it('resolves a target by label or alias, case-insensitively', () => {
    const graph = { concepts: [{ id: 'c1', label: 'Proximal Policy Optimization', aliases: ['PPO'], provenance: [] }], edges: [] } as unknown as KbGraph;
    expect(conceptForLink(graph, 'ppo')).toBe('c1');
    expect(conceptForLink(graph, 'proximal policy optimization')).toBe('c1');
    expect(conceptForLink(graph, 'Proximal Policy Optimization (PPO)')).toBe('c1');
    expect(conceptForLink(graph, 'TRPO')).toBeNull();
  });

  it('prefers a concept matching the full target over the stripped term', () => {
    const graph = { concepts: [
      { id: 'c1', label: 'Policy', aliases: [], provenance: [] },
      { id: 'c2', label: 'Policy (reinforcement learning)', aliases: [], provenance: [] },
    ], edges: [] } as unknown as KbGraph;
    expect(conceptForLink(graph, 'Policy (reinforcement learning)')).toBe('c2');
  });
});
