// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement, Fragment, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { KbGraph, PageExtraction } from '../kb/model';
import { modelExtractor, mockKbModel } from '../kb/modelExtractor';
import { MemoryKnowledgeStore } from '../kb/store';
import { KbSyncer } from '../kb/sync';
import type { Page } from '../model/page';
import type { PathMaterialsProvider } from '../path/materials';
import type { SubjectMap } from '../path/model';
import { localTrackerStore } from '../path/trackerStore';
import { useLearningPath } from '../path/useLearningPath';
import { LearningPath, WhatNextDrawer } from './LearningPath';

const map: SubjectMap = {
  id: 'test-map', subject: 'Test subject', version: 1, provenance: { status: 'unverified', source: 'test' },
  areas: [{ id: 'basics', label: 'Basics' }, { id: 'goals', label: 'Goals' }],
  concepts: [
    { id: 'gradient', label: 'Gradient basics', aliases: ['slope'], description: 'Read gradients.', prerequisites: [], area: 'basics' },
    { id: 'reward', label: 'Reward models', aliases: [], description: 'Compare rewards.', prerequisites: [], area: 'basics' },
    { id: 'policy', label: 'Policy scores', aliases: [], description: 'Score a policy.', prerequisites: ['gradient'], area: 'basics' },
    { id: 'alignment', label: 'Alignment project', aliases: ['rlx'], description: 'Put it together.', prerequisites: ['reward', 'policy'], area: 'goals' },
  ],
};
const makePage = (id: string, text: string, kind: 'heading' | 'paragraph' = 'heading'): Page => ({
  id, title: `Note: ${id}`, createdAt: 0, updatedAt: 0, strokes: [],
  blocks: [{ id: 'block-1', kind, text, confidence: 1, strokeIds: [], bbox: { left: 0, top: 0, right: 50, bottom: 20 } }],
});
const empty = { graph: { concepts: [], edges: [] } as KbGraph, extractions: [] as PageExtraction[] };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

function setup(materials?: PathMaterialsProvider) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host), store = localTrackerStore(map.id);
  const onStartNotes = vi.fn(), onSource = vi.fn();
  let tracker!: ReturnType<typeof useLearningPath>;
  let snapshot = empty;
  const syncer = new KbSyncer(new MemoryKnowledgeStore(), () => [], { debounceMs: 0, onGraph: (graph, extractions) => { snapshot = { graph, extractions }; } });
  function Harness({ notes, ready, pages, open }: { notes: typeof empty; ready: boolean; pages: Page[]; open: boolean }) {
    const current = useLearningPath(map, notes, ready, store);
    const [drawer, setDrawer] = useState(open);
    useEffect(() => { tracker = current; });
    return createElement(Fragment, null,
      createElement(LearningPath, { map, tracker: current, pages, materials, onSource, onStartNotes }),
      createElement(WhatNextDrawer, { tracker: current, open: drawer, onClose: () => setDrawer(false), onPath: () => setDrawer(false), onStartNotes }));
  }
  const render = ({ ready = true, pages = [] as Page[], open = false, fresh = false } = {}) => act(async () =>
    root.render(createElement(Harness, { notes: ready ? snapshot : empty, ready, pages, open, key: fresh ? 'reload' : 'initial' })));
  const control = (label: string, scope: ParentNode = host) => [...scope.querySelectorAll<HTMLElement>('button,summary')]
    .find(e => (e.getAttribute('aria-label') ?? e.textContent?.trim()) === label)!;
  return { host, render, control, store, onStartNotes, onSource, syncer, get tracker() { return tracker; }, get snapshot() { return snapshot; },
    cleanup: async () => { await act(async () => root.unmount()); host.remove(); } };
}

