import { useMemo, useState } from 'react';
import type { Page } from '../model/page';
import { renderStrokesToPng } from '../transcribe/render';
import { strokesBounds } from '../transcribe/regions';
import { filterPages, pageExcerpt, plural, relativeTime } from './format';
import { Icon } from './icons';
import { Drawer, IconButton } from './primitives';

export interface PagesDrawerProps {
  open: boolean;
  pages: Page[];
  currentId: string | null;
  onClose: () => void;
  onOpen: (p: Page) => void;
  onNew: () => void;
  onImport: (file: File) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (p: Page) => void;
}

export function PagesDrawer({ open, pages, currentId, onClose, onOpen, onNew, onImport, onRename, onDelete }: PagesDrawerProps) {
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const shown = useMemo(() => filterPages(pages, query), [pages, query]);

  return (
    <Drawer
      open={open}
      side="left"
      title="Pages"
      onClose={onClose}
      actions={
        <>
          <label className="btn btn-icon ghost" data-tip="Import strokes (.json from scripts/pdf_to_strokes.py)" aria-label="Import strokes">
            <Icon name="upload" />
            <input type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          </label>
          <IconButton icon="plus" label="New page" tone="primary" onClick={onNew} />
        </>
      }
    >
      {pages.length === 0 ? (
        <div className="empty">
          <div className="empty-art">
            <Icon name="file" size={28} />
          </div>
          <h3>No pages yet</h3>
          <p>Create a page and start writing — it is saved in this browser as you go.</p>
          <div className="empty-actions">
            <button className="btn tone-primary" onClick={onNew}>
              <Icon name="plus" /> New page
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pages-toolbar">
            <div className="input-wrap">
              <Icon name="search" size={16} />
              <input className="input" type="search" placeholder="Search titles and text" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search pages" />
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="empty">
              <h3>No matches</h3>
              <p>Nothing titled or transcribed with “{query.trim()}”.</p>
            </div>
          ) : (
            <ul className="pages-list" aria-label="Pages">
              {shown.map((p) => (
                <li key={p.id}>
                  <PageCard page={p} active={p.id === currentId} renaming={renaming === p.id} onOpen={() => onOpen(p)} onRename={(t) => (onRename(p.id, t), setRenaming(null))} onStartRename={() => setRenaming(p.id)} onCancelRename={() => setRenaming(null)} onDelete={() => onDelete(p)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Drawer>
  );
}

function PageCard({ page, active, renaming, onOpen, onRename, onStartRename, onCancelRename, onDelete }: { page: Page; active: boolean; renaming: boolean; onOpen: () => void; onRename: (t: string) => void; onStartRename: () => void; onCancelRename: () => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(page.title);
  const startRename = () => {
    setDraft(page.title);
    onStartRename();
  };
  const focusAndSelect = (el: HTMLInputElement | null) => {
    if (el && document.activeElement !== el) {
      el.focus();
      el.select();
    }
  };
  const excerpt = pageExcerpt(page);
  return (
    <div className={`page-card ${active ? 'is-active' : ''}`} onClick={() => !renaming && onOpen()} aria-current={active ? 'page' : undefined}>
      <PageThumbnail page={page} />
      <div className="page-main">
        {renaming ? (
          <input
            ref={focusAndSelect}
            className="rename-input"
            value={draft}
            aria-label="Page title"
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => onRename(draft.trim() || page.title)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename(draft.trim() || page.title);
              else if (e.key === 'Escape') onCancelRename();
            }}
          />
        ) : (
          <button className="page-title" onClick={(e) => (e.stopPropagation(), onOpen())}>
            {page.title || 'Untitled'}
          </button>
        )}
        {excerpt ? <span className="page-excerpt">{excerpt}</span> : <span className="page-excerpt">{page.strokes.length ? 'Not transcribed yet' : 'Blank page'}</span>}
        <span className="page-meta">
          {relativeTime(page.updatedAt)} · {plural(page.strokes.length, 'stroke')} · {plural(page.blocks.length, 'block')}
        </span>
      </div>
      <div className="page-side" onClick={(e) => e.stopPropagation()}>
        <IconButton icon="edit" label="Rename" onClick={startRename} />
        <IconButton icon="trash" label="Delete" tone="danger" onClick={onDelete} />
      </div>
    </div>
  );
}

export function PageThumbnail({ page }: { page: Page }) {
  const src = useMemo(() => {
    if (!page.strokes.length) return null;
    const bounds = strokesBounds(page.strokes);
    if (!bounds) return null;
    try {
      return renderStrokesToPng(page.strokes, bounds, { maxEdge: 240, sizeMultiplier: 1.5 })?.dataUrl ?? null;
    } catch {
      return null;
    }
    // Strokes only change when updatedAt changes; keying on it avoids re-rendering every list update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, page.updatedAt, page.strokes.length]);
  return <div className="page-thumb" aria-hidden="true">{src ? <img src={src} alt="" /> : <Icon name="pen" size={20} />}</div>;
}
