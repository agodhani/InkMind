// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PageConcepts } from './PageConcepts';
import { createPage } from '../model/page';
import { largeDemoPages } from '../sim/kbDemo';
import { emptyDecisions } from '../kb/decisions';
import { suggestLinks } from '../kb/suggest';

it('previews and accepts the same plain occurrence rather than a linked target or display', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const page = createPage('PPO');
  page.blocks = [{ ...largeDemoPages(1)[0].blocks[0], text: '[[policy ratio]] and [[Other|policy]] then policy.' }];
  const graph = { concepts: [{ id: 'policy', label: 'Policy', aliases: [], provenance: [{ pageId: 'source', blockId: 'b', strokeIds: [], surface: 'Policy', extractor: 'test' }] }], edges: [] };
  const suggestion = suggestLinks(page, graph, emptyDecisions())[0];
  const host = document.createElement('div'), root = createRoot(host), onAccept = vi.fn();
  document.body.append(host);
  try {
    await act(async () => root.render(createElement(PageConcepts, { page, pages: [page], graph, decisions: emptyDecisions(), decide: vi.fn(), review: vi.fn(), onMap: vi.fn(), onSource: vi.fn(), onAccept, onClose: vi.fn() })));
    const preview = document.querySelector('.kb-suggestion p')!;
    expect(preview.querySelector('mark')!.previousSibling?.textContent).toBe('[[policy ratio]] and [[Other|policy]] then ');
    expect(suggestion).toMatchObject({ start: page.blocks[0].text.lastIndexOf('policy'), end: page.blocks[0].text.lastIndexOf('policy') + 6 });
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>('.kb-suggestion button')].find(b => b.textContent === 'Accept link')!.click());
    expect(onAccept).toHaveBeenCalledWith(page.blocks[0], '[[policy ratio]] and [[Other|policy]] then [[Policy]].');
    page.blocks[0].text = '[[policy ratio]] [[Other|policy]]';
    expect(suggestLinks(page, graph, emptyDecisions())).toEqual([]);
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
