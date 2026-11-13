// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DigitalBlock, FigureInfo } from '../model/page';
import { DiagramCard } from './DiagramCard';
import { DigitalView } from './DigitalView';

vi.mock('../transcribe/render', () => ({ renderStrokesToPng: () => null }));

let container: HTMLDivElement, root: Root;
const highlight = vi.fn();
const block = (figure?: Partial<FigureInfo>): DigitalBlock => ({ id: 'demo', kind: 'diagram', text: 'A useful diagram', bbox: { left: 0, top: 0, right: 100, bottom: 100 }, strokeIds: ['s1', 's2'], confidence: 1, ...(figure ? { figure: { kind: 'flowchart', shapes: [], labels: [], edges: [], ...figure } } : {}) });
const render = (b: DigitalBlock) => act(() => root.render(createElement(DiagramCard, { block: b, strokeById: new Map(), onHighlightStrokes: highlight })));
const click = (element: Element) => act(() => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const change = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => act(() => {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
});

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  highlight.mockClear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('DiagramCard', () => {
  it('renders deep and disconnected mind-map descendants and leftover cycle links', () => {
    render(block({ kind: 'mindmap', nodes: [{ id: 'h', label: 'H' }, { id: 'a', label: 'A', parent: 'h' }, { id: 'b', label: 'B', parent: 'a' }, { id: 'c', label: 'C', parent: 'b' }, { id: 'd', label: 'Deep D', parent: 'c' }, { id: 'x', label: 'Orphan X' }, { id: 'y', label: 'Orphan Y', parent: 'x' }], edges: [{ from: 'c', to: 'a', label: 'cycle' }, { from: 'x', to: 'y' }] }));
    expect(container.querySelector('[aria-label="Mind map"]')!.textContent).toContain('Deep D');
    expect(container.querySelector('[aria-label="Mind map"]')!.textContent).toContain('Orphan Y');
    expect(container.querySelector('[aria-label="Links"]')!.textContent).toContain('cycle');
  });
  it('keeps node A unchanged while typing A, Al, Alpha over node B', () => {
    const save = vi.fn();
    const figure = { labels: ['A', 'B'], sequence: ['A', 'B'], nodes: [{ id: 'na', label: 'A' }, { id: 'nb', label: 'B' }], edges: [{ from: 'A', to: 'B' }] };
    act(() => root.render(createElement(DiagramCard, { block: block(figure), strokeById: new Map(), editing: true, onEditFigure: save })));
    const inputs = container.querySelectorAll<HTMLInputElement>('.figure-edit-grid input');
    for (const value of ['A', 'Al', 'Alpha']) change(inputs[1], value);
    expect(inputs[0].value).toBe('A');
    expect(container.textContent).toContain('A → Alpha');
    click(container.querySelector('[type="submit"]')!);
    expect(save.mock.calls[0][0].figure).toMatchObject({ labels: ['A', 'Alpha'], sequence: ['A', 'Alpha'], nodes: [{ id: 'na', label: 'A' }, { id: 'nb', label: 'Alpha' }], edges: [{ from: 'A', to: 'Alpha' }] });
  });
  it('applies simultaneous node-label swaps without cascading and keeps colliding edges identifiable', () => {
    const save = vi.fn();
    const figure = { labels: ['A', 'B'], sequence: ['A', 'B'], nodes: [{ id: 'na', label: 'A' }, { id: 'nb', label: 'B' }], edges: [{ from: 'A', to: 'B' }] };
    act(() => root.render(createElement(DiagramCard, { block: block(figure), strokeById: new Map(), editing: true, onEditFigure: save })));
    const inputs = container.querySelectorAll<HTMLInputElement>('.figure-edit-grid input');
    change(inputs[0], 'B'); change(inputs[1], 'A');
    click(container.querySelector('[type="submit"]')!);
    expect(save.mock.calls[0][0].figure).toMatchObject({ labels: ['B', 'A'], sequence: ['B', 'A'], edges: [{ from: 'B', to: 'A' }] });
    change(inputs[1], 'B');
    click(container.querySelector('[type="submit"]')!);
    expect(save.mock.calls[1][0].figure).toMatchObject({ nodes: [{ id: 'na', label: 'B' }, { id: 'nb', label: 'B' }], edges: [{ from: 'na', to: 'nb' }] });
  });
  it('renders numbered steps and toggles their ink highlight, preserving block selection', () => {
    const select = vi.fn(), edit = vi.fn();
    act(() => root.render(createElement(DigitalView, { blocks: [block({ sequence: ['First', 'Next'] })], strokes: [], selectedBlockId: null, onSelectBlock: select, onEditBlock: edit, onHighlightStrokes: highlight })));
    expect([...container.querySelectorAll('ol .step-number')].map(e => e.textContent)).toEqual(['1', '2']);
    const step = container.querySelector('.card-steps button')!;
    click(step);
    expect(step.getAttribute('aria-pressed')).toBe('true');
    expect(highlight).toHaveBeenLastCalledWith(['s1', 's2']);
    expect(select).toHaveBeenLastCalledWith('demo');
    click(step);
    expect(step.getAttribute('aria-pressed')).toBe('false');
    expect(highlight).toHaveBeenLastCalledWith(null);
    act(() => { step.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(container.querySelector('textarea')).toBeNull();
    expect(edit).not.toHaveBeenCalled();
  });
  it('previews steps for mouse pointers and restores the active selection', () => {
    render(block({ sequence: ['One', 'Two'] }));
    const [first, second] = container.querySelectorAll('.card-steps button');
    click(first);
    for (const type of ['pointerover', 'pointerout']) {
      const event = new MouseEvent(type, { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: 'mouse' });
      act(() => { second.dispatchEvent(event); });
      expect(highlight).toHaveBeenLastCalledWith(['s1', 's2']);
    }
  });
  it('keeps the ink preview and caption correction available on selected blocks', () => {
    act(() => root.render(createElement(DigitalView, { blocks: [block()], strokes: [], selectedBlockId: 'demo', onSelectBlock: vi.fn(), onEditBlock: vi.fn() })));
    const correct = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Correct'))!;
    click(correct);
    expect(container.querySelector('form[aria-label="Edit diagram"]')).not.toBeNull();
    expect(container.querySelector('textarea')?.value).toBe('A useful diagram');
    expect(container.querySelector('.diagram-preview')).not.toBeNull();
  });
  it('renders all nodes with accessible nesting depths and glyphs', () => {
    render(block({ nodes: [{ id: 'a', label: 'System', shape: 'rectangle' }, { id: 'b', label: 'API', parent: 'a', shape: 'rounded' }, { id: 'c', label: 'Store', parent: 'b', shape: 'database' }] }));
    expect(container.querySelector('.card-nodes > ul > li > div')?.textContent).toContain('System');
    expect(container.querySelector('.card-nodes > ul > li > ul > li > div')?.textContent).toContain('API');
    expect(container.querySelector('.card-nodes > ul > li > ul > li > ul > li > div')?.textContent).toContain('Store');
    expect(container.textContent).toContain('⛁');
    expect(container.querySelector('[aria-label="Labels"]')).toBeNull();
  });
  it('uses column and row headers for a table with an empty corner', () => {
    render(block({ kind: 'table', sequence: ['AM', 'PM'], labels: ['AM', 'PM', 'Mon', 'gym'], cells: [['', 'AM', 'PM'], ['Mon', 'gym', 'code'], ['Tue', 'read', 'work']] }));
    expect(container.querySelector('.diagram-summary')!.textContent).toBe('3×3 table');
    expect(container.querySelector('[aria-label="Steps"]')).toBeNull();
    expect(container.querySelector('[aria-label="Labels"]')).toBeNull();
    expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    expect(container.querySelectorAll('th[scope="row"]')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(4);
    expect(container.querySelector('.card-table-scroll')).not.toBeNull();
  });
  it('uses ordinary data cells in the first column when the corner is not empty', () => {
    render(block({ kind: 'table', cells: [['Model', 'Score'], ['A', '70']] }));
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
  });
  it('renders a hub and branches rather than generic links', () => {
    render(block({ kind: 'mindmap', nodes: [{ id: 'h', label: 'Trip' }, { id: 'f', label: 'Flights', parent: 'h' }, { id: 't', label: 'Tickets', parent: 'f' }] }));
    expect(container.querySelector('.mindmap-hub')?.textContent).toBe('Trip');
    expect(container.querySelector('.mindmap-branches')?.textContent).toContain('FlightsTickets');
    expect(container.querySelector('[aria-label="Links"]')).toBeNull();
    expect(container.querySelector('[aria-label="Nodes"]')).toBeNull();
  });
  it('hides repetitive shape names while retaining accessible shape descriptions', () => {
    render(block({ nodes: [{ id: 'a', label: 'A', shape: 'box' }, { id: 'b', label: 'B', shape: 'box' }] }));
    expect(container.querySelectorAll('.card-nodes small')).toHaveLength(0);
    expect(container.querySelector('[aria-label="A, box"]')).not.toBeNull();
    expect(container.querySelector('.card-nodes [title="box"]')).not.toBeNull();
  });
  it('collapses its structured panel and clears ink highlights', () => {
    render(block({ sequence: ['First'] }));
    click(container.querySelector('.card-steps button')!);
    const disclosure = container.querySelector('.diagram-disclosure')!;
    const panel = document.getElementById(disclosure.getAttribute('aria-controls')!)!;
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(highlight).toHaveBeenLastCalledWith(null);
    click(disclosure);
    expect(panel.hasAttribute('hidden')).toBe(false);
  });
  it('shows loop/back badges, line marks and inferred edge titles', () => {
    render(block({ sequence: ['A', 'B'], edges: [{ from: 'B', to: 'A', inferred: true }, { from: 'B', to: 'B' }, { from: 'A', to: 'B', kind: 'line', label: 'same' }] }));
    expect(container.querySelector('.card-links')?.textContent).toContain('↩ back');
    expect(container.querySelector('.card-links')?.textContent).toContain('self-loop');
    expect(container.querySelector('.card-links')?.textContent).toContain('A — B (same)');
    expect(container.querySelector('.link-inferred')?.getAttribute('title')).toBe('from the ink geometry (not read by the model)');
  });
  it('handles legacy figures, empty data and unavailable ink', () => {
    render(block());
    expect(container.textContent).toContain('A useful diagram');
    expect(container.textContent).toContain('Diagram ink not available');
    expect(container.querySelector('.diagram-disclosure')).toBeNull();
    render(block({ labels: ['Legacy label'] }));
    expect(container.querySelector('.chip-label')?.textContent).toBe('Legacy label');
    expect(container.querySelectorAll('.diagram-panel section')).toHaveLength(1);
  });
  it('renames a node across steps and links, then saves the updated figure', () => {
    const b = block({ labels: ['First', 'Next'], sequence: ['First', 'Next'], nodes: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Next' }], edges: [{ from: 'First', to: 'Next', label: 'continue' }] });
    const save = vi.fn();
    act(() => root.render(createElement(DigitalView, { blocks: [b], strokes: [], selectedBlockId: 'demo', onSelectBlock: vi.fn(), onEditBlock: vi.fn(), onEditFigure: save })));
    click(container.querySelector('.block-tools button')!);
    change(container.querySelector('.figure-edit-grid input')!, 'Synapse');
    expect(container.querySelector<HTMLInputElement>('.figure-edit-steps input')!.value).toBe('Synapse');
    expect(container.textContent).toContain('Synapse → Next');
    click(container.querySelector('[type="submit"]')!);
    expect(save).toHaveBeenCalledWith(b, expect.objectContaining({ figure: expect.objectContaining({ labels: ['Synapse', 'Next'], sequence: ['Synapse', 'Next'], edges: [{ from: 'Synapse', to: 'Next', label: 'continue' }] }) }));
    expect(container.querySelector('.figure-editor')).toBeNull();
  });
  it('reorders/removes steps and edits caption, edge labels and table cells', () => {
    const save = vi.fn();
    act(() => root.render(createElement(DiagramCard, { block: block({ sequence: ['One', 'Two', 'Three'], edges: [{ from: 'One', to: 'Two' }], cells: [['Old']] }), strokeById: new Map(), editing: true, onEditFigure: save })));
    click(container.querySelector('[aria-label="Move step 1 down"]')!);
    expect([...container.querySelectorAll<HTMLInputElement>('.figure-edit-steps input')].map(e => e.value)).toEqual(['Two', 'One', 'Three']);
    click(container.querySelector('[aria-label="Remove step 3"]')!);
    change(container.querySelector('textarea')!, 'New caption');
    change(container.querySelector('[aria-label="Link 1 label"]')!, 'ready');
    change(container.querySelector('.figure-edit-cells input')!, 'New cell');
    act(() => { container.querySelector('form')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ text: 'New caption', figure: expect.objectContaining({ sequence: ['Two', 'One'], cells: [['New cell']], edges: [{ from: 'One', to: 'Two', label: 'ready' }] }) }));
  });
  it('cancels with Escape without saving and skips unchanged saves', () => {
    const save = vi.fn(), b = block({ sequence: ['One'] });
    act(() => root.render(createElement(DigitalView, { blocks: [b], strokes: [], selectedBlockId: 'demo', onSelectBlock: vi.fn(), onEditBlock: vi.fn(), onEditFigure: save })));
    click(container.querySelector('.block-tools button')!);
    change(container.querySelector('textarea')!, 'Discard');
    act(() => { container.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(container.querySelector('.figure-editor')).toBeNull();
    expect(save).not.toHaveBeenCalled();
    click(container.querySelector('.block-tools button')!);
    click(container.querySelector('[type="submit"]')!);
    expect(save).not.toHaveBeenCalled();
  });
  it('does not save an unchanged legacy diagram with no figure data', () => {
    const save = vi.fn(), cancel = vi.fn();
    act(() => root.render(createElement(DiagramCard, { block: block(), strokeById: new Map(), editing: true, onEditFigure: save, onCancelEdit: cancel })));
    expect(container.querySelectorAll('fieldset')).toHaveLength(0);
    click(container.querySelector('[type="submit"]')!);
    expect(save).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
