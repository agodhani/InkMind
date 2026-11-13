import { useState } from 'react';
import type { DigitalBlock, FigureInfo } from '../model/page';
import { renameFigureNodes } from './figureView';

export interface FigureEdit { text: string; figure: FigureInfo }

export function FigureEditor({ block, onSave, onCancel }: { block: DigitalBlock; onSave: (next: FigureEdit) => void; onCancel: () => void }) {
  const [text, setText] = useState(block.text);
  const initialFigure: FigureInfo = block.figure ?? { kind: 'other', shapes: [], labels: [], edges: [] };
  const [figure, setFigure] = useState<FigureInfo>(() => structuredClone(initialFigure));
  const [nodeLabels, setNodeLabels] = useState<Map<string, string>>(() => new Map());
  const [stepLabels, setStepLabels] = useState<Map<string, string>>(() => new Map());
  const draft = renameFigureNodes(figure, nodeLabels, stepLabels);
  const setNodeLabel = (id: string, value: string) => setNodeLabels(current => new Map(current).set(id, value));
  const save = () => {
    if (text === block.text && JSON.stringify(draft) === JSON.stringify(initialFigure)) onCancel();
    else onSave({ text, figure: draft });
  };
  const move = (index: number, direction: number) => {
    setFigure(current => {
      const sequence = [...(current.sequence ?? [])];
      [sequence[index], sequence[index + direction]] = [sequence[index + direction], sequence[index]];
      return { ...current, sequence };
    });
  };
  return <form className="figure-editor" aria-label="Edit diagram" onSubmit={e => { e.preventDefault(); save(); }} onDoubleClick={e => e.stopPropagation()} onKeyDown={e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  }}>
    <div className="figure-editor-heading"><h4>Edit diagram</h4><span>Save changes to your handwriting profile</span></div>
    <div className="figure-editor-actions"><button type="submit" className="figure-save">Save changes</button><button type="button" onClick={onCancel}>Cancel</button><small>Ctrl / ⌘ + Enter to save · Esc to cancel</small></div>
    <label>Caption<textarea autoFocus value={text} onChange={e => setText(e.target.value)} /></label>
    {!!figure.sequence?.length && <fieldset><legend>Steps</legend><ol className="figure-edit-steps">{figure.sequence.map((step, i) => <li key={i}>
      <label>Step {i + 1}<input value={draft.sequence![i]} onChange={e => {
        const matches = figure.nodes?.filter(node => node.label.trim().toLowerCase() === step.trim().toLowerCase()) ?? [];
        if (matches.length === 1) setNodeLabel(matches[0].id, e.target.value);
        else setStepLabels(current => {
          const next = new Map(current);
          if (e.target.value === step) next.delete(step);
          else next.set(step, e.target.value);
          return next;
        });
      }} /></label>
      <div className="figure-step-actions">
        <button type="button" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
        <button type="button" aria-label={`Move step ${i + 1} down`} disabled={i === figure.sequence!.length - 1} onClick={() => move(i, 1)}>↓</button>
        <button type="button" aria-label={`Remove step ${i + 1}`} onClick={() => setFigure(current => ({ ...current, sequence: current.sequence!.filter((_, index) => index !== i) }))}>Remove</button>
      </div>
    </li>)}</ol></fieldset>}
    {!!figure.nodes?.length && <fieldset><legend>Nodes</legend><div className="figure-edit-grid">{figure.nodes.map((node, i) => <label key={node.id}>Node {i + 1}<input value={draft.nodes![i].label} onChange={e => setNodeLabel(node.id, e.target.value)} /></label>)}</div></fieldset>}
    {!!figure.edges.length && <fieldset><legend>Links</legend>{draft.edges.map((edge, i) => <label key={i}>{draft.nodes?.find(n => n.id === edge.from)?.label ?? edge.from} → {draft.nodes?.find(n => n.id === edge.to)?.label ?? edge.to}<input aria-label={`Link ${i + 1} label`} value={edge.label ?? ''} onChange={e => setFigure(current => ({ ...current, edges: current.edges.map((item, index) => index === i ? { ...item, label: e.target.value } : item) }))} /></label>)}</fieldset>}
    {!!figure.cells?.length && <fieldset><legend>Table cells</legend><div className="figure-edit-cells">{figure.cells.map((row, i) => <div className="figure-edit-grid" key={i}>{row.map((cell, j) => <label key={j}>Row {i + 1}, column {j + 1}<input value={cell} onChange={e => setFigure(current => ({ ...current, cells: current.cells!.map((cells, r) => r === i ? cells.map((value, c) => c === j ? e.target.value : value) : cells) }))} /></label>)}</div>)}</div></fieldset>}
  </form>;
}
