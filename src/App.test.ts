// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { ToolbarProps } from './ui/Toolbar';
import type { PagesDrawerProps } from './ui/PagesDrawer';
import type { KbGraph } from './kb/model';
import { deleteConcept, emptyDecisions } from './kb/decisions';
import * as vault from './export/vault';
import { createPage } from './model/page';
import { db } from './store/db';
import { PagePersistence } from './store/pagePersistence';
import { stroke } from './__tests__/helpers';
import App from './App';

const controls = vi.hoisted(() => ({
  toolbar: null as ToolbarProps | null, drawer: null as PagesDrawerProps | null,
  rawGraph: { concepts: [], edges: [] } as KbGraph,
  decisions: { renames: [], merges: [], deletes: [], rejected: [] } as ReturnType<typeof emptyDecisions>,
}));
vi.mock('./ui/Toolbar', () => ({ Toolbar: (props: ToolbarProps) => { controls.toolbar = props; return null; } }));
vi.mock('./ui/PagesDrawer', () => ({ PagesDrawer: (props: PagesDrawerProps) => { controls.drawer = props; return null; } }));
vi.mock('./ink/InkCanvas', () => ({ InkCanvas: () => null }));
vi.mock('./views/DigitalView', () => ({ DigitalView: () => null }));
vi.mock('./ui/SettingsDrawer', () => ({ SettingsDrawer: () => null }));
vi.mock('./ui/Onboarding', () => ({ Onboarding: () => null }));
vi.mock('./transcribe/useTranscription', () => ({ useTranscription: () => ({ status: { state: 'idle' } }) }));
vi.mock('./kb/useKnowledgeBase', () => ({ useKnowledgeBase: () => ({
  graph: { concepts: [], edges: [] }, rawGraph: controls.rawGraph, decisions: controls.decisions,
  extractions: [], ready: true,
  pageChanged: vi.fn(), pageEdited: vi.fn(), pageDeleted: vi.fn(),
}) }));
vi.mock('./store/db', () => ({
  isIndexedDbAvailable: () => true,
  openDb: () => new Promise(() => {}),
  db: { listPages: vi.fn(), listCorrections: vi.fn(async () => []), putPage: vi.fn(), deletePage: vi.fn() },
}));

it('keeps an inactive rename after a failed deletion recovers the latest saved snapshot', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const active = { ...createPage('Active'), updatedAt: 2 }, inactive = { ...createPage('Inactive'), updatedAt: 1 };
  const stored = new Map([[active.id, active], [inactive.id, inactive]]);
  vi.mocked(db.listPages).mockResolvedValue([active, inactive]);
  vi.mocked(db.putPage).mockImplementation(async page => { stored.set(page.id, page); return page.id; });
  vi.mocked(db.deletePage).mockRejectedValue(new Error('Delete failed'));
  const host = document.createElement('div'), root = createRoot(host);
  const flush = () => act(async () => { window.dispatchEvent(new Event('pagehide')); });
  try {
    await act(async () => root.render(createElement(App)));
    await act(async () => controls.drawer!.onOpen(inactive));
    await act(async () => controls.toolbar!.onTitle('Cached title'));
    await flush();
    await act(async () => controls.drawer!.onOpen(active));
    await act(async () => controls.drawer!.onRename(inactive.id, 'New title'));
    await flush();
    expect(stored.get(inactive.id)?.title).toBe('New title');
    await act(async () => controls.drawer!.onDelete(controls.drawer!.pages.find(p => p.id === inactive.id)!));
    await flush();
    expect(stored.get(inactive.id)?.title).toBe('New title');
    expect(controls.drawer!.pages.find(p => p.id === inactive.id)?.title).toBe('New title');
    expect(controls.drawer!.currentId).toBe(active.id);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Could not delete page: Delete failed');
  } finally {
    await act(async () => root.unmount());
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});

it('routes first-page creation, new pages and imports through persistence', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const replace = vi.spyOn(PagePersistence.prototype, 'replace'), stored = new Map<string, ReturnType<typeof createPage>>();
  vi.mocked(db.listPages).mockResolvedValue([]);
  vi.mocked(db.putPage).mockImplementation(async page => { stored.set(page.id, page); return page.id; });
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(App)));
    expect(controls.drawer!.pages.map(p => p.title)).toEqual(['My first page']);
    await act(async () => controls.drawer!.onNew());
    const file = { name: 'Notes.json', text: async () => JSON.stringify({ strokes: [stroke(0, 0, 1, 1)] }) } as File;
    await act(async () => controls.drawer!.onImport(file));
    expect(stored.size).toBe(3);
    expect(controls.drawer!.pages.map(p => p.title)).toEqual(['Notes', 'Page 2', 'My first page']);
    expect(replace.mock.calls.map(([p]) => p.id).sort()).toEqual([...stored.keys()].sort());
  } finally {
    await act(async () => root.unmount());
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});

it('exports the raw graph and deletion decisions rather than losing deleted targets in the displayed graph', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:vault');
    static revokeObjectURL = vi.fn();
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const build = vi.spyOn(vault, 'buildVault'), page = createPage('Export');
  controls.rawGraph = { concepts: [{ id: 'deleted', label: 'actor-critic', aliases: ['AC'], provenance: [] }], edges: [] };
  controls.decisions = deleteConcept(emptyDecisions(), 'actor-critic');
  vi.mocked(db.listPages).mockResolvedValue([page]);
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(App)));
    await act(async () => controls.toolbar!.onExportVault());
    expect(build).toHaveBeenCalledWith([page], controls.rawGraph, controls.decisions);
  } finally {
    await act(async () => root.unmount());
    controls.rawGraph = { concepts: [], edges: [] }; controls.decisions = emptyDecisions();
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});
