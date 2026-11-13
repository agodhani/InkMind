// Dev-only drawing simulator. Mounted by App when the URL has ?sim=1.
// "Draw" replays a synthetic scene through real pointer events on the InkCanvas; "Instant" injects the
// strokes directly. The expected ground truth (text, figures, relations, step order) is shown next to
// the live digital blocks with the same diagram + relation metrics scripts/eval.ts uses, and
// "Run suite" replays N relation-bearing scenes back-to-back and summarises them.
import { useEffect, useMemo, useRef, useState } from 'react';
import { newId, type DigitalBlock, type InkStroke, type Page } from '../model/page';
import { canvasToScreen, fitToContent, type Viewport } from '../ink/ViewportManager';
import { renderStrokesToPng } from '../transcribe/render';
import { strokesBounds } from '../transcribe/regions';
import { MESSINESS_LEVELS, type Messiness } from './ink';
import { SCENE_KINDS, buildScene, type Scene, type SceneKind } from './scenes';
import { diagramMetrics, edgeMatches, pct, predictedEdges, relationMetrics, type FigureExpectation } from './metrics';
import { alignStrokes, replayStrokes } from './replay';
import { suiteMarkdown, suitePlan, type SuiteResult } from './suite';
import { expectedBlocks } from './expectedBlocks';
import { SuiteResults } from './SuiteResults';

export interface SimulatorPanelProps {
  page: Page;
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  onInjectStrokes: (strokes: InkStroke[]) => void;
  onSetBlocks: (blocks: DigitalBlock[], strokes: InkStroke[]) => void;
  onClearPage: () => void;
  onTranscribeNow: () => void;
  /** Called before a replay so the canvas is in pen mode (an eraser would erase instead of draw). */
  onBeforeDraw: () => void;
  /** Live transcription state; lets "Run suite" wait for each scene's transcription to settle. */
  transcriptionState?: 'idle' | 'waiting' | 'running' | 'error';
}

const SUITE_SIZES = [4, 8, 15, 30];
const SUITE_TIMEOUT_MS = 6 * 60_000;
const NO_TRANSCRIPTION_MS = 20_000;

interface Drawn {
  scene: Scene;
  /** Index of the first page stroke that belongs to this run. */
  startIndex: number;
}

function expectations(scene: Scene, idMap: Map<string, string>): FigureExpectation[] {
  return scene.figures.map((f) => ({
    id: f.id,
    type: f.type,
    labels: f.labels,
    strokeIds: f.strokeIds.map((id) => idMap.get(id) ?? id),
    ...(f.nodes ? { nodes: f.nodes } : {}),
    ...(f.edges ? { edges: f.edges } : {}),
    ...(f.directed === false ? { directed: false } : {}),
    ...(f.sequence ? { sequence: f.sequence } : {}),
    ...(f.contains ? { contains: f.contains } : {}),
  }));
}

