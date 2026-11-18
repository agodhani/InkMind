import { useId, useRef, useState } from 'react';
import type { Page } from '../model/page';
import type { PathMaterials, PathMaterialsProvider } from '../path/materials';
import type { SubjectMap } from '../path/model';
import type { PathPlan, PathStep } from '../path/plan';
import { noteSources, pathReason, searchConcepts, type NoteSource } from '../path/tracker';
import type { LearningTracker } from '../path/useLearningPath';
import { Icon } from '../ui/icons';
import { Drawer } from '../ui/primitives';
import { PathDependencies, StepBadge } from './PathDependencies';

interface PathContext {
  tracker: LearningTracker;
  onStartNotes: (label: string) => void;
}

function Unverified({ plan }: { plan: PathPlan }) {
  if (plan.provenance.status === 'verified' || !plan.goals.length) return null;
  return <p className="path-warning"><Icon name="alert" /> <span><strong>Unverified subject map.</strong> Check its prerequisites before relying on this plan.</span></p>;
}

function LearningMaterials({ materials }: { materials?: PathMaterials }) {
  return <div className="path-materials">
    <div><strong>Resources</strong>{materials?.resources?.length ? <ul>{materials.resources.map(link => <li key={link.href}><a className="btn" href={link.href} target="_blank" rel="noreferrer">{link.title}</a></li>)}</ul> : <p>No resources listed yet.</p>}</div>
    <div><strong>Project</strong>{materials?.project ? <a className="btn" href={materials.project.href} target="_blank" rel="noreferrer">{materials.project.title}</a> : <p>No project listed yet.</p>}</div>
  </div>;
}

