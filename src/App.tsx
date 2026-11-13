import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InkCanvas, type InkTool } from './ink/InkCanvas';
import type { Viewport } from './ink/ViewportManager';
import { useUndoRedoKeyboard } from './ink/useUndoRedo';
import { createPage, newId, type DigitalBlock, type InkStroke, type Page } from './model/page';
import { pagesFromStrokeExport, type StrokeExport } from './model/importStrokes';
import { db, isIndexedDbAvailable } from './store/db';
import { DigitalView } from './views/DigitalView';
import { useTranscription } from './transcribe/useTranscription';
import { OpenRouterTranscriber } from './transcribe/openrouter';
import { OllamaTranscriber } from './transcribe/ollama';
import { MockTranscriber } from './transcribe/mock';
import type { Transcriber } from './transcribe/types';
import { renderStrokesToPng } from './transcribe/render';
import { buildProfile, type Correction } from './profile/handwritingProfile';
import { pageToMarkdown } from './export/markdown';
import { loadSettings, saveSettings, type AppSettings } from './settings';
import { strokesBounds } from './transcribe/regions';
import { Toolbar, type ViewMode } from './ui/Toolbar';
import { PagesDrawer } from './ui/PagesDrawer';
import { SettingsDrawer } from './ui/SettingsDrawer';
import { SplitPane } from './ui/SplitPane';
import { Onboarding } from './ui/Onboarding';
import { dismissOnboarding, shouldShowOnboarding } from './ui/onboarding';
import { useTheme } from './ui/theme';
import { COMPACT_QUERY, useMediaQuery } from './ui/useMediaQuery';
import { isEditableTarget, matchesShortcut, SHORTCUTS } from './ui/shortcuts';
import { stepBrushSize } from './ui/brush';
import { Icon } from './ui/icons';

// Dev-only drawing simulator (src/sim), mounted when the URL has ?sim=1; lazy so it stays out of the main bundle.
const SimulatorPanel = lazy(() => import('./sim/SimulatorPanel'));
const SIM_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('sim');

interface HistoryEntry {
  strokes: InkStroke[];
  blocks: DigitalBlock[];
}

