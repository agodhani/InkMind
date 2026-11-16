import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { DigitalBlock, FigureNode, InkStroke } from '../model/page';
import { nodeTree } from '../transcribe/figure';
import { renderStrokesToPng } from '../transcribe/render';
import { edgeMarks, figureEdgeText, mindMapLayout, shapeGlyph, stepNode, uncoveredFigureLabels, vennLayout, type MindMapBranch } from './figureView';
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

function NodeHierarchy({ nodes, active, onHighlight, onActivate }: { nodes: FigureNode[]; active: string | null; onHighlight: (key: string | null) => void; onActivate: (key: string) => void }) {
  interface Entry { node: FigureNode; children: Entry[] }
  const roots: Entry[] = [], stack: Entry[] = [];
  const venn = vennLayout(nodes);
  const variedShapes = new Set(nodes.map(node => node.shape?.trim().toLowerCase()).filter(Boolean)).size > 1;
  if (venn) roots.push(...venn.sets.map(({ node, members }) => ({ node, children: members.map(node => ({ node, children: [] })) })), ...venn.other.map(node => ({ node, children: [] })));
  else for (const { node, depth } of nodeTree(nodes)) {
    const entry: Entry = { node, children: [] };
    if (depth > 0 && stack[depth - 1]) stack[depth - 1].children.push(entry);
    else roots.push(entry);
    stack[depth] = entry;
  }
  const list = (entries: Entry[]): ReactNode => <ul>{entries.map(({ node, children }) => <li key={node.id}>
    <div><button type="button" title={node.shape} aria-pressed={active === `node:${node.id}`} onClick={() => onActivate(`node:${node.id}`)} onPointerEnter={e => { if (e.pointerType === 'mouse') onHighlight(`node:${node.id}`); }} onPointerLeave={e => { if (e.pointerType === 'mouse') onHighlight(active); }}><span aria-hidden="true" className="node-glyph">{shapeGlyph(node.shape)}</span><span aria-label={node.shape ? `${node.label}, ${node.shape}` : undefined}>{node.label}</span>{variedShapes && node.shape && <small>{node.shape}</small>}</button></div>
    {!!children.length && list(children)}
  </li>)}</ul>;
  return <div className="card-nodes">{list(roots)}{!!venn?.overlaps.length && <div aria-label="Overlaps"><h4>Overlaps</h4>{venn.overlaps.map(region => <p key={region.label}>{region.label}: {region.members.map(node => node.label).join(', ')}</p>)}</div>}</div>;
}

function MindMapBranches({ branches }: { branches: MindMapBranch[] }) {
  return <>{branches.map((branch, i) => <li key={i}><strong>{branch.label}</strong>{!!branch.children.length && <ul><MindMapBranches branches={branch.children} /></ul>}</li>)}</>;
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
  const linkIndices = mindMap?.remainingEdges ?? fig?.edges.map((_, i) => i) ?? [];
  const annotations = fig ? uncoveredFigureLabels(fig) : [];
  const stepInk = useMemo(() => new Map<string, string[]>([
    ...(fig?.sequence ?? []).map((step, i) => [`step:${i}`, nodeInkStrokes(block, stepNode(fig!, step, i), [...strokeById.values()])] as const),
    ...(fig?.nodes ?? []).map(node => [`node:${node.id}`, nodeInkStrokes(block, node, [...strokeById.values()])] as const),
  ]), [block, fig, strokeById]);
  useEffect(() => () => onHighlightStrokes?.(null), [onHighlightStrokes]);
  const highlight = (step: string | null) => {
    onHighlightStrokes?.(step === null ? null : stepInk.get(step) ?? block.strokeIds);
  };
  const activate = (key: string) => {
    const next = active === key ? null : key;
    setActive(next); highlight(next);
  };
  const summary = fig ? [fig.kind === 'table' ? (fig.cells?.length ? `${fig.cells.length}×${Math.max(...fig.cells.map(row => row.length))} table` : 'table') : fig.sequence?.length ? `${fig.sequence.length} steps` : '', fig.nodes?.length ? `${fig.nodes.length} nodes` : '', fig.edges.length ? `${fig.edges.length} links` : ''].filter(Boolean).join(' · ') : '';
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
          {fig.kind !== 'table' && !!fig.sequence?.length && <section aria-label="Steps">
            <h4>Steps</h4>
            <ol className="card-steps">
              {fig.sequence.map((step, i) => <li key={`${step}-${i}`}><button type="button" aria-pressed={active === `step:${i}`} title={stepNode(fig, step, i)?.shape} onClick={() => {
                activate(`step:${i}`);
              }} onPointerEnter={e => { if (e.pointerType === 'mouse') highlight(`step:${i}`); }} onPointerLeave={e => { if (e.pointerType === 'mouse') highlight(active); }}>
                <span className="step-number" aria-hidden="true">{i + 1}</span><span>{step}</span>
              </button></li>)}
            </ol>
          </section>}
          {!mindMap && !!fig.nodes?.length && <section aria-label="Nodes"><h4>Nodes</h4>
            <NodeHierarchy nodes={fig.nodes} active={active} onHighlight={highlight} onActivate={activate} />
          </section>}
          {mindMap && <section aria-label="Mind map"><h4>Mind map</h4><div className="mindmap-hub">{mindMap.hub}</div>
            <ul className="mindmap-branches"><MindMapBranches branches={mindMap.spokes} /></ul>
            {!!mindMap.other.length && <><h4>Other branches</h4><ul className="mindmap-branches"><MindMapBranches branches={mindMap.other} /></ul></>}
          </section>}
          {!!linkIndices.length && <section aria-label="Links"><h4>{mindMap ? 'Other links' : 'Links'}</h4>
            <ul className="card-links">{linkIndices.map(i => { const edge = fig.edges[i]; return <li key={i} className={edge.inferred ? 'link-inferred' : undefined} title={edge.inferred ? 'from the ink geometry (not read by the model)' : undefined}>
              <span>{figureEdgeText(fig, edge)}</span>
              {marks[i] && <span className="link-badge">{marks[i] === 'back' ? '↩ back' : 'self-loop'}</span>}
            </li>; })}</ul>
          </section>}
          {!!fig.cells?.length && <section aria-label="Table"><h4>Table</h4><div className="card-table-scroll" tabIndex={0} role="region" aria-label="Table cells">
            <table className="card-table"><thead><tr>{fig.cells[0].map((cell, i) => <th scope="col" key={i}>{cell}</th>)}</tr></thead><tbody>
              {fig.cells.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 && fig.cells![0][0] === '' ? <th scope="row" key={j}>{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}
            </tbody></table>
          </div></section>}
          {!!annotations.length && <section aria-label="Labels"><h4>Labels</h4><div className="diagram-labels">{annotations.map((label, i) => <span className="chip chip-label" key={i}>{label}</span>)}</div></section>}
        </div>
      </>}
    </div>
  );
}
