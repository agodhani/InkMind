// Dev-only drawing simulator. Mounted by App when the URL has ?sim=1.
// "Draw" replays a synthetic scene through real pointer events on the InkCanvas; "Instant" injects the
// strokes directly. The expected ground truth is shown next to the live digital blocks with the
// same diagram metrics scripts/eval.ts uses.
import { useEffect, useMemo, useRef, useState } from 'react';
import { newId, type InkStroke, type Page } from '../model/page';
import { canvasToScreen, fitToContent, type Viewport } from '../ink/ViewportManager';
import { renderStrokesToPng } from '../transcribe/render';
import { strokesBounds } from '../transcribe/regions';
import { SCENE_KINDS, buildScene, type Scene, type SceneKind } from './scenes';
import { diagramMetrics, pct, type FigureExpectation } from './metrics';
import { alignStrokes, replayStrokes } from './replay';

export interface SimulatorPanelProps {
  page: Page;
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  onInjectStrokes: (strokes: InkStroke[]) => void;
  onClearPage: () => void;
  onTranscribeNow: () => void;
}

const SPEEDS = [
  { value: 1, label: '1× (real time)' },
  { value: 3, label: '3×' },
  { value: 10, label: '10×' },
  { value: 40, label: '40×' },
];

interface Drawn {
  scene: Scene;
  /** Index of the first page stroke that belongs to this run. */
  startIndex: number;
}

