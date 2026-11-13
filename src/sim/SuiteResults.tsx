import { Fragment, useState } from 'react';
import { aggregateSuite, suiteFailed, summariseSuite, type SuiteResult, type SuiteSummary } from './suite';

const fraction = (found: number, total: number) => total ? `${found}/${total}` : '—';
function Scores({ s }: { s: SuiteSummary }) {
  return <><td>{fraction(s.detected, s.figures)}</td><td>{fraction(s.labelsFound, s.labels)}</td><td>{fraction(s.edgesFound, s.edges)}</td><td>{fraction(s.predictedMatched, s.predicted)}</td><td>{fraction(s.sequencesExact, s.sequences)}</td><td>{fraction(s.containsFound, s.contains)}</td><td>{fraction(s.countExact, s.scenes)}</td><td>{s.seconds.toFixed(1)}s</td></>;
}

export function SuiteResults({ results, running, onOpen, onCopy, copied }: { results: SuiteResult[]; running: boolean; onOpen: (r: SuiteResult) => void; onCopy: () => void; copied: boolean }) {
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups = aggregateSuite(results);
  return <section className="sim-suite" data-testid="sim-suite" aria-label="Suite results">
    <div className="sim-suite-actions"><h4>Suite results · {results.length} scenes{running ? ' · running' : ''}</h4>
      <label><input type="checkbox" checked={failuresOnly} onChange={e => setFailuresOnly(e.target.checked)} />Failures only</label>
      <button onClick={onCopy} disabled={!results.length}>{copied ? 'Copied' : 'Copy as Markdown'}</button>
    </div>
    <div className="sim-table-scroll" tabIndex={0} role="region" aria-label="Suite score table"><table>
      <thead><tr>{['Kind / scene', 'Normal / messy', 'Figures', 'Labels', 'Edges', 'Precision', 'Order', 'Nesting', 'Count ok', 'Time', 'Status / action'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
      <tbody>{groups.filter(g => !failuresOnly || g.failures > 0).map(g => <Fragment key={g.kind}>
        <tr className={g.failures === 0 ? 'ok' : g.failures < g.results.length ? 'partial' : 'fail'}>
          <th scope="row"><button aria-expanded={expanded.has(g.kind)} aria-controls={g.results.map(r => `suite-${g.kind}-${r.seed}-${r.messiness}`).join(' ')} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(g.kind)) next.delete(g.kind); else next.add(g.kind); return next; })}>{expanded.has(g.kind) ? '−' : '+'} {g.kind}</button></th>
          <td>{g.normal} / {g.messy}</td><Scores s={g.summary} /><td>{g.failures ? `${g.failures} failed` : 'OK'}</td>
        </tr>
          {g.results.map(r => <tr id={`suite-${g.kind}-${r.seed}-${r.messiness}`} hidden={!expanded.has(g.kind) || (failuresOnly && !suiteFailed(r))} key={`${r.seed}-${r.messiness}`} className={`sim-scene-row ${suiteFailed(r) ? 'fail' : 'ok'}`}>
            <th scope="row" title={r.title}>↳ Seed {r.seed}</th><td>{r.messiness}</td><Scores s={summariseSuite([r])} /><td>{r.timedOut ? 'Timeout' : suiteFailed(r) ? 'Fail' : 'OK'} <button disabled={running} aria-label={`Open ${r.kind} seed ${r.seed} ${r.messiness}`} onClick={() => onOpen(r)}>Open</button></td>
          </tr>)}
      </Fragment>)}</tbody>
      <tfoot><tr><th scope="row">Total · {results.length} scenes</th><td>{results.filter(r => r.messiness === 'normal').length} / {results.filter(r => r.messiness === 'messy').length}</td><Scores s={summariseSuite(results)} /><td>{results.filter(suiteFailed).length} failed</td></tr></tfoot>
    </table></div>
    {!results.length && <p>{running ? 'Waiting for the first scene…' : 'No completed scenes.'}</p>}
    {failuresOnly && results.length > 0 && !results.some(suiteFailed) && <p>No failures.</p>}
  </section>;
}
