import { useState } from 'react';
import type { SubjectMap } from '../path/model';
import type { PathStep } from '../path/plan';
import { statusLabels, stepStatus } from '../path/tracker';
import type { LearningTracker } from '../path/useLearningPath';

export function StepBadge({ step, tracker }: { step: PathStep; tracker: LearningTracker }) {
  const next = tracker.next.includes(step.conceptId);
  const status = stepStatus(step, tracker.matches.get(step.conceptId), next, tracker.state.skipped.includes(step.conceptId));
  return <span className="path-badges">
    {status === 'partial' && next && <span className="path-badge" data-status="next">Next</span>}
    <span className="path-badge" data-status={status}>{statusLabels[status]}</span>
  </span>;
}

export function PathDependencies({ map, tracker }: { map: SubjectMap; tracker: LearningTracker }) {
  const [focus, setFocus] = useState<string>();
  const { plan, next } = tracker;
  const steps = new Map(plan.steps.map(s => [s.conceptId, s]));
  const selected = steps.get(focus ?? '') ?? steps.get(next[0]) ?? steps.get(plan.goals[0]);
  if (!selected) return null;
  const concept = map.concepts.find(c => c.id === selected.conceptId)!;
  const direct = concept.prerequisites.flatMap(id => steps.get(id) ?? []);
  const unlocks = selected.neededBy.flatMap(id => steps.get(id) ?? []);
  const reached = new Set<string>();
  function visit(id: string) {
    if (reached.has(id)) return;
    reached.add(id);
    steps.get(id)?.neededBy.forEach(visit);
  }
  visit(selected.conceptId);
  const goals = plan.goals.filter(id => reached.has(id)).map(id => steps.get(id)!.label);
  const node = (step: PathStep) => <button key={step.conceptId} type="button" className="btn path-node" onClick={() => setFocus(step.conceptId)}>
    <strong>{step.label}</strong><StepBadge step={step} tracker={tracker} />
  </button>;
  return (
    <section className="path-network" aria-label="Dependency picture">
      <div className="path-network-pick">
        <label>Focus concept
          <select className="input" value={selected.conceptId} onChange={e => setFocus(e.target.value)}>
            {plan.stages.map(stage => <optgroup key={stage.id} label={stage.title}>{stage.concepts.map(id =>
              <option key={id} value={id}>{steps.get(id)!.label}{plan.goals.includes(id) ? ' (goal)' : ''}</option>
            )}</optgroup>)}
          </select>
        </label>
        <div className="path-actions" aria-label="Focus a goal">{plan.goals.map(id =>
          <button key={id} type="button" className="btn" aria-pressed={id === selected.conceptId} onClick={() => setFocus(id)}>{steps.get(id)!.label}</button>
        )}</div>
      </div>
      <div className="path-network-lanes">
        <div className="path-lane"><h3>Prerequisites <span aria-hidden="true">→</span></h3>{direct.length ? direct.map(node) : <p>None</p>}</div>
        <div className="path-lane">
          <h3>Focus <span aria-hidden="true">→</span></h3>
          <div className="path-node current"><strong>{selected.label}</strong><StepBadge step={selected} tracker={tracker} /></div>
          <p>{goals.length ? `Goal route: ${goals.join(' · ')}` : 'No further goal in this route.'}</p>
        </div>
        <div className="path-lane"><h3>Needed by</h3>{unlocks.length ? unlocks.map(node) : <p>No downstream step</p>}</div>
      </div>
    </section>
  );
}
