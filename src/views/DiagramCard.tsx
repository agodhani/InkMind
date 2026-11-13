import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { DigitalBlock, FigureNode, InkStroke } from '../model/page';
import { nodeTree } from '../transcribe/figure';
import { renderStrokesToPng } from '../transcribe/render';
import { edgeMarks, mindMapLayout, shapeGlyph, stepNode } from './figureView';
import { nodeInkStrokes } from './figureInk';
import { FigureEditor, type FigureEdit } from './FigureEditor';

export interface DiagramCardProps {
  block: DigitalBlock;
  strokeById: Map<string, InkStroke>;
  onHighlightStrokes?: (ids: string[] | null) => void;
  caption?: ReactNode;
  editing?: boolean;
  onEditFigure?: (next: FigureEdit) => void;
  onCancelEdit?: () => void;
}

function NodeHierarchy({ nodes }: { nodes: FigureNode[] }) {
  interface Entry { node: FigureNode; children: Entry[] }
  const roots: Entry[] = [], stack: Entry[] = [];
  const variedShapes = new Set(nodes.map(node => node.shape?.trim().toLowerCase()).filter(Boolean)).size > 1;
  for (const { node, depth } of nodeTree(nodes)) {
    const entry: Entry = { node, children: [] };
    if (depth > 0 && stack[depth - 1]) stack[depth - 1].children.push(entry);
    else roots.push(entry);
    stack[depth] = entry;
  }
  const list = (entries: Entry[]): ReactNode => <ul>{entries.map(({ node, children }) => <li key={node.id}>
    <div title={node.shape}><span aria-hidden="true" className="node-glyph">{shapeGlyph(node.shape)}</span><span aria-label={node.shape ? `${node.label}, ${node.shape}` : undefined}>{node.label}</span>{variedShapes && node.shape && <small>{node.shape}</small>}</div>
    {!!children.length && list(children)}
  </li>)}</ul>;
  return <div className="card-nodes">{list(roots)}</div>;
}

export function DiagramCard({ block, strokeById, onHighlightStrokes, caption, editing, onEditFigure, onCancelEdit }: DiagramCardProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const strokes = useMemo(() => block.strokeIds.map(id => strokeById.get(id)).filter((s): s is InkStroke => !!s), [block.strokeIds, strokeById]);
  const rendered = useMemo(() => strokes.length ? renderStrokesToPng(strokes, block.bbox, { maxEdge: 1200 }) : null, [strokes, block.bbox]);
  const fig = block.figure;
  const marks = fig ? edgeMarks(fig) : [];
  const mindMap = fig?.kind === 'mindmap' ? mindMapLayout(fig) : null;
  const stepInk = useMemo(() => new Map((fig?.sequence ?? []).map(step => [step, nodeInkStrokes(block, stepNode(fig!, step), [...strokeById.values()])])), [block, fig, strokeById]);
  useEffect(() => () => onHighlightStrokes?.(null), [onHighlightStrokes]);
  const highlight = (step: string | null) => {
    onHighlightStrokes?.(step === null ? null : stepInk.get(step) ?? block.strokeIds);
  };
  const summary = fig ? [fig.sequence?.length ? `${fig.sequence.length} steps` : '', fig.nodes?.length ? `${fig.nodes.length} nodes` : '', fig.edges.length ? `${fig.edges.length} links` : ''].filter(Boolean).join(' · ') : '';
  if (editing) return <div className="diagram-card">
    <div className="diagram-preview">{rendered && <img className="diagram-thumbnail" src={rendered.dataUrl} alt={`Ink: ${block.text || 'diagram'}`} />}</div>
    <FigureEditor block={block} onSave={next => onEditFigure?.(next)} onCancel={() => onCancelEdit?.()} />
  </div>;
  return (
    <div className="diagram-card" onDoubleClick={e => { if ((e.target as HTMLElement).closest('button')) e.stopPropagation(); }}>
      <div className="diagram-preview">
        {rendered ? <img className="diagram-thumbnail" src={rendered.dataUrl} alt={`Ink: ${block.text || 'diagram'}`} /> : <div className="diagram-missing">Diagram ink not available</div>}
        {caption ?? (block.text && <p className="diagram-caption">{block.text}</p>)}
      </div>
      {fig && <>
        <header className="diagram-card-header">
          <span className="chip chip-kind">{fig.kind}</span>
          <span className="diagram-summary">{summary}</span>
          <button type="button" className="diagram-disclosure" aria-expanded={expanded} aria-controls={panelId} onClick={() => {
            setExpanded(!expanded);
            if (expanded) { setActive(null); highlight(null); }
          }}>{expanded ? 'Hide details' : 'Show details'} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
        </header>
        <div id={panelId} className="diagram-panel" hidden={!expanded}>
          {!!fig.sequence?.length && <section aria-label="Steps">
            <h4>Steps</h4>
            <ol className="card-steps">
              {fig.sequence.map((step, i) => <li key={`${step}-${i}`}><button type="button" aria-pressed={active === step} title={stepNode(fig, step)?.shape} onClick={() => {
                const next = active === step ? null : step;
                setActive(next); highlight(next);
              }} onPointerEnter={e => { if (e.pointerType === 'mouse') highlight(step); }} onPointerLeave={e => { if (e.pointerType === 'mouse') highlight(active); }}>
                <span className="step-number" aria-hidden="true">{i + 1}</span><span>{step}</span>
              </button></li>)}
            </ol>
          </section>}
          {!mindMap && !!fig.nodes?.length && <section aria-label="Nodes"><h4>Nodes</h4>
            <NodeHierarchy nodes={fig.nodes} />
          </section>}
          {mindMap && <section aria-label="Mind map"><h4>Mind map</h4><div className="mindmap-hub">{mindMap.hub}</div>
            <ul className="mindmap-branches">{mindMap.spokes.map(spoke => <li key={spoke.label}><strong>{spoke.label}</strong>{!!spoke.children.length && <ul>{spoke.children.map(child => <li key={child}>{child}</li>)}</ul>}</li>)}</ul>
          </section>}
          {!mindMap && !!fig.edges.length && <section aria-label="Links"><h4>Links</h4>
            <ul className="card-links">{fig.edges.map((edge, i) => <li key={i} className={edge.inferred ? 'link-inferred' : undefined} title={edge.inferred ? 'from the ink geometry (not read by the model)' : undefined}>
              <span>{edge.from} {marks[i] === 'self-loop' ? '↺' : edge.kind === 'line' ? '—' : '→'} {marks[i] === 'self-loop' ? '' : edge.to}{edge.label ? ` (${edge.label})` : ''}</span>
              {marks[i] && <span className="link-badge">{marks[i] === 'back' ? '↩ back' : 'self-loop'}</span>}
            </li>)}</ul>
          </section>}
          {!!fig.cells?.length && <section aria-label="Table"><h4>Table</h4><div className="card-table-scroll" tabIndex={0} role="region" aria-label="Table cells">
            <table className="card-table"><thead><tr>{fig.cells[0].map((cell, i) => <th scope="col" key={i}>{cell}</th>)}</tr></thead><tbody>
              {fig.cells.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 && fig.cells![0][0] === '' ? <th scope="row" key={j}>{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}
            </tbody></table>
          </div></section>}
          {!fig.nodes?.length && !!fig.labels.length && <section aria-label="Labels"><h4>Labels</h4><div className="diagram-labels">{fig.labels.map((label, i) => <span className="chip chip-label" key={i}>{label}</span>)}</div></section>}
        </div>
      </>}
    </div>
  );
}
