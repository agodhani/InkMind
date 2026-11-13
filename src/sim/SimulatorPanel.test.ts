// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPage } from '../model/page';
import SimulatorPanel from './SimulatorPanel';
import { SuiteResults } from './SuiteResults';
import { buildScene } from './scenes';
import { expectedBlocks } from './expectedBlocks';
import { diagramMetrics, relationMetrics } from './metrics';
import type { SuiteResult } from './suite';

vi.mock('../transcribe/render', () => ({ renderStrokesToPng: () => null }));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const click = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const getButton = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent === text)!;

describe('simulator tester controls', () => {
  it('populates realistic blocks without asking for a model and has labelled collapsible controls', () => {
    const onSetBlocks = vi.fn(), onTranscribeNow = vi.fn();
    act(() => root.render(createElement(SimulatorPanel, { page: createPage(), viewport: { panX: 0, panY: 0, zoom: 1 }, onViewportChange: vi.fn(), onInjectStrokes: vi.fn(), onClearPage: vi.fn(), onBeforeDraw: vi.fn(), onSetBlocks, onTranscribeNow })));
    expect(container.querySelectorAll('optgroup').length).toBeGreaterThan(1);
    expect(container.querySelector('input[type="range"]')).not.toBeNull();
    click(getButton('Instant + expected blocks'));
    expect(onTranscribeNow).not.toHaveBeenCalled();
    const [blocks, strokes] = onSetBlocks.mock.calls[0];
    expect(blocks[0].figure.nodes.length).toBeGreaterThan(0);
    expect(blocks[0].figure.edges.length).toBeGreaterThan(0);
    expect(blocks[0].strokeIds.every((id: string) => strokes.some((s: { id: string }) => s.id === id))).toBe(true);
    click(container.querySelector('[aria-label="Collapse simulator"]')!);
    expect(container.querySelector('.sim-scroll')).toBeNull();
    expect(container.querySelector('[aria-label="Expand simulator"]')!.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('suite results', () => {
  it('expands scenes, opens the exact result, filters failures and copies', () => {
    const scene = buildScene('flowchart-complex', 1), blocks = expectedBlocks(scene, new Map());
    const good: SuiteResult = { kind: scene.kind, seed: 1, messiness: 'normal', title: scene.title, diagrams: diagramMetrics(scene.figures, blocks), relations: relationMetrics(scene.figures, blocks), seconds: 1 };
    const bad: SuiteResult = { ...good, seed: 2, messiness: 'messy', timedOut: true };
    const onOpen = vi.fn(), onCopy = vi.fn();
    act(() => root.render(createElement(SuiteResults, { results: [good, bad], running: false, copied: false, onOpen, onCopy })));
    expect(container.querySelector('tr.partial')).not.toBeNull();
    click(container.querySelector('button[aria-expanded]')!);
    click(container.querySelector('[aria-label="Open flowchart-complex seed 2 messy"]')!);
    expect(onOpen).toHaveBeenCalledWith(bad);
    click(container.querySelector('input')!);
    expect(container.querySelector('[id="suite-flowchart-complex-1-normal"]')!.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('[id="suite-flowchart-complex-2-messy"]')!.hasAttribute('hidden')).toBe(false);
    click(getButton('Copy as Markdown'));
    expect(onCopy).toHaveBeenCalledOnce();
  });
  it('renders empty results without dividing by zero', () => {
    act(() => root.render(createElement(SuiteResults, { results: [], running: false, copied: false, onOpen: vi.fn(), onCopy: vi.fn() })));
    expect(container.textContent).toContain('No completed scenes.');
    expect(getButton('Copy as Markdown').disabled).toBe(true);
  });
});
