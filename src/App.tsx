import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InkCanvas, type InkTool } from './ink/InkCanvas';
import type { Viewport } from './ink/ViewportManager';
import { useUndoRedoKeyboard } from './ink/useUndoRedo';
import { createPage, newId, type DigitalBlock, type InkStroke, type Page } from './model/page';
import { pagesFromStrokeExport, type StrokeExport } from './model/importStrokes';
import { db, isIndexedDbAvailable } from './store/db';
import { DigitalView } from './views/DigitalView';
import { useTranscription } from './transcribe/useTranscription';
import { OpenRouterTranscriber } from './transcribe/openrouter';
import { DEFAULT_OLLAMA_MODEL, OLLAMA_VISION_MODELS, OllamaTranscriber, probeOllama, type OllamaStatus } from './transcribe/ollama';

const OLLAMA_REPROBE_MS = 5000;
import { MockTranscriber } from './transcribe/mock';
import type { Transcriber } from './transcribe/types';
import { renderStrokesToPng } from './transcribe/render';
import { buildProfile, type Correction } from './profile/handwritingProfile';
import { pageToMarkdown } from './export/markdown';
import { loadSettings, saveSettings, type AppSettings } from './settings';
import { strokesBounds } from './transcribe/regions';

type ViewMode = 'ink' | 'digital' | 'split';