export default function SimulatorPanel({ page, viewport, onViewportChange, onInjectStrokes, onClearPage, onTranscribeNow }: SimulatorPanelProps) {
  const [kind, setKind] = useState<SceneKind>('mixed-notes');
  const [seed, setSeed] = useState(1);
  const [speed, setSpeed] = useState(10);
  const [collapsed, setCollapsed] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const scene = useMemo(() => buildScene(kind, seed), [kind, seed]);
  const preview = useMemo(() => {
    const bounds = strokesBounds(scene.strokes);
    return bounds ? renderStrokesToPng(scene.strokes, bounds, { maxEdge: 480 })?.dataUrl : undefined;
  }, [scene]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const fitView = (target: Scene = scene) => {
    const el = document.querySelector<HTMLElement>('.ink-canvas');
    if (!el) return null;
    const vp = fitToContent(viewportRef.current, { left: 0, top: 0, right: target.width, bottom: target.height }, el.clientWidth, el.clientHeight, 16);
    viewportRef.current = vp;
    onViewportChange(vp);
    return el;
  };

  const draw = async () => {
    const el = fitView();
    if (!el) {
      setError('No ink canvas on screen — switch to the Ink or Split view.');
      return;
    }
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setProgress([0, scene.strokes.length]);
    setDrawn({ scene, startIndex: page.strokes.length });
    // Let React apply the fitted viewport before the first synthetic event is mapped through it.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const rect = el.getBoundingClientRect();
    const toClient = (p: { x: number; y: number }) => {
      const s = canvasToScreen(viewportRef.current, p);
      return { x: s.x + rect.left, y: s.y + rect.top };
    };
    await replayStrokes({ target: el, strokes: scene.strokes, speed, toClient, signal: ctrl.signal, onProgress: (d, t) => setProgress([d, t]) });
    setRunning(false);
    abortRef.current = null;
  };

  const instant = () => {
    setError(null);
    fitView();
    setDrawn({ scene, startIndex: page.strokes.length });
    setProgress([scene.strokes.length, scene.strokes.length]);
    const run = newId('sim');
    onInjectStrokes(scene.strokes.map((s) => ({ ...s, id: `${run}-${s.id}` })));
  };

  const stop = () => abortRef.current?.abort();

  const clear = () => {
    stop();
    setDrawn(null);
    setProgress(null);
    onClearPage();
  };

  // Map the scene's stroke ids onto the ids the page actually got (InkCanvas assigns fresh ids in Draw mode).
  const result = useMemo(() => {
    if (!drawn) return null;
    const got = page.strokes.slice(drawn.startIndex);
    const idMap = alignStrokes(drawn.scene.strokes, got);
    const figures: FigureExpectation[] = drawn.scene.figures.map((f) => ({
      id: f.id,
      type: f.type,
      labels: f.labels,
      strokeIds: f.strokeIds.map((id) => idMap.get(id) ?? id),
    }));
    return { metrics: diagramMetrics(figures, page.blocks), missing: drawn.scene.strokes.length - idMap.size, got: got.length };
  }, [drawn, page.strokes, page.blocks]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof SCENE_KINDS>();
    for (const k of SCENE_KINDS) m.set(k.group, [...(m.get(k.group) ?? []), k]);
    return [...m.entries()];
  }, []);

  return (
    <aside className={`sim-panel${collapsed ? ' collapsed' : ''}`} data-testid="sim-panel">
      <div className="sim-head">
        <strong>Simulator</strong>
        <label>
          Scene
          <select value={kind} onChange={(e) => setKind(e.target.value as SceneKind)} disabled={running}>
            {groups.map(([group, kinds]) => (
              <optgroup key={group} label={group}>
                {kinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Seed
          <input type="number" min={0} value={seed} onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))} disabled={running} />
        </label>
        <label>
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} disabled={running}>
            {SPEEDS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {running ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <button onClick={() => void draw()} title="Replay the scene through pointer events on the ink canvas">
            Draw
          </button>
        )}
        <button onClick={instant} disabled={running} title="Add the strokes to the page directly">
          Instant
        </button>
        <button onClick={onTranscribeNow} disabled={running}>
          Transcribe now
        </button>
        <button onClick={clear}>Clear page</button>
        <button onClick={() => fitView()}>Fit view</button>
        {progress && (
          <span className="progress">
            {progress[0]}/{progress[1]} strokes
          </span>
        )}
        {error && <span className="warn">{error}</span>}
        {!running && result && result.missing > 0 && <span className="warn">{result.missing} stroke(s) were not captured</span>}
        <span className="spacer" />
        <button className="icon" onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▴' : '▾'}
        </button>
      </div>
      {!collapsed && (
        <div className="sim-body">
          <div className="sim-col">
            <h4>Scene</h4>
            {preview && <img className="sim-preview" src={preview} alt={`Preview of ${scene.title}`} />}
            <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
              {scene.title} · {scene.strokes.length} strokes · {scene.width}×{scene.height}
            </p>
          </div>
          <div className="sim-col">
            <h4>Expected</h4>
            {scene.text ? <pre>{scene.text}</pre> : <p style={{ color: 'var(--muted)', margin: 0 }}>(no text — figure only)</p>}
            <ul className="sim-figures">
              {scene.figures.map((f) => {
                const score = result?.metrics.perFigure.find((p) => p.id === f.id);
                const cls = !score || page.blocks.length === 0 ? '' : score.detected ? 'ok' : 'miss';
                return (
                  <li key={f.id} className={cls}>
                    <span className="tag">{f.type}</span>
                    {f.description}
                    {f.labels.length > 0 && <div style={{ color: 'var(--muted)' }}>labels: {f.labels.join(', ')}</div>}
                    {score && page.blocks.length > 0 && (
                      <div style={{ color: 'var(--muted)' }}>
                        coverage {pct(score.coverage)} · foreign {pct(score.foreign)} · leaked {pct(score.leaked)} · labels {score.labelsFound.length}/{score.labels.length}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="sim-col">
            <h4>Result</h4>
            {result && page.blocks.length > 0 && (
              <div className="sim-metrics">
                <span>
                  <b>
                    {result.metrics.detected}/{result.metrics.figures}
                  </b>
                  figures found
                </span>
                <span>
                  <b>{pct(result.metrics.textLeak)}</b>text leak
                </span>
                <span>
                  <b>
                    {result.metrics.labelsFound}/{result.metrics.labels}
                  </b>
                  labels in caption
                </span>
                {result.metrics.spuriousDiagrams > 0 && (
                  <span>
                    <b>{result.metrics.spuriousDiagrams}</b>spurious diagrams
                  </span>
                )}
              </div>
            )}
            {page.blocks.length === 0 ? (
              <p style={{ color: 'var(--muted)', margin: 0 }}>No digital blocks yet — draw a scene and wait for the idle transcription (or press “Transcribe now”).</p>
            ) : (
              <div className="sim-blocks">
                {page.blocks.map((b) => (
                  <div key={b.id} className={b.kind}>
                    <span className="kind">
                      {b.kind} · {b.strokeIds.length} strokes
                    </span>
                    {b.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