it('searches goals by alias, preserves provenance warnings, and renders stage and step material slots', async () => {
  const stage = vi.fn(() => ({ project: { href: 'https://example.com/starter', title: 'Starter project' } }));
  const step = vi.fn(() => ({ resources: [{ href: 'https://example.com/read', title: 'Primer' }] }));
  const t = setup({ forStep: step, forStage: stage });
  try {
    await t.render({ open: true });
    expect(t.host.textContent).not.toContain('Unverified subject map');
    const input = t.host.querySelector<HTMLInputElement>('input[type="search"]')!;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { set.call(input, 'rlx'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    const results = t.host.querySelectorAll<HTMLButtonElement>('[aria-label="Goal results"] button');
    expect(results).toHaveLength(1);
    await act(async () => results[0].click());
    expect(t.tracker.plan.goals).toEqual(['alignment']);
    expect(t.host.querySelectorAll('.path-warning')).toHaveLength(2);
    expect(t.host.querySelector('a[href="https://example.com/starter"]')?.textContent).toBe('Starter project');
    expect(t.host.querySelector('a[href="https://example.com/read"]')?.textContent).toBe('Primer');
    expect(t.host.textContent).toContain('No resources listed yet.');
    expect(t.host.textContent).toContain('No project listed yet.');
    expect(step).toHaveBeenCalledWith(map.id, 'alignment');
    expect(stage).toHaveBeenCalledWith(map.id, 'basics');
    const drawer = t.host.querySelector('.path-drawer')!;
    await act(async () => t.control('Start notes', drawer).click());
    expect(t.onStartNotes).toHaveBeenCalledWith('Gradient basics');
    expect(t.tracker.next).toContain('gradient');
    expect(t.tracker.changes.done).toEqual([]);
  } finally { await t.cleanup(); }
});

it('replans after note additions, edits, deletions and proposal acceptance and keeps the checkpoint across remounts', async () => {
  const t = setup();
  const gradient = makePage('gradient-note', 'Gradient basics');
  const reward = makePage('reward-note', 'Reward models can be compared.', 'paragraph');
  t.store.save({ goals: ['alignment'], declared: [], skipped: [], checkpoint: ['gradient'] });
  await t.syncer.seedPages([gradient]);
  try {
    await t.render({ ready: false });
    expect(t.host.textContent).toContain('Checking your notes');
    await t.render({ pages: [gradient] });
    const order = () => t.tracker.plan.steps.map(s => s.conceptId);
    const original = order();
    const source = t.host.querySelector<HTMLButtonElement>('.path-source-list button')!;
    await act(async () => source.click());
    expect(t.onSource).toHaveBeenCalledWith({ pageId: gradient.id, blockId: 'block-1', surface: 'Gradient basics' });
    expect(t.tracker.changes).toEqual({ done: [], lost: [] });

    await t.syncer.extractWith(reward, modelExtractor(mockKbModel(async () =>
      JSON.stringify({ concepts: [{ block: 'block-1', term: 'Reward models' }], edges: [] }))));
    await t.render({ pages: [gradient, reward] });
    expect(t.tracker.matches.get('reward')?.state).toBe('partial');
    expect(t.tracker.changes.done).toEqual([]);
    await t.syncer.review(t.snapshot.graph.proposals![0].id, 'accepted');
    await t.render({ pages: [gradient, reward] });
    expect(t.tracker.changes.done).toEqual(['reward']);
    expect(t.host.textContent).toContain('1 step done from notes since last time');
    expect(order()).toEqual(original);
    await act(async () => t.control('Mark seen').click());

    const policy = makePage('policy-note', 'Policy scores');
    await t.syncer.pageChanged(policy);
    await t.render({ pages: [gradient, reward, policy] });
    expect(t.tracker.next).toEqual(['alignment']);
    expect(t.tracker.changes).toEqual({ done: ['policy'], lost: [] });
    await t.syncer.pageChanged(makePage(policy.id, 'Unrelated heading'));
    await t.syncer.pageDeleted(gradient.id);
    await t.render({ pages: [reward], fresh: true });
    expect(t.tracker.changes).toEqual({ done: [], lost: ['gradient'] });
    expect(t.tracker.next).toEqual(['gradient']);
    expect(order()).toEqual(original);
    await act(async () => { t.tracker.toggle('skipped', 'gradient'); t.tracker.toggle('declared', 'policy'); });
    expect(t.tracker.matches.get('policy')?.evidence).toEqual([]);
    await t.render();
    expect(t.tracker.state).toMatchObject({ goals: ['alignment'], declared: ['policy'], skipped: ['gradient'] });
    await act(async () => t.control('Undo declaration: Policy scores').click());
    expect(t.tracker.next).toEqual([]);
    expect(t.host.textContent).toContain('Restore a skipped prerequisite to continue.');
    await act(async () => t.control('Restore skipped step').click());
    expect(t.tracker.next).toEqual(['gradient']);
  } finally { await t.cleanup(); }
});

it('gives every path and drawer control a 44px target and wraps the tablet layout', async () => {
  const t = setup();
  const style = document.createElement('style');
  style.textContent = readFileSync('src/styles/path.css', 'utf8');
  document.head.append(style);
  t.store.save({ goals: ['alignment'], declared: ['reward'], skipped: [], checkpoint: [] });
  try {
    await t.render({ open: true });
    await act(async () => t.control('Edit goals').click());
    const rules = [...style.sheet!.cssRules].filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
    const targets = t.host.querySelectorAll('.learning-path :is(button,input,select,summary,a), .path-drawer button, .drawer-head button');
    expect(targets.length).toBeGreaterThan(10);
    for (const target of targets) {
      const matching = rules.filter(r => target.matches(r.selectorText));
      for (const axis of ['width', 'height']) expect(matching.some(r => r.style.getPropertyValue(`min-${axis}`) === '44px'), target.outerHTML).toBe(true);
    }
    const prop = (selector: string, name: string) => rules.find(r => r.selectorText.split(',').some(s => s.trim() === selector))?.style.getPropertyValue(name);
    expect(parseFloat(prop('.learning-path', 'min-width') ?? '')).toBe(0);
    expect(prop('.learning-path', 'overflow')).toBe('auto');
    expect(prop('.path-row', 'flex-wrap')).toBe('wrap');
    expect(prop('.path-network-lanes', 'grid-template-columns')).toContain('auto-fit');
  } finally { style.remove(); await t.cleanup(); }
});
