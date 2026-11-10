import { describe, expect, it } from 'vitest';
import { pageToMarkdown } from './markdown';
import type { Page } from '../model/page';

describe('pageToMarkdown', () => {
  it('emits headings, footnotes and diagram embeds in reading order', () => {
    const page: Page = {
      id: 'page_1',
      title: 'RLHF',
      strokes: [],
      createdAt: 0,
      updatedAt: 0,
      blocks: [
        { id: 'd', kind: 'footnote_def', text: 'proximal policy optimisation', marker: '*', bbox: { left: 0, top: 500, right: 10, bottom: 510 }, strokeIds: [], confidence: 1 },
        { id: 'h', kind: 'heading', text: 'PPO step', level: 1, bbox: { left: 0, top: 0, right: 10, bottom: 10 }, strokeIds: [], confidence: 1 },
        { id: 'r', kind: 'footnote_ref', text: 'uses PPO', marker: '*', bbox: { left: 0, top: 50, right: 10, bottom: 60 }, strokeIds: [], confidence: 1 },
        { id: 'g', kind: 'diagram', text: 'policy to reward model', bbox: { left: 0, top: 100, right: 10, bottom: 110 }, strokeIds: [], confidence: 1 },
        {
          id: 'f',
          kind: 'diagram',
          text: 'Shape: two boxes. Labels: policy, reward. Relations: policy → reward.',
          bbox: { left: 0, top: 200, right: 10, bottom: 210 },
          strokeIds: [],
          confidence: 1,
          figure: { kind: 'flowchart', shapes: ['two boxes'], labels: ['policy', 'reward'], edges: [{ from: 'policy', to: 'reward', label: 'scores' }] },
        },
      ],
    };
    const md = pageToMarkdown(page);
    expect(md).toContain('![[page_1/f.png]]\n*Shape: two boxes. Labels: policy, reward. Relations: policy → reward.*\nLabels: `policy`, `reward`\n- policy → reward (scores)\n');
    expect(md).toContain('## PPO step');
    expect(md).toContain('uses PPO[^star]');
    expect(md).toContain('![[page_1/g.png]]');
    expect(md.trimEnd().endsWith('[^star]: proximal policy optimisation')).toBe(true);
    expect(md.indexOf('## PPO step')).toBeLessThan(md.indexOf('![[page_1/g.png]]'));
  });
});