/** Score a drawn scene against the page: map scene stroke ids onto the ids the page assigned, then run both metric sets. */
function scoreScene(drawn: Drawn, pageStrokes: InkStroke[], blocks: DigitalBlock[]) {
  const got = pageStrokes.slice(drawn.startIndex);
  const idMap = alignStrokes(drawn.scene.strokes, got);
  const figures = expectations(drawn.scene, idMap);
  return { metrics: diagramMetrics(figures, blocks), relations: relationMetrics(figures, blocks), missing: drawn.scene.strokes.length - idMap.size, got: got.length };
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function SimulatorPanel({ page, viewport, onViewportChange, onInjectStrokes, onSetBlocks, onClearPage, onTranscribeNow, onBeforeDraw, transcriptionState = 'idle' }: SimulatorPanelProps) {
  const [kind, setKind] = useState<SceneKind>('flowchart-complex');
  const [seed, setSeed] = useState(1);
  const [messiness, setMessiness] = useState<Messiness>('normal');
  const [speed, setSpeed] = useState(10);
  const [collapsed, setCollapsed] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suiteSize, setSuiteSize] = useState(8);
  const [suiteDraw, setSuiteDraw] = useState(false);
  const [suite, setSuite] = useState<{ running: boolean; current: number; plan: ReturnType<typeof suitePlan>; results: SuiteResult[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Seed the current suite series started from; cleared when the user edits the seed. */
  const suiteBase = useRef<number | null>(null);
  const viewportRef = useRef(viewport);
  const pageRef = useRef(page);
  const stateRef = useRef(transcriptionState);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    stateRef.current = transcriptionState;
  }, [transcriptionState]);

  const scene = useMemo(() => buildScene(kind, seed, messiness), [kind, seed, messiness]);
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

  /** Replay `target` through pointer events; resolves when done or aborted. */
  const replay = async (target: Scene, signal: AbortSignal) => {
    const el = fitView(target);
    if (!el) {
      setError('No ink canvas on screen — switch to the Ink or Split view.');
      return false;
    }
    setError(null);
    onBeforeDraw();
    setProgress([0, target.strokes.length]);
    setDrawn({ scene: target, startIndex: pageRef.current.strokes.length });
    // Let React apply the fitted viewport before the first synthetic event is mapped through it.
    await nextFrame();
    const rect = el.getBoundingClientRect();
    const toClient = (p: { x: number; y: number }) => {
      const s = canvasToScreen(viewportRef.current, p);
      return { x: s.x + rect.left, y: s.y + rect.top };
    };
    await replayStrokes({ target: el, strokes: target.strokes, speed, toClient, signal, onProgress: (d, t) => setProgress([d, t]) });
    return true;
  };

  const draw = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    await replay(scene, ctrl.signal);
    setRunning(false);
    abortRef.current = null;
  };

  const inject = (target: Scene, startIndex = pageRef.current.strokes.length, expected = false) => {
    setError(null);
    fitView(target);
    setDrawn({ scene: target, startIndex: expected ? 0 : startIndex });
    setProgress([target.strokes.length, target.strokes.length]);
    const run = newId('sim');
    const idMap = new Map(target.strokes.map(s => [s.id, `${run}-${s.id}`]));
    const strokes = target.strokes.map(s => ({ ...s, id: idMap.get(s.id)! }));
    if (expected) onSetBlocks(expectedBlocks(target, idMap), strokes);
    else onInjectStrokes(strokes);
  };

  const stop = () => abortRef.current?.abort();

  const clear = () => {
    stop();
    setDrawn(null);
    setProgress(null);
    onClearPage();
  };

  /**
   * Wait until a transcription has run for the current page and settled (idle/error), or time out.
   * Only a `running` state counts as "seen": `waiting` is the idle timer, and the hook may briefly
   * report `idle` before the request starts.
   */
  const waitSettled = async (signal: AbortSignal) => {
    const started = performance.now();
    let sawRunning = false;
    while (!signal.aborted && performance.now() - started < SUITE_TIMEOUT_MS) {
      const st = stateRef.current;
      if (st === 'running') sawRunning = true;
      else if (!sawRunning && performance.now() - started > NO_TRANSCRIPTION_MS) {
        // Nothing ever started: live transcription is off (or no transcriber) — don't sit out the full timeout.
        setError('No transcription started — enable “Transcribe while I write” in Settings for the suite to score scenes.');
        return true;
      } else if (st === 'idle' || st === 'error') {
        if (sawRunning) return false;
        // The request finished before our first poll (fast model): blocks exist and nothing is pending.
        if (pageRef.current.blocks.length > 0 && performance.now() - started > 4000) return false;
      }
      await sleep(250);
    }
    return !signal.aborted;
  };

  const runSuite = async () => {
    // Re-running an unchanged suite replays the same scenes even though the pickers now follow the suite.
    const base = suiteBase.current ?? seed;
    suiteBase.current = base;
    const plan = suitePlan(suiteSize, base);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const results: SuiteResult[] = [];
    setSuite({ running: true, current: 0, plan, results });
    setRunning(true);
    for (let i = 0; i < plan.length && !ctrl.signal.aborted; i++) {
      const item = plan[i];
      setSuite({ running: true, current: i, plan, results: [...results] });
      const target = buildScene(item.kind, item.seed, item.messiness);
      // Keep the Scene/Expected columns on the scene being replayed.
      setKind(item.kind);
      setSeed(item.seed);
      setMessiness(item.messiness);
      onClearPage();
      await nextFrame();
      const t0 = performance.now();
      const run: Drawn = { scene: target, startIndex: 0 };
      if (suiteDraw) {
        if (!(await replay(target, ctrl.signal))) break;
      } else inject(target, 0);
      // Give the page state a moment to hold the new strokes before asking for a transcription.
      await sleep(300);
      onTranscribeNow();
      const timedOut = await waitSettled(ctrl.signal);
      if (ctrl.signal.aborted) break;
      const cur = pageRef.current;
      const sc = scoreScene(run, cur.strokes, cur.blocks);
      results.push({ ...item, title: target.title, diagrams: sc.metrics, relations: sc.relations, seconds: (performance.now() - t0) / 1000, ...(timedOut ? { timedOut } : {}) });
    }
    setSuite({ running: false, current: -1, plan, results: [...results] });
    setRunning(false);
    abortRef.current = null;
  };

  const copySuite = async () => {
    if (!suite) return;
    try {
      await navigator.clipboard.writeText(suiteMarkdown(suite.results));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Clipboard unavailable');
    }
  };

  const openScene = async (item: SuiteResult) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setKind(item.kind); setSeed(item.seed); setMessiness(item.messiness);
    onClearPage();
    await nextFrame();
    inject(buildScene(item.kind, item.seed, item.messiness), 0);
    await sleep(300);
    onTranscribeNow();
    await waitSettled(ctrl.signal);
    setRunning(false);
    abortRef.current = null;
  };

  // Map the scene's stroke ids onto the ids the page actually got (InkCanvas assigns fresh ids in Draw mode).
  const result = useMemo(() => (drawn ? scoreScene(drawn, page.strokes, page.blocks) : null), [drawn, page.strokes, page.blocks]);
  const claimed = useMemo(() => predictedEdges(page.blocks), [page.blocks]);
  const scored = !!result && page.blocks.length > 0;

  const groups = useMemo(() => {
    const m = new Map<string, typeof SCENE_KINDS>();
    for (const k of SCENE_KINDS) m.set(k.group, [...(m.get(k.group) ?? []), k]);
    return [...m.entries()];
  }, []);

  const frac = (a: number, b: number) => (b ? `${a}/${b}` : '—');

  return (
    <aside className={`sim-panel${collapsed ? ' collapsed' : ''}`} data-testid="sim-panel">
      <div className="sim-title"><strong>Simulator</strong><span>Scene · Run · Suite</span><button aria-expanded={!collapsed} aria-controls="sim-content" aria-label={collapsed ? 'Expand simulator' : 'Collapse simulator'} onClick={() => setCollapsed(v => !v)}>{collapsed ? 'Expand ▴' : 'Collapse ▾'}</button></div>
      {!collapsed && <div className="sim-scroll" id="sim-content">
      <div className="sim-head">
        <fieldset><legend>Scene</legend>
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
          <input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => {
              suiteBase.current = null;
              setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)));
            }}
            disabled={running}
          />
        </label>
        <span className="sim-seg" role="group" aria-label="Messiness" title="How steady the simulated hand is: scales jitter, wobble, corner overshoot and gaps">
          {MESSINESS_LEVELS.map((m) => (
            <button key={m} type="button" aria-pressed={messiness === m} onClick={() => setMessiness(m)} disabled={running}>
              {m}
            </button>
          ))}
        </span>
        </fieldset><fieldset><legend>Run</legend>
        <label>
          Speed
          <input type="range" min={0} max={100} value={Math.log(speed) / Math.log(40) * 100} onChange={e => setSpeed(Math.pow(40, Number(e.target.value) / 100))} aria-valuetext={`${speed.toFixed(1)}×`} disabled={running} /><output>{speed.toFixed(1)}×</output>
        </label>
        {running ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <button onClick={() => void draw()} title="Replay the scene through pointer events on the ink canvas">
            Draw
          </button>
        )}
        <button onClick={() => inject(scene)} disabled={running} title="Add the strokes to the page directly">
          Instant
        </button>
        <button onClick={() => inject(scene, 0, true)} disabled={running} title="Replace page ink and digital blocks with the scene ground truth; no model call">Instant + expected blocks</button>
        <button onClick={onTranscribeNow} disabled={running}>
          Transcribe now
        </button>
        <button onClick={clear} disabled={running}>Clear page</button>
        <button onClick={() => fitView()} disabled={running}>Fit view</button>
        </fieldset><fieldset><legend>Suite</legend>
        <label title="Replay N relation-bearing scenes back-to-back (normal, then messy), transcribe each and summarise">
          Suite
          <select value={suiteSize} onChange={(e) => setSuiteSize(Number(e.target.value))} disabled={running}>
            {SUITE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} scenes
              </option>
            ))}
          </select>
          <input type="checkbox" checked={suiteDraw} onChange={(e) => setSuiteDraw(e.target.checked)} disabled={running} title="Replay through pointer events at the chosen speed instead of injecting strokes" /> draw
        </label>
        <button className="primary" onClick={() => void runSuite()} disabled={running} data-testid="sim-run-suite">
          Run suite
        </button>
        </fieldset>
        {progress && (
          <span className="progress">
            {progress[0]}/{progress[1]} strokes
          </span>
        )}
        {suite?.running && (
          <span className="progress">
            suite {suite.current + 1}/{suite.plan.length} · {suite.plan[suite.current]?.kind} ({suite.plan[suite.current]?.messiness}) · {transcriptionState}
          </span>
        )}
        {error && <span className="warn">{error}</span>}
        {!running && result && result.missing > 0 && <span className="warn">{result.missing} stroke(s) were not captured</span>}
      </div>
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
                const cls = !score || !scored ? '' : score.detected ? 'ok' : 'miss';
                const seq = scored ? result?.relations.perSequence.find((p) => p.id === f.id) : undefined;
                const positions = seq?.positions ?? null;
                return (
                  <li key={f.id} className={cls}>
                    <span className="tag">{f.type}</span>
                    {f.description}
                    {f.labels.length > 0 && <div style={{ color: 'var(--muted)' }}>labels: {f.labels.join(', ')}</div>}
                    {f.edges && f.edges.length > 0 && (
                      <ul className="sim-rel" aria-label="expected relations">
                        {f.edges.map((e, i) => {
                          const hit = scored ? claimed.some((g) => edgeMatches(e, g, f.directed !== false)) : null;
                          return (
                            <li key={i} className={hit === null ? '' : hit ? 'ok' : 'miss'}>
                              {e.from} {f.directed === false ? '—' : '→'} {e.to}
                              {e.label && <span className="lbl">({e.label})</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {f.sequence && (
                      <div className="sim-seq" aria-label="expected order">
                        order{seq ? (seq.structured ? ' (structured)' : ' (caption)') : ''}:{' '}
                        {f.sequence.map((s, i) => (
                          <span key={i} className={positions ? (positions[i] === null ? 'miss' : 'ok') : ''}>
                            {i > 0 && ' › '}
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {f.contains && f.contains.length > 0 && (
                      <div className="sim-seq">nesting: {f.contains.map((c) => `${c.inner} ⊂ ${c.outer}`).join(', ')}</div>
                    )}
                    {score && scored && (
                      <div style={{ color: 'var(--muted)' }}>
                        coverage {pct(score.coverage)} · foreign {pct(score.foreign)} · leaked {pct(score.leaked)} · labels {score.labelsFound.length}/{score.labels.length}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {scene.links.length > 0 && <div className="sim-seq">arrows between figures: {scene.links.map((l) => `${l.from} → ${l.to}`).join(', ')}</div>}
          </div>
          <div className="sim-col">
            <h4>Result</h4>
            {result && scored && (
              <div className="sim-metrics" data-testid="sim-metrics">
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
                {result.relations.edges > 0 && (
                  <span title="expected relations found / claimed relations that match">
                    <b>
                      {result.relations.edgesFound}/{result.relations.edges}
                    </b>
                    edges · precision {frac(result.relations.predictedMatched, result.relations.predicted)}
                  </span>
                )}
                {result.relations.sequences > 0 && (
                  <span title="step lists reproduced in exact order; τ = Kendall tau of the steps found">
                    <b>
                      {result.relations.sequencesExact}/{result.relations.sequences}
                    </b>
                    order exact · τ {result.relations.sequenceTau ?? '—'}
                  </span>
                )}
                {result.relations.contains > 0 && (
                  <span>
                    <b>
                      {result.relations.containsFound}/{result.relations.contains}
                    </b>
                    nesting
                  </span>
                )}
                <span title="diagram blocks vs expected figures">
                  <b>
                    {result.relations.diagramBlocks}/{result.relations.expectedFigures}
                  </b>
                  diagram blocks {result.relations.figureCountExact ? '✓' : '✗'}
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
        {suite && <SuiteResults results={suite.results} running={running} onOpen={r => void openScene(r)} onCopy={() => void copySuite()} copied={copied} />}
      </div>}
    </aside>
  );
}
