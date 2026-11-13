// Pure helpers for the simulator's "Run suite": which scenes to replay back-to-back and how to
// summarise their scores. Kept free of React so it can be unit-tested.
import type { Messiness } from './ink';
import type { DiagramMetrics, RelationMetrics } from './metrics';
import type { SceneKind } from './scenes';

export interface SuiteItem {
  kind: SceneKind;
  seed: number;
  messiness: Messiness;
}

/** Relation-bearing kinds, hardest first; the suite cycles through them at normal then messy. */
export const SUITE_KINDS: SceneKind[] = [
  'flowchart-complex',
  'state-machine',
  'sequence-diagram',
  'timeline',
  'tree-deep',
  'graph-crossing',
  'nested-boxes',
  'venn',
  'table',
  'mind-map',
  'plot-multi',
  'bar-stacked',
  'unit-circle',
  'triangle-labelled',
  'notes-complex',
];

/** `count` scenes: each kind once at `normal`, then once at `messy`, seeds derived from `seed`. */
export function suitePlan(count: number, seed: number, kinds: SceneKind[] = SUITE_KINDS): SuiteItem[] {
  const out: SuiteItem[] = [];
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length];
    const round = Math.floor(i / kinds.length);
    out.push({ kind, seed: seed + i, messiness: round % 2 === 0 ? 'normal' : 'messy' });
  }
  return out;
}

export interface SuiteResult extends SuiteItem {
  title: string;
  diagrams: DiagramMetrics;
  relations: RelationMetrics;
  /** Wall-clock seconds from injection to the transcription settling. */
  seconds: number;
  timedOut?: boolean;
}

export interface SuiteSummary {
  scenes: number;
  figures: number;
  detected: number;
  labels: number;
  labelsFound: number;
  edges: number;
  edgesFound: number;
  predicted: number;
  predictedMatched: number;
  sequences: number;
  sequencesExact: number;
  contains: number;
  containsFound: number;
  countExact: number;
  seconds: number;
}

export function summariseSuite(results: SuiteResult[]): SuiteSummary {
  const s: SuiteSummary = { scenes: 0, figures: 0, detected: 0, labels: 0, labelsFound: 0, edges: 0, edgesFound: 0, predicted: 0, predictedMatched: 0, sequences: 0, sequencesExact: 0, contains: 0, containsFound: 0, countExact: 0, seconds: 0 };
  for (const r of results) {
    s.scenes++;
    s.figures += r.diagrams.figures;
    s.detected += r.diagrams.detected;
    s.labels += r.diagrams.labels;
    s.labelsFound += r.diagrams.labelsFound;
    s.edges += r.relations.edges;
    s.edgesFound += r.relations.edgesFound;
    s.predicted += r.relations.predicted;
    s.predictedMatched += r.relations.predictedMatched;
    s.sequences += r.relations.sequences;
    s.sequencesExact += r.relations.sequencesExact;
    s.contains += r.relations.contains;
    s.containsFound += r.relations.containsFound;
    if (r.relations.figureCountExact) s.countExact++;
    s.seconds += r.seconds;
  }
  return s;
}

export function suiteFailed(r: SuiteResult): boolean {
  return !!r.timedOut || !r.relations.figureCountExact || [
    [r.diagrams.detected, r.diagrams.figures], [r.diagrams.labelsFound, r.diagrams.labels],
    [r.relations.edgesFound, r.relations.edges], [r.relations.predictedMatched, r.relations.predicted],
    [r.relations.sequencesExact, r.relations.sequences], [r.relations.containsFound, r.relations.contains],
  ].some(([found, total]) => total > 0 && found < total);
}

export function aggregateSuite(results: SuiteResult[]) {
  const groups = new Map<SceneKind, SuiteResult[]>();
  for (const result of results) groups.set(result.kind, [...(groups.get(result.kind) ?? []), result]);
  return [...groups].map(([kind, scenes]) => ({ kind, results: scenes, summary: summariseSuite(scenes), normal: scenes.filter(r => r.messiness === 'normal').length, messy: scenes.filter(r => r.messiness === 'messy').length, failures: scenes.filter(suiteFailed).length }));
}

/** Markdown table of a suite run, for copying into a PR or issue. */
export function suiteMarkdown(results: SuiteResult[]): string {
  const s = summariseSuite(results);
  const frac = (a: number, b: number) => (b ? `${a}/${b}` : '—');
  const rows = results.map((r) =>
    `| ${r.kind} | ${r.messiness} | ${frac(r.diagrams.detected, r.diagrams.figures)} | ${frac(r.diagrams.labelsFound, r.diagrams.labels)} | ${frac(r.relations.edgesFound, r.relations.edges)} | ${frac(r.relations.predictedMatched, r.relations.predicted)} | ${frac(r.relations.sequencesExact, r.relations.sequences)} | ${frac(r.relations.containsFound, r.relations.contains)} | ${r.relations.figureCountExact ? '✓' : '✗'} | ${r.seconds.toFixed(0)}s${r.timedOut ? ' (timeout)' : ''} |`,
  );
  return [
    '| kind | normal | messy | figures | labels | edges | edge precision | order | nesting | count ok | time |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...aggregateSuite(results).map(g => {
      const s = g.summary;
      return `| ${g.kind} | ${g.normal} | ${g.messy} | ${frac(s.detected, s.figures)} | ${frac(s.labelsFound, s.labels)} | ${frac(s.edgesFound, s.edges)} | ${frac(s.predictedMatched, s.predicted)} | ${frac(s.sequencesExact, s.sequences)} | ${frac(s.containsFound, s.contains)} | ${s.countExact}/${s.scenes} | ${s.seconds.toFixed(0)}s |`;
    }),
    '',
    '| scene | messiness | figures | labels | edges | edge precision | sequences | nesting | count ok | time | seed | status |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((row, i) => `${row} ${results[i].seed} | ${suiteFailed(results[i]) ? 'fail' : 'ok'} |`),
    `| **total** | ${s.scenes} scenes | ${frac(s.detected, s.figures)} | ${frac(s.labelsFound, s.labels)} | ${frac(s.edgesFound, s.edges)} | ${frac(s.predictedMatched, s.predicted)} | ${frac(s.sequencesExact, s.sequences)} | ${frac(s.containsFound, s.contains)} | ${s.countExact}/${s.scenes} | ${s.seconds.toFixed(0)}s | — | ${results.filter(suiteFailed).length} failed |`,
  ].join('\n');
}
