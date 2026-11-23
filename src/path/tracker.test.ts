import { describe, expect, it } from 'vitest';
import { noteSources } from './tracker';

describe('noteSources', () => {
  it('ignores project evidence while retaining and deduplicating note and mention sources', () => {
    const source = { pageId: 'page', blockId: 'block', surface: 'Policy gradient' };
    const mention = { pageId: 'other-page', blockId: 'other-block', surface: 'PPO' };
    expect(noteSources([
      { kind: 'project', projectId: 'rlhf-rlvr-toy' },
      { kind: 'note', noteConceptId: 'policy-gradient', label: 'Policy gradient', provenance: [source] },
      { kind: 'mention', ...source },
      { kind: 'mention', ...mention },
    ])).toEqual([source, mention]);
  });
  it('returns no note sources for project-only or empty evidence', () => {
    expect(noteSources([{ kind: 'project', projectId: 'rlhf-rlvr-toy' }])).toEqual([]);
    expect(noteSources([])).toEqual([]);
  });
});
