import { useEffect, useMemo, useRef, useState } from 'react';
import type { Page } from '../model/page';
import type { ConceptEdgeKind, Provenance } from '../kb/model';
import type { ViewGraph } from '../kb/proposals';
import type { KbDecisions } from '../kb/decisions';
import { filterGraph, layoutGraph, neighbourhood } from '../kb/mapView';
import { Icon } from '../ui/icons';
import { Segmented } from '../ui/primitives';
import { ConceptDetail } from './ConceptDetail';
import { visibleLabels, zoomAt, type MapCamera } from './mapGestures';

const kinds: ConceptEdgeKind[] = ['contains', 'follows', 'supports', 'mentions'];
export function ConceptMap({ graph, pages, focused, onFocus, decide, onSource }: {
  graph: ViewGraph; pages: Page[]; focused: string | null; onFocus: (id: string | null) => void;
  decide: (fn: (d: KbDecisions) => KbDecisions) => void; onSource: (p: Provenance) => void;
}) {
  const [query, setQuery] = useState(''), [pageId, setPageId] = useState('');
  const [enabled, setEnabled] = useState(kinds), [depth, setDepth] = useState<'1' | '2'>('1');
  const [hovered, setHovered] = useState<string | null>(null);
  const [camera, setCamera] = useState<MapCamera>({ x: 0, y: 0, zoom: 1 });
  const [size, setSize] = useState({ width: 800, height: 500 });
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(entries => { const r = entries[0].contentRect; setSize({ width: r.width, height: r.height }); });
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const matching = useMemo(() => filterGraph(graph, { query, pageIds: pageId ? [pageId] : [] }).concepts, [graph, query, pageId]);
  const shown = useMemo(() => {
    const filtered = filterGraph(graph, { kinds: enabled, pageIds: pageId ? [pageId] : [] });
    filtered.edges = filtered.edges.filter(e => enabled.includes(e.kind));
    return focused ? neighbourhood(filtered, focused, Number(depth)) : filtered;
  }, [graph, enabled, pageId, focused, depth]);
  const positions = useMemo(() => layoutGraph(shown, { width: Math.max(100, size.width - 80), height: Math.max(100, size.height - 100), seed: 17 }), [shown, size]);
  const degrees = useMemo(() => { const result: Record<string, number> = {}; for (const e of shown.edges) { result[e.from] = (result[e.from] ?? 0) + 1; result[e.to] = (result[e.to] ?? 0) + 1; } return result; }, [shown]);
  const labels = useMemo(() => visibleLabels(shown.concepts.map(c => ({ id: c.id, label: c.label, ...positions[c.id], degree: degrees[c.id] ?? 0 })), camera, size, [focused, hovered, ...(query ? matching.map(c => c.id) : [])].filter((id): id is string => !!id)), [shown, positions, degrees, camera, size, focused, hovered, query, matching]);
  const fit = () => setCamera({ x: 40, y: 40, zoom: 1 });
  useEffect(() => { setCamera({ x: 40, y: 40, zoom: 1 }); }, [size, shown]);
  const active = graph.concepts.find(c => c.id === focused);
  return <div className={`kb-map ${active ? 'has-detail' : ''}`}>
    <div className="kb-map-main">
      <header className="kb-map-heading"><h1>Concept map <span className="badge">{graph.concepts.length}</span></h1></header>
      <div className="kb-controls"><div className="kb-search"><div className="input-wrap"><Icon name="search" size={16}/><input className="input" type="search" aria-label="Search concepts" placeholder="Find an idea or alias…" value={query} onChange={e => setQuery(e.target.value)} /></div>{query && <div className="kb-search-results">{matching.slice(0, 15).map(c => <button className="kb-list-item" key={c.id} onClick={() => { onFocus(c.id); setQuery(''); }}>{c.label}</button>)}{!matching.length && <p>No concepts found.</p>}</div>}</div><select className="input kb-page-filter" aria-label="Filter by page" value={pageId} onChange={e => setPageId(e.target.value)}><option value="">All pages</option>{pages.map(p => <option value={p.id} key={p.id}>{p.title}</option>)}</select><button className="btn" aria-label="Fit to screen" onClick={fit}>Fit</button></div>
      <div className="kb-filters"><div className="chip-row" aria-label="Edge kinds">{kinds.map(kind => <button key={kind} className={`chip kb-kind-${kind} ${enabled.includes(kind) ? 'is-active' : ''}`} aria-pressed={enabled.includes(kind)} onClick={() => setEnabled(prev => prev.includes(kind) ? prev.filter(k => k !== kind) : [...prev, kind])}><i />{kind}</button>)}</div>{active && <div className="kb-focus"><span>Focus: {active.label}</span><Segmented label="Neighbourhood depth" size="sm" value={depth} onChange={setDepth} options={[{ value: '1', label: '1 hop' }, { value: '2', label: '2 hops' }]} /><button className="btn ghost" onClick={() => onFocus(null)}>Clear focus</button></div>}</div>
      <div className="kb-map-frame" ref={frame}>
        <svg ref={svgRef} className="kb-map-svg" data-overview={shown.concepts.length > 35 && camera.zoom < 1.4 && !query} aria-label="Interactive concept map" onWheel={e => { const r = e.currentTarget.getBoundingClientRect(); setCamera(c => zoomAt(c, { x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.002))); }}
          onPointerDown={e => { moved.current = false; pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); }}
          onPointerMove={e => {
            const old = pointers.current.get(e.pointerId); if (!old) return;
            const next = { x: e.clientX, y: e.clientY }, others = [...pointers.current.entries()].filter(([id]) => id !== e.pointerId);
            if (Math.hypot(next.x - old.x, next.y - old.y) > 2) moved.current = true;
            if (others.length) { const other = others[0][1], r = e.currentTarget.getBoundingClientRect(); const before = Math.hypot(old.x - other.x, old.y - other.y), after = Math.hypot(next.x - other.x, next.y - other.y); if (before > 0) setCamera(c => zoomAt(c, { x: (next.x + other.x) / 2 - r.left, y: (next.y + other.y) / 2 - r.top }, after / before)); }
            else setCamera(c => ({ ...c, x: c.x + next.x - old.x, y: c.y + next.y - old.y }));
            pointers.current.set(e.pointerId, next);
          }} onPointerUp={e => { pointers.current.delete(e.pointerId); }} onPointerCancel={e => pointers.current.delete(e.pointerId)}>
          <defs>{kinds.map(kind => <marker key={kind} id={`arrow-${kind}`} viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" className={`kb-arrow kb-kind-${kind}`} /></marker>)}</defs>
          <g transform={`translate(${camera.x},${camera.y}) scale(${camera.zoom})`}>
            <g className="kb-hit-targets" aria-hidden="true">{shown.concepts.map(c => <circle key={c.id} cx={positions[c.id].x} cy={positions[c.id].y} r={Math.max(22, 22 / camera.zoom)} onClick={() => { if (!moved.current) onFocus(c.id); }} />)}</g>
            {shown.edges.map(e => { const a = positions[e.from], b = positions[e.to]; return a && b && <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`kb-edge kb-kind-${e.kind} ${graph.edges.find(x => x.id === e.id)?.status === 'suggested' ? 'suggested' : ''}`} markerEnd={e.kind === 'mentions' ? undefined : `url(#arrow-${e.kind})`} />; })}
            {shown.concepts.map(c => { const p = positions[c.id], suggested = graph.concepts.find(x => x.id === c.id)?.status === 'suggested', labelVisible = labels.has(c.id); return <g key={c.id} transform={`translate(${p.x},${p.y})`} className={`kb-node ${suggested ? 'suggested' : ''} ${c.id === focused ? 'focused' : ''}`} role="button" aria-label={`Concept: ${c.label}`} tabIndex={0} onPointerEnter={() => setHovered(c.id)} onPointerLeave={() => setHovered(null)} onClick={() => { if (!moved.current) onFocus(c.id); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(c.id); } }}><title>{c.label}{suggested ? ' · Suggested' : ''}</title><circle className="kb-node-hit" r={Math.max(22, 22 / camera.zoom)} /><circle r={c.id === focused ? 12 : 5 + Math.min(4, Math.sqrt(degrees[c.id] ?? 0))} />{labelVisible && <text y={-24 / camera.zoom} textAnchor="middle" style={{ fontSize: 12 / camera.zoom }}>{c.label}</text>}{suggested && labelVisible && <text className="kb-suggest-label" y={25 / camera.zoom} textAnchor="middle" style={{ fontSize: 10 / camera.zoom }}>Suggested</text>}</g>; })}
          </g>
        </svg>
        {!shown.concepts.length && <div className="kb-map-empty"><Icon name="map" size={32}/><h2>No concepts here yet</h2><p>Try another filter, or add headings and [[links]] to your notes.</p></div>}
        <div className="kb-map-caption">{shown.concepts.length} concepts · {shown.edges.length} connections <span>Drag to pan · scroll or pinch to zoom</span></div>
        <div className="kb-map-zoom"><button className="btn" aria-label="Zoom out map" onClick={() => setCamera(c => zoomAt(c, { x: size.width / 2, y: size.height / 2 }, 0.8))}>−</button><span>{Math.round(camera.zoom * 100)}%</span><button className="btn" aria-label="Zoom in map" onClick={() => setCamera(c => zoomAt(c, { x: size.width / 2, y: size.height / 2 }, 1.25))}>+</button></div>
      </div>
    </div>
    {active && <ConceptDetail key={active.id} graph={graph} pages={pages} conceptId={active.id} decide={decide} onFocus={onFocus} onSource={onSource} onClose={() => onFocus(null)} />}
  </div>;
}
