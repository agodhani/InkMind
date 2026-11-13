import { useEffect, useMemo, useRef, useState } from 'react';
import type { DigitalBlock, InkStroke } from '../model/page';
import { sortBlocksForReading } from '../model/page';
import { DiagramCard } from './DiagramCard';
import type { FigureEdit } from './FigureEditor';
import { Icon } from '../ui/icons';
import { Kbd } from '../ui/primitives';

export interface DigitalViewProps {
  blocks: DigitalBlock[];
  strokes: InkStroke[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  /** Pointer hover over a block (null on leave) so the ink pane can light up its strokes. */
  onHoverBlock?: (id: string | null) => void;
  onHighlightStrokes?: (strokeIds: string[] | null) => void;
  onEditBlock: (block: DigitalBlock, newText: string) => void;
  onEditFigure?: (block: DigitalBlock, next: FigureEdit) => void;
  emptyHint?: string;
}

export function DigitalView({ blocks, strokes, selectedBlockId, onSelectBlock, onHoverBlock, onHighlightStrokes, onEditBlock, onEditFigure, emptyHint }: DigitalViewProps) {
  const ordered = useMemo(() => sortBlocksForReading(blocks), [blocks]);
  const strokeById = useMemo(() => new Map(strokes.map((s) => [s.id, s])), [strokes]);
  const footnotes = ordered.filter((b) => b.kind === 'footnote_def');
  const main = ordered.filter((b) => b.kind !== 'footnote_def');

  if (blocks.length === 0) {
    return (
      <div className="digital-view empty">
        <div className="empty">
          <div className="empty-art">
            <Icon name="digital" size={28} />
          </div>
          <h3>Nothing transcribed yet</h3>
          <p>{emptyHint ?? 'Write on the ink page; the digital version appears here.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="digital-view" onClick={() => onSelectBlock(null)}>
      {main.map((b) => (
        <BlockView key={b.id} block={b} strokeById={strokeById} selected={b.id === selectedBlockId} onSelect={onSelectBlock} onHover={onHoverBlock} onHighlightStrokes={onHighlightStrokes} onEdit={onEditBlock} onEditFigure={onEditFigure} />
      ))}
      {footnotes.length > 0 && (
        <div className="footnotes">
          {footnotes.map((b) => (
            <BlockView key={b.id} block={b} strokeById={strokeById} selected={b.id === selectedBlockId} onSelect={onSelectBlock} onHover={onHoverBlock} onEdit={onEditBlock} />
          ))}
        </div>
      )}
    </div>
  );
}

interface BlockViewProps {
  block: DigitalBlock;
  strokeById: Map<string, InkStroke>;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  onHighlightStrokes?: (strokeIds: string[] | null) => void;
  onEdit: (block: DigitalBlock, newText: string) => void;
  onEditFigure?: (block: DigitalBlock, next: FigureEdit) => void;
}

function BlockView({ block, strokeById, selected, onSelect, onHover, onHighlightStrokes, onEdit, onEditFigure }: BlockViewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.text);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const startEditing = () => {
    setDraft(block.text);
    setEditing(true);
  };

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.style.height = `${taRef.current.scrollHeight}px`;
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== block.text.trim()) onEdit(block, draft);
  };

