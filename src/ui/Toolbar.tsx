import { useRef, useState } from 'react';
import type { InkTool } from '../ink/InkCanvas';
import type { TranscriptionStatus } from '../transcribe/useTranscription';
import { BrushPicker } from './BrushPicker';
import { Icon } from './icons';
import { IconButton, Kbd, Popover, Segmented } from './primitives';
import { formatShortcut, SHORTCUTS } from './shortcuts';
import { StatusPill } from './StatusPill';
import type { ResolvedTheme } from './theme';

export type ViewMode = 'ink' | 'digital' | 'split';

export interface ToolbarProps {
  title: string;
  onTitle: (t: string) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  tool: InkTool;
  onTool: (t: InkTool) => void;
  brushColor: string;
  brushSize: number;
  onBrushColor: (c: string) => void;
  onBrushSize: (n: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  status: TranscriptionStatus;
  live: boolean;
  providerLabel: string;
  onTranscribeNow: () => void;
  onRetranscribeAll: () => void;
  onExport: () => void;
  onOpenPages: () => void;
  onOpenSettings: () => void;
  onShowTips: () => void;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  compact: boolean;
}

const sc = (name: keyof typeof SHORTCUTS) => formatShortcut(SHORTCUTS[name]);

export function Toolbar(p: ToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchor = useRef<HTMLButtonElement>(null);

  const viewSeg = (
    <Segmented<ViewMode>
      label="View"
      value={p.view}
      onChange={p.onView}
      options={[
        { value: 'ink', label: 'Ink', icon: 'ink', shortcut: sc('viewInk'), iconOnly: p.compact },
        { value: 'split', label: 'Split', icon: 'split', shortcut: sc('viewSplit'), iconOnly: p.compact },
        { value: 'digital', label: 'Digital', icon: 'digital', shortcut: sc('viewDigital'), iconOnly: p.compact },
      ]}
    />
  );
  const tools = (
    <>
      <div className="toolgroup" role="toolbar" aria-label="Drawing tools">
        <IconButton icon="pen" label="Pen" shortcut={sc('pen')} active={p.tool === 'pen'} onClick={() => p.onTool('pen')} className="ghost" />
        <IconButton icon="eraser" label="Eraser" shortcut={sc('eraser')} active={p.tool === 'eraser'} onClick={() => p.onTool('eraser')} className="ghost" />
        <IconButton icon="hand" label="Pan" shortcut={sc('pan')} active={p.tool === 'pan'} onClick={() => p.onTool('pan')} className="ghost" />
        <BrushPicker color={p.brushColor} size={p.brushSize} onColor={p.onBrushColor} onSize={p.onBrushSize} shortcutHint={`${sc('smaller')} ${sc('larger')}`} />
      </div>
      <div className="toolgroup" role="toolbar" aria-label="History">
        <IconButton icon="undo" label="Undo" shortcut={sc('undo')} onClick={p.onUndo} disabled={!p.canUndo} className="ghost" />
        <IconButton icon="redo" label="Redo" shortcut={sc('redo')} onClick={p.onRedo} disabled={!p.canRedo} className="ghost" />
      </div>
    </>
  );
  const transcribeBtn = <IconButton icon="sparkles" label="Transcribe now" shortcut={sc('transcribe')} onClick={p.onTranscribeNow} showLabel={!p.compact} tone={p.compact ? 'default' : 'primary'} className={p.compact ? 'ghost' : ''} />;
  const more = (
    <>
      <IconButton ref={menuAnchor} icon="more" label="More" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="ghost" tipAlign="end" />
      <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuAnchor} label="More actions" align="end">
        <div className="menu" role="menu">
          <button role="menuitem" onClick={() => (setMenuOpen(false), p.onExport())}>
            <Icon name="download" /> <span className="menu-label">Export Markdown</span>
          </button>
          <button role="menuitem" onClick={() => (setMenuOpen(false), p.onRetranscribeAll())}>
            <Icon name="refresh" /> <span className="menu-label">Transcribe everything again</span>
          </button>
          <hr />
          <button role="menuitem" onClick={() => (setMenuOpen(false), p.onShowTips())}>
            <Icon name="info" /> <span className="menu-label">How InkMind works</span>
          </button>
          <div className="menu-section">Shortcuts</div>
          <button role="menuitem" onClick={() => (setMenuOpen(false), p.onOpenPages())}>
            <Icon name="file" /> <span className="menu-label">Pages</span> <Kbd>{sc('pages')}</Kbd>
          </button>
          <button role="menuitem" onClick={() => (setMenuOpen(false), p.onOpenSettings())}>
            <Icon name="settings" /> <span className="menu-label">Settings</span> <Kbd>{sc('settings')}</Kbd>
          </button>
        </div>
      </Popover>
    </>
  );

  return (
    <>
      <header className="topbar">
        <IconButton icon="menu" label="Pages" shortcut={sc('pages')} onClick={p.onOpenPages} className="ghost" tipAlign="start" />
        <input className="title-input" value={p.title} onChange={(e) => p.onTitle(e.target.value)} aria-label="Page title" placeholder="Untitled page" spellCheck={false} />
        {!p.compact && (
          <div className="tools-inline">
            <div className="toolgroup">{viewSeg}</div>
            {tools}
          </div>
        )}
        <span className="spacer" />
        <StatusPill status={p.status} live={p.live} providerLabel={p.providerLabel} onRetry={p.onTranscribeNow} />
        {!p.compact && transcribeBtn}
        <IconButton icon={p.theme === 'dark' ? 'sun' : 'moon'} label={p.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} shortcut={sc('toggleTheme')} onClick={p.onToggleTheme} className="ghost" />
        <IconButton icon="settings" label="Settings" shortcut={sc('settings')} onClick={p.onOpenSettings} className="ghost" tipAlign={p.compact ? 'end' : 'center'} />
        {!p.compact && more}
      </header>
      {p.compact && (
        <nav className="toolstrip" aria-label="Tools">
          {viewSeg}
          {tools}
          <span className="spacer" />
          {transcribeBtn}
          {more}
        </nav>
      )}
    </>
  );
}