const PROVIDER_LABEL: Record<AppSettings['provider'], string> = { mock: 'Mock transcriber', ollama: 'Ollama', openrouter: 'OpenRouter' };

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [pages, setPages] = useState<Page[]>([]);
  const [page, setPage] = useState<Page | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [view, setView] = useState<ViewMode>(() => (window.innerWidth > 900 ? 'split' : 'ink'));
  const [tool, setTool] = useState<InkTool>('pen');
  const [brushColor, setBrushColor] = useState('#1b1b1f');
  const [brushSize, setBrushSize] = useState(2.5);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [highlightStrokeIds, setHighlightStrokeIds] = useState<string[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [showTips, setShowTips] = useState(() => shouldShowOnboarding());
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ panX: 24, panY: 24, zoom: 1 });
  const [historyLen, setHistoryLen] = useState({ undo: 0, redo: 0 });
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const { pref: themePref, theme, setPref: setThemePref, toggle: toggleTheme } = useTheme();
  const compact = useMediaQuery(COMPACT_QUERY);

  useEffect(() => saveSettings(settings), [settings]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Load pages + corrections once.
  useEffect(() => {
    if (!isIndexedDbAvailable()) return;
    void (async () => {
      const [list, corr] = await Promise.all([db.listPages(), db.listCorrections()]);
      setCorrections(corr);
      if (list.length === 0) {
        const p = createPage('My first page');
        await db.putPage(p);
        setPages([p]);
        setPage(p);
      } else {
        setPages(list);
        setPage(list[0]);
      }
      setLoaded(true);
    })();
  }, []);

  const persist = useRef<number | null>(null);
  const updatePage = useCallback((pageId: string, fn: (p: Page) => Page) => {
    setPage((prev) => {
      if (!prev || prev.id !== pageId) return prev;
      const next = { ...fn(prev), updatedAt: Date.now() };
      if (persist.current) window.clearTimeout(persist.current);
      persist.current = window.setTimeout(() => {
        void db.putPage(next);
        setPages((list) => list.map((p) => (p.id === next.id ? next : p)).sort((a, b) => b.updatedAt - a.updatedAt));
      }, 400);
      return next;
    });
  }, []);

  const transcriber: Transcriber = useMemo(() => {
    if (settings.provider === 'openrouter' && settings.openRouterApiKey) {
      return new OpenRouterTranscriber({ apiKey: settings.openRouterApiKey, model: settings.visionModel, siteName: 'InkMind' });
    }
    if (settings.provider === 'ollama') return new OllamaTranscriber({ url: settings.ollamaUrl, model: settings.ollamaModel });
    return new MockTranscriber();
  }, [settings.provider, settings.openRouterApiKey, settings.visionModel, settings.ollamaUrl, settings.ollamaModel]);
  const profile = useMemo(() => buildProfile(corrections, { habits: settings.habits, glossary: settings.glossary }), [corrections, settings.habits, settings.glossary]);

  const onBlocks = useCallback(
    (pageId: string, update: (blocks: DigitalBlock[]) => DigitalBlock[]) => updatePage(pageId, (p) => ({ ...p, blocks: update(p.blocks) })),
    [updatePage],
  );
  const { status, markStrokesDirty, markStrokesDeleted, retranscribeAll, flushNow } = useTranscription({
    page,
    transcriber,
    profile,
    enabled: settings.liveTranscription,
    scope: settings.scope,
    onBlocks,
  });

  const syncHistoryLen = () => setHistoryLen({ undo: undoStack.current.length, redo: redoStack.current.length });
  const pushHistory = useCallback((p: Page) => {
    undoStack.current.push({ strokes: p.strokes, blocks: p.blocks });
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    syncHistoryLen();
  }, []);
  const resetHistory = () => {
    undoStack.current = [];
    redoStack.current = [];
    syncHistoryLen();
  };

  const onStrokeComplete = useCallback(
    (stroke: InkStroke) => {
      if (!page) return;
      pushHistory(page);
      updatePage(page.id, (p) => ({ ...p, strokes: [...p.strokes, stroke] }));
      markStrokesDirty([stroke]);
    },
    [page, pushHistory, updatePage, markStrokesDirty],
  );

  const onSimInject = useCallback(
    (strokes: InkStroke[]) => {
      if (!page || strokes.length === 0) return;
      pushHistory(page);
      updatePage(page.id, (p) => ({ ...p, strokes: [...p.strokes, ...strokes] }));
      markStrokesDirty(strokes);
    },
    [page, pushHistory, updatePage, markStrokesDirty],
  );

  const onSimClear = useCallback(() => {
    if (!page) return;
    pushHistory(page);
    const ids = page.strokes.map((s) => s.id);
    updatePage(page.id, (p) => ({ ...p, strokes: [], blocks: [] }));
    if (ids.length) markStrokesDeleted(ids);
  }, [page, pushHistory, updatePage, markStrokesDeleted]);

  const onStrokesErased = useCallback(
    (ids: string[]) => {
      if (!page) return;
      pushHistory(page);
      const gone = new Set(ids);
      updatePage(page.id, (p) => ({
        ...p,
        strokes: p.strokes.filter((s) => !gone.has(s.id)),
        blocks: p.blocks.map((b) => ({ ...b, strokeIds: b.strokeIds.filter((id) => !gone.has(id)) })),
      }));
      markStrokesDeleted(ids);
    },
    [page, pushHistory, updatePage, markStrokesDeleted],
  );

  const applyHistory = useCallback(
    (current: Page, entry: HistoryEntry) => {
      const before = new Set(current.strokes.map((s) => s.id));
      const after = new Set(entry.strokes.map((s) => s.id));
      const added = entry.strokes.filter((s) => !before.has(s.id));
      const removed = [...before].filter((id) => !after.has(id));
      updatePage(current.id, (p) => ({ ...p, strokes: entry.strokes, blocks: entry.blocks }));
      if (added.length) markStrokesDirty(added);
      if (removed.length) markStrokesDeleted(removed);
    },
    [updatePage, markStrokesDirty, markStrokesDeleted],
  );

  const undo = useCallback(() => {
    if (!page) return;
    const entry = undoStack.current.pop();
    if (!entry) return;
    redoStack.current.push({ strokes: page.strokes, blocks: page.blocks });
    syncHistoryLen();
    applyHistory(page, entry);
  }, [page, applyHistory]);

  const redo = useCallback(() => {
    if (!page) return;
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push({ strokes: page.strokes, blocks: page.blocks });
    syncHistoryLen();
    applyHistory(page, entry);
  }, [page, applyHistory]);

  useUndoRedoKeyboard(undo, redo, true);

  const onEditBlock = useCallback(
    (block: DigitalBlock, newText: string) => {
      if (!page) return;
      const strokes = page.strokes.filter((s) => block.strokeIds.includes(s.id));
      const bounds = strokesBounds(strokes) ?? block.bbox;
      const crop = strokes.length ? renderStrokesToPng(strokes, bounds, { maxEdge: 700 }) : null;
      const correction: Correction = {
        id: newId('corr'),
        pageId: page.id,
        blockId: block.id,
        imageDataUrl: crop?.dataUrl ?? '',
        modelText: block.text,
        userText: newText,
        createdAt: Date.now(),
      };
      if (!block.userEdited || block.text !== newText) {
        setCorrections((c) => [...c, correction]);
        void db.putCorrection(correction);
        setToast({ text: 'Correction saved to your handwriting profile.' });
      }
      updatePage(page.id, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === block.id ? { ...b, text: newText, userEdited: true, confidence: 1 } : b)) }));
    },
    [page, updatePage],
  );

  const linkedBlockId = hoveredBlockId ?? selectedBlockId;
  const linkedBlock = page?.blocks.find((b) => b.id === linkedBlockId) ?? null;
  const highlighted = useMemo(() => new Set(highlightStrokeIds ?? linkedBlock?.strokeIds ?? []), [highlightStrokeIds, linkedBlock]);
  const outlines = useMemo(() => page?.blocks.map((b) => ({ bbox: b.bbox, active: b.id === linkedBlockId })) ?? [], [page?.blocks, linkedBlockId]);

  const onTapStroke = useCallback(
    (strokeId: string | null) => {
      if (!page) return;
      const blk = strokeId ? page.blocks.find((b) => b.strokeIds.includes(strokeId)) : null;
      setSelectedBlockId(blk?.id ?? null);
    },
    [page],
  );

  const openPage = (p: Page) => {
    setPage(p);
    setSelectedBlockId(null);
    setHoveredBlockId(null);
    resetHistory();
    setShowPages(false);
  };

  const newPage = async () => {
    const p = createPage(`Page ${pages.length + 1}`);
    await db.putPage(p);
    setPages((l) => [p, ...l]);
    openPage(p);
  };

  const importStrokes = async (file: File) => {
    let imported: Page[];
    try {
      imported = pagesFromStrokeExport(JSON.parse(await file.text()) as StrokeExport, file.name);
    } catch (e) {
      setToast({ text: `Could not read ${file.name}: ${(e as Error).message}` });
      return;
    }
    if (!imported.length) {
      setToast({ text: 'No strokes found in that file.' });
      return;
    }
    for (const p of imported) await db.putPage(p);
    setPages((l) => [...imported, ...l]);
    openPage(imported[0]);
    setToast({ text: `Imported ${imported.length === 1 ? '1 page' : `${imported.length} pages`}.` });
  };

  const renamePage = (id: string, title: string) => {
    if (page?.id === id) updatePage(id, (p) => ({ ...p, title }));
    else {
      setPages((list) => {
        const target = list.find((p) => p.id === id);
        if (target) void db.putPage({ ...target, title, updatedAt: Date.now() });
        return list.map((p) => (p.id === id ? { ...p, title, updatedAt: Date.now() } : p));
      });
    }
  };

  const deletePage = async (p: Page) => {
    if (!window.confirm(`Delete “${p.title || 'Untitled'}”? Its ink and transcription are removed from this browser.`)) return;
    await db.deletePage(p.id);
    const rest = pages.filter((x) => x.id !== p.id);
    setPages(rest);
    if (page?.id === p.id) {
      setPage(rest[0] ?? null);
      setSelectedBlockId(null);
      resetHistory();
    }
  };

  const exportMarkdown = () => {
    if (!page) return;
    const blob = new Blob([pageToMarkdown(page)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${page.title.replace(/[^\w\- ]+/g, '').trim() || 'page'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast({ text: `Exported ${a.download}` });
  };

  const transcribeNow = useCallback(() => void flushNow(), [flushNow]);
  const retranscribe = () => {
    if (!page?.strokes.length) return;
    if (window.confirm('Discard the digital page and transcribe everything again? Your corrections are kept as examples.')) retranscribeAll();
  };

  // Global shortcuts (single letters are ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (showTips) return;
      const typing = isEditableTarget(e.target);
      const fire = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (matchesShortcut(e, SHORTCUTS.settings)) return fire(() => setShowSettings((v) => !v));
      if (matchesShortcut(e, SHORTCUTS.pages)) return fire(() => setShowPages((v) => !v));
      if (matchesShortcut(e, SHORTCUTS.toggleTheme)) return fire(toggleTheme);
      if (matchesShortcut(e, SHORTCUTS.transcribe) && !typing) return fire(transcribeNow);
      if (typing || showSettings || showPages) return;
      if (matchesShortcut(e, SHORTCUTS.pen)) return fire(() => setTool('pen'));
      if (matchesShortcut(e, SHORTCUTS.eraser)) return fire(() => setTool('eraser'));
      if (matchesShortcut(e, SHORTCUTS.pan)) return fire(() => setTool('pan'));
      if (matchesShortcut(e, SHORTCUTS.viewInk)) return fire(() => setView('ink'));
      if (matchesShortcut(e, SHORTCUTS.viewSplit)) return fire(() => setView('split'));
      if (matchesShortcut(e, SHORTCUTS.viewDigital)) return fire(() => setView('digital'));
      if (matchesShortcut(e, SHORTCUTS.smaller)) return fire(() => setBrushSize((s) => stepBrushSize(s, -1)));
      if (matchesShortcut(e, SHORTCUTS.larger)) return fire(() => setBrushSize((s) => stepBrushSize(s, 1)));
      if (matchesShortcut(e, SHORTCUTS.escape) && selectedBlockId) return fire(() => setSelectedBlockId(null));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTips, showSettings, showPages, selectedBlockId, toggleTheme, transcribeNow]);

  const closeTips = () => {
    dismissOnboarding();
    setShowTips(false);
  };

  if (!loaded && !page) {
    return (
      <div className="app-loading" role="status">
        {isIndexedDbAvailable() ? (
          <>
            <Icon name="spinner" /> Loading your pages…
          </>
        ) : (
          'This browser has no IndexedDB; InkMind needs it to store pages.'
        )}
      </div>
    );
  }

  const inkPane = page && (
    <InkCanvas
      strokes={page.strokes}
      tool={tool}
      brushColor={brushColor}
      brushSize={brushSize}
      highlightedStrokeIds={highlighted}
      outlines={outlines}
      onStrokeComplete={onStrokeComplete}
      onStrokesErased={onStrokesErased}
      onTapStroke={onTapStroke}
      viewport={viewport}
      onViewportChange={setViewport}
    />
  );
  const digitalPane = page && (
    <DigitalView
      blocks={page.blocks}
      strokes={page.strokes}
      selectedBlockId={selectedBlockId}
      onSelectBlock={setSelectedBlockId}
      onHoverBlock={setHoveredBlockId}
      onHighlightStrokes={setHighlightStrokeIds}
      onEditBlock={onEditBlock}
      emptyHint={
        page.strokes.length === 0
          ? 'Write on the ink page. Pause for a second and the digital version appears here.'
          : settings.liveTranscription
            ? status.state === 'error'
              ? 'The last transcription failed. Use Retry in the status pill or Transcribe now.'
              : 'Waiting for the model… pause the pen and the text will appear here.'
            : 'Live transcription is off. Use Transcribe now (Ctrl+Enter) or turn it on in Settings.'
      }
    />
  );
  const zoomChip = page && view !== 'digital' && (
    <div className="zoom-chip" aria-label="Zoom">
      <button type="button" onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.25, v.zoom / 1.25) }))} aria-label="Zoom out">
        −
      </button>
      <button type="button" onClick={() => setViewport({ panX: 24, panY: 24, zoom: 1 })} aria-label="Reset zoom" data-tip="Reset view" data-tip-placement="top">
        {Math.round(viewport.zoom * 100)}%
      </button>
      <button type="button" onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(8, v.zoom * 1.25) }))} aria-label="Zoom in">
        +
      </button>
    </div>
  );

  return (
    <div className="app" data-view={view}>
      <Toolbar
        title={page?.title ?? ''}
        onTitle={(t) => page && updatePage(page.id, (p) => ({ ...p, title: t }))}
        view={view}
        onView={setView}
        tool={tool}
        onTool={setTool}
        brushColor={brushColor}
        brushSize={brushSize}
        onBrushColor={setBrushColor}
        onBrushSize={setBrushSize}
        canUndo={historyLen.undo > 0}
        canRedo={historyLen.redo > 0}
        onUndo={undo}
        onRedo={redo}
        status={status}
        live={settings.liveTranscription}
        providerLabel={PROVIDER_LABEL[transcriber.name === 'mock' ? 'mock' : settings.provider]}
        onTranscribeNow={transcribeNow}
        onRetranscribeAll={retranscribe}
        onExport={exportMarkdown}
        onOpenPages={() => setShowPages(true)}
        onOpenSettings={() => setShowSettings(true)}
        onShowTips={() => setShowTips(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        compact={compact}
      />

      {transcriber.name === 'mock' && (
        <div className="banner" role="note">
          <Icon name="info" size={18} />
          <span className="banner-text">
            <strong>Mock transcriber</strong> — placeholder text so you can try the ink ↔ digital flow. Pick a free local Ollama model or an OpenRouter <code>:free</code> model for real transcription.
          </span>
          <button type="button" className="btn" onClick={() => setShowSettings(true)}>
            Choose model
          </button>
        </div>
      )}

      <main className="workspace">
        {!page ? (
          <div className="workspace-empty">
            <div className="card empty">
              <div className="empty-art">
                <Icon name="pen" size={28} />
              </div>
              <h3>No pages yet</h3>
              <p>Start a blank page, or import strokes extracted from a PDF with scripts/pdf_to_strokes.py.</p>
              <div className="empty-actions">
                <button type="button" className="btn tone-primary" onClick={() => void newPage()}>
                  <Icon name="plus" size={16} /> New page
                </button>
                <label className="btn">
                  <Icon name="upload" size={16} /> Import strokes
                  <input type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => e.target.files?.[0] && void importStrokes(e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>
        ) : view === 'split' ? (
          <SplitPane
            vertical={compact}
            a={
              <>
                <span className="pane-label">Ink</span>
                {inkPane}
                {zoomChip}
              </>
            }
            b={
              <>
                <span className="pane-label">Digital</span>
                {digitalPane}
              </>
            }
          />
        ) : view === 'ink' ? (
          <section className="pane single ink-pane" aria-label="Ink">
            {inkPane}
            {zoomChip}
          </section>
        ) : (
          <section className="pane single digital-pane" aria-label="Digital">
            {digitalPane}
          </section>
        )}
      </main>

      {SIM_ENABLED && page && (
        <Suspense fallback={null}>
          <SimulatorPanel page={page} viewport={viewport} onViewportChange={setViewport} onInjectStrokes={onSimInject} onClearPage={onSimClear} onTranscribeNow={transcribeNow} onBeforeDraw={() => setTool('pen')} transcriptionState={status.state} />
        </Suspense>
      )}

      <PagesDrawer open={showPages} pages={pages} currentId={page?.id ?? null} onClose={() => setShowPages(false)} onOpen={openPage} onNew={() => void newPage()} onImport={(f) => void importStrokes(f)} onRename={renamePage} onDelete={(p) => void deletePage(p)} />

      <SettingsDrawer
        open={showSettings}
        settings={settings}
        corrections={corrections}
        themePref={themePref}
        onThemePref={setThemePref}
        onChange={setSettings}
        onClose={() => setShowSettings(false)}
        onClearCorrections={async () => {
          await db.clearCorrections();
          setCorrections([]);
        }}
        onShowTips={() => {
          setShowSettings(false);
          setShowTips(true);
        }}
      />

      {showTips && (
        <Onboarding
          onClose={closeTips}
          onChooseModel={() => {
            closeTips();
            setShowSettings(true);
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" onClick={() => (toast.action!.run(), setToast(null))}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
