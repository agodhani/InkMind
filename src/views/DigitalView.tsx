import { useEffect, useMemo, useRef, useState } from 'react';
import type { DigitalBlock, InkStroke } from '../model/page';
import { sortBlocksForReading } from '../model/page';
import { renderStrokesToPng } from '../transcribe/render';
import { hasNesting, nodeTree } from '../transcribe/figure';
import { Icon } from '../ui/icons';
import { Kbd } from '../ui/primitives';

export interface DigitalViewProps {
  blocks: DigitalBlock[];
  strokes: InkStroke[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  /** Pointer hover over a block (null on leave) so the ink pane can light up its strokes. */
  onHoverBlock?: (id: string | null) => void;
  onEditBlock: (block: DigitalBlock, newText: string) => void;
  emptyHint?: string;
}

export function DigitalView({ blocks, strokes, selectedBlockId, onSelectBlock, onHoverBlock, onEditBlock, emptyHint }: DigitalViewProps) {
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
        <BlockView key={b.id} block={b} strokeById={strokeById} selected={b.id === selectedBlockId} onSelect={onSelectBlock} onHover={onHoverBlock} onEdit={onEditBlock} />
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
  onEdit: (block: DigitalBlock, newText: string) => void;
}

function BlockView({ block, strokeById, selected, onSelect, onHover, onEdit }: BlockViewProps) {
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
        if (editing) return;
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
      {block.kind === 'diagram' && <DiagramCrop block={block} strokeById={strokeById} />}
      {editing ? (
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
      )}
      {editing && (
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
    case 'diagram':
      return <DiagramDetails block={block} text={text} />;
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

/** Caption + label chips + compact edge list for a diagram block (falls back to caption only for legacy blocks). */
function DiagramDetails({ block, text }: { block: DigitalBlock; text: string }) {
  const fig = block.figure;
  return (
    <div className="diagram-details">
      {text && <div className="caption">{text}</div>}
      {fig && (fig.kind !== 'other' || fig.shapes.length > 0) && (
        <div className="diagram-kind">
          <span className="chip chip-kind">{fig.kind}</span>
          {fig.shapes.map((s, i) => (
            <span key={`${s}-${i}`} className="chip chip-shape">{s}</span>
          ))}
        </div>
      )}
      {fig && fig.labels.length > 0 && (
        <div className="diagram-labels" aria-label="labels">
          {fig.labels.map((l, i) => (
            <span key={`${l}-${i}`} className="chip chip-label">{l}</span>
          ))}
        </div>
      )}
      {fig?.cells && fig.cells.length > 0 && (
        <table className="diagram-table" aria-label="table cells">
          <tbody>
            {fig.cells.map((row, r) => (
              <tr key={r}>{row.map((cell, c) => (r === 0 ? <th key={c}>{cell}</th> : <td key={c}>{cell}</td>))}</tr>
            ))}
          </tbody>
        </table>
      )}
      {fig && hasNesting(fig) && (
        <ul className="diagram-nodes" aria-label="nested shapes">
          {nodeTree(fig.nodes!).map(({ node, depth }) => (
            <li key={node.id} style={{ paddingLeft: `${depth * 16}px` }}>
              <span className="edge-node">{node.label}</span>
              {node.shape && <span className="diagram-node-shape"> {node.shape}</span>}
            </li>
          ))}
        </ul>
      )}
      {fig?.sequence && fig.sequence.length > 1 && (
        <ol className="diagram-sequence" aria-label="step order">
          {fig.sequence.map((step, i) => (
            <li key={`${step}-${i}`}>{step}</li>
          ))}
        </ol>
      )}
      {fig && fig.edges.length > 0 && (
        <ul className="diagram-edges" aria-label="relations">
          {fig.edges.map((e, i) => (
            <li key={`${e.from}-${e.to}-${i}`} className={e.inferred ? 'edge-inferred' : undefined} title={e.inferred ? 'from the ink geometry (not read by the model)' : undefined}>
              <span className="edge-node">{e.from}</span>
              {e.kind === 'self-loop' || e.from === e.to ? (
                <span className="edge-arrow">{e.label ? ` ↺ (${e.label})` : ' ↺'}</span>
              ) : (
                <>
                  <span className="edge-arrow">{e.kind === 'line' ? ' — ' : ' → '}</span>
                  <span className="edge-node">{e.to}</span>
                  {e.label && <span className="edge-label"> ({e.label})</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiagramCrop({ block, strokeById }: { block: DigitalBlock; strokeById: Map<string, InkStroke> }) {
  const strokes = useMemo(() => block.strokeIds.map((id) => strokeById.get(id)).filter((s): s is InkStroke => !!s), [block.strokeIds, strokeById]);
  const rendered = useMemo(() => (strokes.length ? renderStrokesToPng(strokes, block.bbox, { maxEdge: 1200 }) : null), [strokes, block.bbox]);
  if (!rendered) return <div className="diagram-missing">(diagram ink not available)</div>;
  return <img className="diagram" src={rendered.dataUrl} alt={block.text} style={{ maxWidth: '100%', width: rendered.size.width / rendered.scale }} />;
}