interface HistoryEntry {
  strokes: InkStroke[];
  blocks: DigitalBlock[];
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [pages, setPages] = useState<Page[]>([]);
  const [page, setPage] = useState<Page | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [view, setView] = useState<ViewMode>(() => (window.innerWidth > 900 ? 'split' : 'ink'));
  const [tool, setTool] = useState<InkTool>('pen');
  const [brushColor, setBrushColor] = useState('#1b1b1f');
  const [brushSize, setBrushSize] = useState(2.5);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ panX: 24, panY: 24, zoom: 1 });
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);

  useEffect(() => saveSettings(settings), [settings]);

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

  const pushHistory = useCallback((p: Page) => {
    undoStack.current.push({ strokes: p.strokes, blocks: p.blocks });
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const onStrokeComplete = useCallback(
    (stroke: InkStroke) => {
      if (!page) return;
      pushHistory(page);
      updatePage(page.id, (p) => ({ ...p, strokes: [...p.strokes, stroke] }));
      markStrokesDirty([stroke]);
    },
    [page, pushHistory, updatePage, markStrokesDirty],
  );

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
    applyHistory(page, entry);
  }, [page, applyHistory]);

  const redo = useCallback(() => {
    if (!page) return;
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push({ strokes: page.strokes, blocks: page.blocks });
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
      }
      updatePage(page.id, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === block.id ? { ...b, text: newText, userEdited: true, confidence: 1 } : b)) }));
    },
    [page, updatePage],
  );

  const selectedBlock = page?.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const highlighted = useMemo(() => new Set(selectedBlock?.strokeIds ?? []), [selectedBlock]);
  const outlines = useMemo(() => page?.blocks.map((b) => ({ bbox: b.bbox, active: b.id === selectedBlockId })) ?? [], [page?.blocks, selectedBlockId]);

  const onTapStroke = useCallback(
    (strokeId: string | null) => {
      if (!page) return;
      const blk = strokeId ? page.blocks.find((b) => b.strokeIds.includes(strokeId)) : null;
      setSelectedBlockId(blk?.id ?? null);
    },
    [page],
  );

  const newPage = async () => {
    const p = createPage(`Page ${pages.length + 1}`);
    await db.putPage(p);
    setPages((l) => [p, ...l]);
    setPage(p);
    setSelectedBlockId(null);
    undoStack.current = [];
    redoStack.current = [];
    setShowPages(false);
  };

  const importStrokes = async (file: File) => {
    let imported: Page[];
    try {
      imported = pagesFromStrokeExport(JSON.parse(await file.text()) as StrokeExport, file.name);
    } catch (e) {
      window.alert(`Could not read ${file.name}: ${(e as Error).message}`);
      return;
    }
    if (!imported.length) {
      window.alert('No strokes found in that file.');
      return;
    }
    for (const p of imported) await db.putPage(p);
    setPages((l) => [...imported, ...l]);
    openPage(imported[0]);
  };

  const openPage = (p: Page) => {
    setPage(p);
    setSelectedBlockId(null);
    undoStack.current = [];
    redoStack.current = [];
    setShowPages(false);
  };

  const deletePage = async (p: Page) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await db.deletePage(p.id);
    const rest = pages.filter((x) => x.id !== p.id);
    setPages(rest);
    if (page?.id === p.id) setPage(rest[0] ?? null);
  };

  const exportMarkdown = () => {
    if (!page) return;
    const blob = new Blob([pageToMarkdown(page)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${page.title.replace(/[^\w\- ]+/g, '').trim() || 'page'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!page) {
    return <div className="app-loading">{isIndexedDbAvailable() ? 'Loading…' : 'This browser has no IndexedDB; InkMind needs it to store pages.'}</div>;
  }

  const statusLabel =
    status.state === 'running'
      ? `Transcribing ${status.pendingRegions} region${status.pendingRegions === 1 ? '' : 's'}…`
      : status.state === 'waiting'
        ? 'Waiting for pen to pause…'
        : status.state === 'error'
          ? `Error: ${status.lastError}`
          : settings.liveTranscription
            ? `Up to date${status.lastModel ? ` · ${status.lastModel}` : ''}`
            : 'Live transcription off';

  return (
    <div className="app">
      <header className="toolbar">
        <button className="icon" onClick={() => setShowPages((v) => !v)} title="Pages">
          ☰
        </button>
        <input className="title" value={page.title} onChange={(e) => updatePage(page.id, (p) => ({ ...p, title: e.target.value }))} />
        <div className="seg">
          {(['ink', 'split', 'digital'] as ViewMode[]).map((m) => (
            <button key={m} className={view === m ? 'active' : ''} onClick={() => setView(m)}>
              {m === 'ink' ? 'Ink' : m === 'digital' ? 'Digital' : 'Split'}
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')} title="Pen">
            ✎
          </button>
          <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')} title="Eraser">
            ◻
          </button>
          <button className={tool === 'pan' ? 'active' : ''} onClick={() => setTool('pan')} title="Pan">
            ✋
          </button>
        </div>
        <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} title="Ink colour" />
        <input type="range" min={1} max={8} step={0.5} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} title="Pen size" />
        <button className="icon" onClick={undo} title="Undo (Ctrl+Z)">
          ↶
        </button>
        <button className="icon" onClick={redo} title="Redo (Ctrl+Shift+Z)">
          ↷
        </button>
        <span className="spacer" />
        <span className={`status ${status.state}`}>{statusLabel}</span>
        <button onClick={() => void flushNow()} title="Transcribe pending ink now">
          Transcribe now
        </button>
        <button onClick={retranscribeAll} title="Discard the digital page and transcribe everything again">
          Redo all
        </button>
        <button onClick={exportMarkdown} title="Download as Markdown">
          Export .md
        </button>
        <button className="icon" onClick={() => setShowSettings(true)} title="Settings">
          ⚙
        </button>
      </header>

      {transcriber.name === 'mock' && (
        <div className="banner">
          Running the <strong>mock</strong> transcriber (placeholder text, so you can try the ink ↔ digital flow). Pick a local Ollama model or add an OpenRouter key to get real transcription.{' '}
          <button onClick={() => setShowSettings(true)}>Choose transcriber</button>
        </div>
      )}

      <main className={`workspace view-${view}`}>
        {view !== 'digital' && (
          <section className="pane ink-pane">
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
          </section>
        )}
        {view !== 'ink' && (
          <section className="pane digital-pane">
            <DigitalView
              blocks={page.blocks}
              strokes={page.strokes}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onEditBlock={onEditBlock}
              emptyHint={settings.liveTranscription ? 'Write on the ink page; pause for a second and the digital version appears here.' : 'Live transcription is off. Use "Transcribe now".'}
            />
          </section>
        )}
      </main>

      {showPages && (
        <aside className="drawer" onClick={() => setShowPages(false)}>
          <div className="drawer-body" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <strong>Pages</strong>
              <span className="row-actions">
                <label className="button" title="Import strokes exported with scripts/pdf_to_strokes.py">
                  Import…
                  <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void importStrokes(e.target.files[0])} />
                </label>
                <button onClick={() => void newPage()}>+ New page</button>
              </span>
            </div>
            {pages.map((p) => (
              <div key={p.id} className={`page-row ${p.id === page.id ? 'active' : ''}`}>
                <button className="page-open" onClick={() => openPage(p)}>
                  <span>{p.title || 'Untitled'}</span>
                  <small>
                    {p.strokes.length} strokes · {p.blocks.length} blocks · {new Date(p.updatedAt).toLocaleString()}
                  </small>
                </button>
                <button className="icon" onClick={() => void deletePage(p)} title="Delete">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          corrections={corrections}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
          onClearCorrections={async () => {
            await db.clearCorrections();
            setCorrections([]);
          }}
        />
      )}
    </div>
  );
}

function SettingsPanel({
  settings,
  corrections,
  onChange,
  onClose,
  onClearCorrections,
}: {
  settings: AppSettings;
  corrections: Correction[];
  onChange: (s: AppSettings) => void;
  onClose: () => void;
  onClearCorrections: () => Promise<void>;
}) {
  const [habits, setHabits] = useState(settings.habits.join('\n'));
  const [glossary, setGlossary] = useState(settings.glossary.join(', '));
  const [probed, setProbed] = useState<{ url: string; status: OllamaStatus } | null>(null);
  const [probeTick, setProbeTick] = useState(0);
  useEffect(() => {
    if (settings.provider !== 'ollama') return;
    const ctrl = new AbortController();
    const url = settings.ollamaUrl;
    const run = () => void probeOllama(url, ctrl.signal).then((status) => !ctrl.signal.aborted && setProbed({ url, status }));
    const t = window.setTimeout(run, 300);
    const every = window.setInterval(run, OLLAMA_REPROBE_MS);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(every);
      ctrl.abort();
    };
  }, [settings.provider, settings.ollamaUrl, probeTick]);
  const ollama = probed?.url === settings.ollamaUrl ? probed.status : undefined;
  const commitText = () =>
    onChange({
      ...settings,
      habits: habits.split('\n').map((s) => s.trim()).filter(Boolean),
      glossary: glossary.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
    });

  return (
    <aside className="drawer right" onClick={onClose}>
      <div className="drawer-body" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <strong>Settings</strong>
          <button onClick={onClose}>Close</button>
        </div>

        <h4>Transcriber</h4>
        <div className="segmented">
          {(['mock', 'ollama', 'openrouter'] as const).map((p) => (
            <button key={p} className={settings.provider === p ? 'active' : ''} onClick={() => onChange({ ...settings, provider: p })}>
              {p === 'mock' ? 'Mock' : p === 'ollama' ? 'Ollama (local)' : 'OpenRouter'}
            </button>
          ))}
        </div>

        {settings.provider === 'ollama' && (
          <>
            <label>
              Ollama URL
              <input value={settings.ollamaUrl} onChange={(e) => onChange({ ...settings, ollamaUrl: e.target.value.trim() })} placeholder="http://localhost:11434" />
            </label>
            <label>
              Vision model
              <input list="ollama-models" value={settings.ollamaModel} onChange={(e) => onChange({ ...settings, ollamaModel: e.target.value.trim() })} />
              <datalist id="ollama-models">
                {[...new Set([...(ollama?.models ?? []), ...OLLAMA_VISION_MODELS])].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <p className="probe">
              {ollama === undefined ? (
                'Checking Ollama…'
              ) : ollama.reachable ? (
                ollama.models.includes(settings.ollamaModel) ? (
                  <>Connected · {ollama.models.length} vision model{ollama.models.length === 1 ? '' : 's'} available.</>
                ) : ollama.textOnly.includes(settings.ollamaModel) ? (
                  <>
                    <code>{settings.ollamaModel}</code> is text-only and can't read ink. Pick a vision model{ollama.models.length ? <> ({ollama.models.join(', ')})</> : null} or run <code>ollama pull {DEFAULT_OLLAMA_MODEL}</code>.
                  </>
                ) : (
                  <>
                    Connected, but <code>{settings.ollamaModel}</code> is not pulled. Run <code>ollama pull {settings.ollamaModel}</code>
                    {ollama.models.length ? <> or pick one of: {ollama.models.join(', ')}</> : null}.
                  </>
                )
              ) : (
                <>
                  Can't reach Ollama at <code>{settings.ollamaUrl}</code> ({ollama.error}). Install from <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com</a>, then <code>ollama pull {settings.ollamaModel}</code>.
                  If the app is not on localhost, start Ollama with <code>OLLAMA_ORIGINS="{window.location.origin}"</code>.
                </>
              )}{' '}
              <button className="link" onClick={() => setProbeTick((n) => n + 1)}>
                Re-check
              </button>
            </p>
          </>
        )}

        {settings.provider === 'openrouter' && (
          <>
            <label>
              OpenRouter API key
              <input type="password" value={settings.openRouterApiKey} onChange={(e) => onChange({ ...settings, openRouterApiKey: e.target.value.trim() })} placeholder="sk-or-…" autoComplete="off" />
              <small>
                Stored only in this browser. Get one at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>; models ending in <code>:free</code> cost nothing.
              </small>
            </label>
            <label>
              Vision model
              <input list="models" value={settings.visionModel} onChange={(e) => onChange({ ...settings, visionModel: e.target.value.trim() })} />
              <datalist id="models">
                <option value="google/gemma-4-31b-it:free" />
                <option value="google/gemma-4-26b-a4b-it:free" />
                <option value="nvidia/nemotron-3.5-super-vl:free" />
                <option value="google/gemini-2.5-flash" />
                <option value="google/gemini-2.5-pro" />
                <option value="openai/gpt-4o" />
                <option value="anthropic/claude-sonnet-4" />
              </datalist>
            </label>
          </>
        )}

        <label className="row">
          <input type="checkbox" checked={settings.liveTranscription} onChange={(e) => onChange({ ...settings, liveTranscription: e.target.checked })} />
          Transcribe live while I write
        </label>
        <label>
          What gets sent after a pause
          <select value={settings.scope} onChange={(e) => onChange({ ...settings, scope: e.target.value as AppSettings['scope'] })}>
            <option value="page">Whole page (best accuracy — models need the context)</option>
            <option value="region">Only the lines I changed (cheaper, worse on messy writing)</option>
          </select>
        </label>

        <h4>Your handwriting profile</h4>
        <label>
          Habits (one per line — sent with every transcription)
          <textarea rows={4} value={habits} onChange={(e) => setHabits(e.target.value)} onBlur={commitText} placeholder={'I write footnotes with * and define them at the bottom of the page\nMy 7s have a cross bar\nI use → to mean "leads to"'} />
        </label>
        <label>
          Glossary (terms you write often)
          <textarea rows={3} value={glossary} onChange={(e) => setGlossary(e.target.value)} onBlur={commitText} placeholder="RLHF, PPO, minimax, backprop" />
        </label>
        <p>
          <strong>{corrections.length}</strong> corrections captured. Each time you fix a block in the Digital view, the ink crop + your text is saved; the most recent ones are sent as examples with every transcription, and the words
          the model got wrong become glossary hints. This dataset is also what a future per-user fine-tune will train on.
        </p>
        {corrections.length > 0 && (
          <div className="corrections">
            {[...corrections]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 8)
              .map((c) => (
                <div key={c.id} className="correction">
                  {c.imageDataUrl && <img src={c.imageDataUrl} alt="" />}
                  <div>
                    <s>{c.modelText}</s>
                    <div>{c.userText}</div>
                  </div>
                </div>
              ))}
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(corrections, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'inkmind-corrections.json';
                a.click();
              }}
            >
              Export dataset (.json)
            </button>
            <button onClick={() => void onClearCorrections()}>Clear corrections</button>
          </div>
        )}
      </div>
    </aside>
  );
}