function NextSteps({ tracker, onStartNotes, onSetGoal }: PathContext & { onSetGoal?: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const { plan, next, ready } = tracker;
  if (!plan.goals.length) return <div className="path-empty">
    <p>Pick a concept you want to learn. InkMind will use your notes to suggest what to study first.</p>
    {onSetGoal && <button type="button" className="btn tone-primary" onClick={onSetGoal}>Set a goal</button>}
  </div>;
  if (!ready) return <p role="status">Checking your notes…</p>;
  if (!next.length) return <p>{plan.steps.every(s => s.status === 'done') ? 'Your notes and declarations cover this path.' : 'No unskipped step is ready. Restore a skipped prerequisite to continue.'}</p>;
  const byId = new Map(plan.steps.map(s => [s.conceptId, s]));
  return <>
    <ol className="path-next-list">
      {(showAll ? next : next.slice(0, 3)).map(id => {
        const step = byId.get(id)!;
        return <li key={id} className="path-next-card">
          <div className="path-row"><h3>{step.label}</h3><StepBadge step={step} tracker={tracker} /></div>
          <p>{pathReason(step)}.</p>
          <button type="button" className="btn" onClick={() => onStartNotes(step.label)}><Icon name="pen" /> Start notes</button>
        </li>;
      })}
    </ol>
    {next.length > 3 && <button type="button" className="btn ghost" aria-expanded={showAll} onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer next steps' : `Show all ${next.length} ready steps`}</button>}
    <p className="path-help">Start a page with the concept as its title. Use that name as a heading in your notes so InkMind can match it.</p>
  </>;
}

export function WhatNextDrawer({ open, onClose, onPath, ...context }: PathContext & { open: boolean; onClose: () => void; onPath: () => void }) {
  return <Drawer open={open} side="right" title="What next?" onClose={onClose}>
    {open && <div className="path-drawer path-stack">
      <Unverified plan={context.tracker.plan} />
      <NextSteps {...context} onSetGoal={onPath} />
      {!!context.tracker.plan.goals.length && <button type="button" className="btn tone-primary" onClick={onPath}>Open learning path</button>}
    </div>}
  </Drawer>;
}

function ConceptPicker({ map, tracker, mode }: { map: SubjectMap; tracker: LearningTracker; mode: 'goals' | 'declared' }) {
  const input = useId();
  const [query, setQuery] = useState('');
  const selected = tracker.state[mode];
  const matches = searchConcepts(map, query);
  return <div className="path-picker">
    <label htmlFor={input}>{mode === 'goals' ? 'Find a learning goal' : 'Find a concept you already know'}</label>
    <input id={input} className="input" type="search" placeholder="Search by name or alias" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="path-picker-results" aria-label={mode === 'goals' ? 'Goal results' : 'Declaration results'}>
      {matches.map(c => <button key={c.id} type="button" className="btn path-result" aria-pressed={selected.includes(c.id)} onClick={() => tracker.toggle(mode, c.id)}>
        <span>{c.label}{c.aliases.length > 0 && <small>{c.aliases.join(' · ')}</small>}</span>
        <Icon name={selected.includes(c.id) ? 'check' : 'plus'} />
      </button>)}
      {!matches.length && <p>No concept matches “{query}”.</p>}
    </div>
  </div>;
}

function SelectedConcepts({ map, tracker, mode }: { map: SubjectMap; tracker: LearningTracker; mode: 'goals' | 'declared' }) {
  return <ul className="path-selections">{tracker.state[mode].map(id => {
    const label = map.concepts.find(c => c.id === id)!.label;
    return <li key={id}><button type="button" className="btn" aria-label={`${mode === 'goals' ? 'Remove goal' : 'Undo declaration'}: ${label}`} onClick={() => tracker.toggle(mode, id)}>{label}<Icon name="close" size={14} /></button></li>;
  })}</ul>;
}

interface LearningPathProps extends PathContext {
  map: SubjectMap;
  pages: Page[];
  onSource: (source: NoteSource) => void;
  materials?: PathMaterialsProvider;
}

function StepDetails({ step, tracker, pages, onSource, onStartNotes, materials }: Pick<LearningPathProps, 'tracker' | 'pages' | 'onSource' | 'onStartNotes'> & { step: PathStep; materials?: PathMaterials }) {
  const sources = noteSources(step.evidence).flatMap(source => {
    const page = pages.find(p => p.id === source.pageId && p.blocks.some(b => b.id === source.blockId));
    return page ? [{ source, title: page.title || 'Untitled page' }] : [];
  });
  const skipped = tracker.state.skipped.includes(step.conceptId);
  return <details className="path-step">
    <summary className="path-row">
      <span className="path-summary-label"><Icon name="chevron-down" /><strong>{step.label}</strong>{step.goal && <span className="path-badge">Goal</span>}</span>
      <StepBadge step={step} tracker={tracker} />
    </summary>
    <div className="path-step-body path-stack">
      <p>{step.description}</p>
      <p><strong>Why this step:</strong> {pathReason(step)}.</p>
      {!!sources.length && <div className="path-stack"><strong>Note evidence</strong><ul className="path-source-list">
        {sources.map(({ source, title }) => <li key={JSON.stringify([source.pageId, source.blockId])}>
          <button type="button" className="btn" onClick={() => onSource(source)}><Icon name="file" /><span>{title} — {source.surface}</span></button>
        </li>)}
      </ul></div>}
      <LearningMaterials materials={materials} />
      {(step.status !== 'done' || skipped) && <div className="path-actions">
        {step.status !== 'done' && <button type="button" className="btn" onClick={() => onStartNotes(step.label)}><Icon name="pen" /> Start notes</button>}
        <button type="button" className="btn ghost" onClick={() => tracker.toggle('skipped', step.conceptId)}>{skipped ? 'Restore skipped step' : 'Skip this step'}</button>
        {skipped && <p className="path-help">Skipping hides a recommendation; it does not satisfy prerequisites.</p>}
      </div>}
    </div>
  </details>;
}

export function LearningPath({ map, tracker, pages, onSource, onStartNotes, materials }: LearningPathProps) {
  const [picker, setPicker] = useState<'goals' | 'declared' | null>(() => tracker.plan.goals.length ? null : 'goals');
  const [stageOverrides, setStageOverrides] = useState<Record<string, boolean>>({});
  const editor = useRef<HTMLElement>(null);
  const { plan, changes, next, ready } = tracker;
  const byId = new Map(plan.steps.map(s => [s.conceptId, s]));
  const done = plan.steps.filter(s => s.status === 'done').length;
  const spotlight = byId.get(next[0])?.stage;
  const changed = changes.done.length > 0 || changes.lost.length > 0;
  return <section className="learning-path" aria-label="Learning path">
    <div className="path-content">
      <header className="path-hero">
        <div><p className="path-kicker">{map.subject} · Study planner</p><h1>Learning path</h1><p>Plan what to learn next from the concepts in your notes.</p></div>
        {ready && !!plan.steps.length && <div className="path-total"><strong>{done} / {plan.steps.length}</strong><span>steps covered</span><progress value={done} max={plan.steps.length} aria-label="Path steps covered" /></div>}
      </header>
      {tracker.storageError && <p className="path-warning" role="alert">{tracker.storageError}</p>}
      <Unverified plan={plan} />
      {ready && changed && <div className="path-update">
        <div className="path-stack" role="status">
          {changes.done.length > 0 && <strong>{changes.done.length} {changes.done.length === 1 ? 'step' : 'steps'} done from notes since last time</strong>}
          {changes.lost.length > 0 && <span>{changes.lost.length} {changes.lost.length === 1 ? 'step lost' : 'steps lost'} note evidence since last time</span>}
        </div>
        <button type="button" className="btn" onClick={tracker.acknowledge}>Mark seen</button>
      </div>}
      <section ref={editor} className="path-panel path-stack" aria-label="Goals and prior knowledge">
        <div className="path-row"><h2>Your goals</h2><div className="path-actions">
          <button type="button" className="btn" aria-expanded={picker === 'goals'} onClick={() => setPicker(v => v === 'goals' ? null : 'goals')}><Icon name="plus" /> Edit goals</button>
          <button type="button" className="btn" aria-expanded={picker === 'declared'} onClick={() => setPicker(v => v === 'declared' ? null : 'declared')}>I already know…</button>
        </div></div>
        {plan.goals.length ? <SelectedConcepts map={map} tracker={tracker} mode="goals" /> : <p>No goal selected.</p>}
        {!!tracker.state.declared.length && <div className="path-declarations"><strong>Declared knowledge</strong><SelectedConcepts map={map} tracker={tracker} mode="declared" /></div>}
        {picker && <ConceptPicker key={picker} map={map} tracker={tracker} mode={picker} />}
      </section>
      <section className="path-panel path-stack path-next" aria-label="Recommended next steps">
        <div className="path-row"><h2>What next?</h2>{!!next.length && ready && <span className="path-badge" data-status="next">{next.length} ready</span>}</div>
        <NextSteps tracker={tracker} onStartNotes={onStartNotes} onSetGoal={picker === 'goals' ? undefined : () => { setPicker('goals'); editor.current?.scrollIntoView({ block: 'nearest' }); }} />
      </section>
      {ready && !!plan.steps.length && <>
        <details className="path-panel path-dependency">
          <summary className="path-row"><span className="path-summary-label"><Icon name="chevron-down" /><strong>Dependency picture</strong></span><span>What you have → what the goals need</span></summary>
          <PathDependencies map={map} tracker={tracker} />
        </details>
        <section className="path-stack" aria-label="Stages">
          <div className="path-row"><h2>Stages</h2><span className="path-help">Coverage includes notes, declarations, and assumed prerequisites.</span></div>
          {plan.stages.map((stage, index) => {
            const steps = stage.concepts.map(id => byId.get(id)!);
            const stageDone = steps.filter(s => s.status === 'done').length;
            const skipped = steps.filter(s => s.status !== 'done' && tracker.state.skipped.includes(s.conceptId)).length;
            const isOpen = stageOverrides[stage.id] ?? stage.id === spotlight;
            return <details key={stage.id} className="path-panel path-stage" open={isOpen}>
              <summary className="path-row" onClick={e => { e.preventDefault(); setStageOverrides(v => ({ ...v, [stage.id]: !isOpen })); }}>
                <span className="path-summary-label"><Icon name="chevron-down" /><span className="path-stage-index">{String(index + 1).padStart(2, '0')}</span><strong>{stage.title}</strong></span>
                <span className="path-stage-progress"><progress value={stageDone} max={steps.length} aria-label={`${stage.title} steps covered`} />{stageDone}/{steps.length} covered{skipped > 0 && ` · ${skipped} skipped`}</span>
              </summary>
              <div className="path-stage-body path-stack">
                <ol className="path-step-list">{steps.map(step => <li key={step.conceptId}><StepDetails step={step} tracker={tracker} pages={pages} onSource={onSource} onStartNotes={onStartNotes} materials={materials?.forStep(plan.mapId, step.conceptId)} /></li>)}</ol>
                <LearningMaterials materials={materials?.forStage(plan.mapId, stage.id)} />
              </div>
            </details>;
          })}
        </section>
      </>}
    </div>
  </section>;
}