  const content = editing ? (
    <textarea
      ref={taRef}
      className="block-editor"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onBlur={commit}
      aria-label="Correct the transcription"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          setDraft(block.text);
          setEditing(false);
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          commit();
        }
      }}
    />
  ) : (
    <BlockText block={block} />
  );

  const className = [
    'block',
    `kind-${block.kind}`,
    selected ? 'selected' : '',
    block.confidence < 0.5 ? 'low-confidence' : '',
    block.userEdited ? 'user-edited' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover?.(block.id)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onHover?.(null)}
      onKeyDown={(e) => {
        if (editing || e.target !== e.currentTarget) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          startEditing();
        }
      }}
      tabIndex={0}
      aria-label={`${block.kind.replace('_', ' ')} block${block.userEdited ? ', corrected by you' : block.confidence < 0.5 ? ', low confidence' : ''}`}
    >
      {selected && !editing && (
        <div className="block-tools" onClick={(e) => e.stopPropagation()}>
          <span className={`block-meta ${block.userEdited ? 'edited' : block.confidence < 0.5 ? 'low' : ''}`}>{block.userEdited ? 'Corrected by you' : `${block.kind.replace('_', ' ')} · ${Math.round(block.confidence * 100)}%`}</span>
          <button type="button" className="btn tone-primary" onClick={startEditing} data-tip="Double-tap the block also works" data-tip-placement="top">
            <Icon name="edit" size={14} /> Correct
          </button>
        </div>
      )}
      {block.kind === 'diagram' ? <DiagramCard block={block} strokeById={strokeById} onHighlightStrokes={onHighlightStrokes} editing={editing} onCancelEdit={() => setEditing(false)} onEditFigure={next => {
        if (next.text !== block.text || JSON.stringify(next.figure) !== JSON.stringify(block.figure)) onEditFigure?.(block, next);
        setEditing(false);
      }} /> : content}
      {editing && block.kind !== 'diagram' && (
        <div className="editor-hint">
          <span>
            <Kbd>Ctrl</Kbd>+<Kbd>↵</Kbd> save
          </span>
          <span>
            <Kbd>Esc</Kbd> cancel
          </span>
          <span>Saved as an example of your handwriting.</span>
        </div>
      )}
    </div>
  );
}

function BlockText({ block }: { block: DigitalBlock }) {
  const text = block.text;
  switch (block.kind) {
    case 'heading': {
      const level = Math.min(3, Math.max(1, block.level ?? 2));
      const clean = text.replace(/^#+\s*/, '');
      if (level === 1) return <h1>{clean}</h1>;
      if (level === 2) return <h2>{clean}</h2>;
      return <h3>{clean}</h3>;
    }
    case 'list':
    case 'checklist':
      return (
        <ul className={block.kind}>
          {text
            .split('\n')
            .filter((l) => l.trim())
            .map((line, i) => {
              const indent = Math.floor((line.match(/^\s*/)?.[0].length ?? 0) / 2);
              const m = line.trim().match(/^(?:[-*•]\s*)?(\[( |x|X)\]\s*)?(\d+[.)]\s*)?(.*)$/);
              const checked = m?.[2]?.toLowerCase() === 'x';
              const isCheck = !!m?.[1];
              return (
                <li key={i} style={{ marginLeft: indent * 18 }} className={isCheck ? (checked ? 'checked' : 'unchecked') : m?.[3] ? 'numbered' : ''}>
                  {isCheck && <input type="checkbox" readOnly checked={checked} />}
                  {m?.[3] && <span className="num">{m[3]}</span>}
                  <Inline text={m?.[4] ?? line} />
                </li>
              );
            })}
        </ul>
      );
    case 'math':
      return <pre className="math">{text}</pre>;
    case 'footnote_ref':
      return (
        <p>
          <Inline text={text} />
          {block.marker && <sup className="marker">{block.marker}</sup>}
        </p>
      );
    case 'footnote_def':
      return (
        <p>
          {block.marker && <span className="marker">{block.marker}</span>} <Inline text={text} />
        </p>
      );
    case 'margin_note':
      return (
        <aside>
          <Inline text={text} />
        </aside>
      );
    default:
      return (
        <p>
          <Inline text={text} />
        </p>
      );
  }
}

/** Minimal inline Markdown: **bold**, *italic*, `code`, $math$, [[links]]. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\$[^$]+\$|\[\[[^\]]+\]\])/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith('$') && p.endsWith('$')) return <code key={i} className="inline-math">{p.slice(1, -1)}</code>;
        if (p.startsWith('[[') && p.endsWith(']]')) return <a key={i} className="wikilink">{p.slice(2, -2)}</a>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
