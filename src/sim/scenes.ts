import type { InkStroke } from '../model/page';
import type { FigureExpectation } from './metrics';
import { formatReferencePage } from './metrics';
import { MESS_PROFILES, InkWriter, inkStyleFor, type Messiness } from './ink';
import { Rng } from './rng';
import {
  drawBarValues,
  drawFlowchartComplex,
  drawGraphCrossing,
  drawMindMap,
  drawNested,
  drawNumberLine,
  drawPlotMulti,
  drawSequenceDiagram,
  drawStateMachine,
  drawTable,
  drawTimeline,
  drawTreeDeep,
  drawTriangleLabelled,
  drawUnitCircle,
  drawVenn,
  type FlowSpec,
  type GraphSpec,
  type MindMapSpec,
  type NestedSpec,
  type SequenceSpec,
  type StateSpec,
  type TableSpec,
  type TreeNode,
  type VennSpec,
} from './diagrams';
import {
  drawArrow,
  drawBarChart,
  drawCircle,
  drawCube,
  drawEllipse,
  drawFlowchart,
  drawGraph,
  drawLine,
  drawRect,
  drawTree,
  drawTriangle,
  figure,
  textWidth,
  writeText,
  type Box,
  type Figure,
  type FigureType,
  type Pen,
  type Relations,
} from './shapes';

export type SceneKind = FigureType | 'mixed-notes' | 'notes-complex';

export interface SceneLink {
  from: string;
  to: string;
}

export interface Scene {
  kind: SceneKind;
  seed: number;
  messiness: Messiness;
  title: string;
  width: number;
  height: number;
  strokes: InkStroke[];
  /** Reference Markdown for the text parts (figure labels excluded). */
  text: string;
  figures: Figure[];
  /** Arrows drawn between figures (notes pages), by figure id. */
  links: SceneLink[];
}

export interface ScenePage {
  kind: SceneKind;
  seed: number;
  messiness?: Messiness;
}

export const SCENE_KINDS: { kind: SceneKind; label: string; group: string }[] = [
  { kind: 'circle', label: 'Circle', group: 'Primitives' },
  { kind: 'ellipse', label: 'Ellipse', group: 'Primitives' },
  { kind: 'square', label: 'Square', group: 'Primitives' },
  { kind: 'rectangle', label: 'Rectangle', group: 'Primitives' },
  { kind: 'triangle', label: 'Triangle', group: 'Primitives' },
  { kind: 'line', label: 'Straight line', group: 'Primitives' },
  { kind: 'arrow', label: 'Arrow', group: 'Primitives' },
  { kind: 'curved-arrow', label: 'Curved arrow', group: 'Primitives' },
  { kind: 'graph', label: 'Axes + curve', group: 'Figures' },
  { kind: 'bar-chart', label: 'Bar chart', group: 'Figures' },
  { kind: 'cube', label: 'Isometric cube', group: 'Figures' },
  { kind: 'box-3d', label: '3D box', group: 'Figures' },
  { kind: 'flowchart', label: 'Flowchart', group: 'Figures' },
  { kind: 'tree', label: 'Tree / graph', group: 'Figures' },
  { kind: 'flowchart-complex', label: 'Flowchart: branches, merge, loop', group: 'Sequences' },
  { kind: 'state-machine', label: 'State machine', group: 'Sequences' },
  { kind: 'sequence-diagram', label: 'Sequence diagram', group: 'Sequences' },
  { kind: 'timeline', label: 'Timeline / pipeline', group: 'Sequences' },
  { kind: 'tree-deep', label: 'Tree, depth 3–4', group: 'Structures' },
  { kind: 'graph-crossing', label: 'Graph with crossing edges', group: 'Structures' },
  { kind: 'nested-boxes', label: 'Nested boxes', group: 'Structures' },
  { kind: 'venn', label: 'Venn diagram', group: 'Structures' },
  { kind: 'mind-map', label: 'Mind map', group: 'Structures' },
  { kind: 'table', label: 'Table / matrix', group: 'Structures' },
  { kind: 'plot-multi', label: 'Plot: 2–3 curves + legend', group: 'Charts' },
  { kind: 'bar-values', label: 'Bar chart with values', group: 'Charts' },
  { kind: 'bar-stacked', label: 'Stacked bar chart', group: 'Charts' },
  { kind: 'number-line', label: 'Number line', group: 'Math' },
  { kind: 'unit-circle', label: 'Unit circle with angle', group: 'Math' },
  { kind: 'triangle-labelled', label: 'Triangle with side labels', group: 'Math' },
  { kind: 'mixed-notes', label: 'Notes page (text + figure + footnote)', group: 'Pages' },
  { kind: 'notes-complex', label: 'Notes page: 2–3 linked figures', group: 'Pages' },
];

/** Dataset name → pages (scene kind + seed [+ messiness]). Kept small so eval runs on a CPU model stay practical. */
export const DATASETS: Record<string, ScenePage[]> = {
  'shapes-basic': [
    { kind: 'circle', seed: 1 },
    { kind: 'ellipse', seed: 2 },
    { kind: 'square', seed: 3 },
    { kind: 'rectangle', seed: 4 },
    { kind: 'triangle', seed: 5 },
    { kind: 'line', seed: 6 },
    { kind: 'arrow', seed: 7 },
    { kind: 'curved-arrow', seed: 8 },
  ],
  graphs: [
    { kind: 'graph', seed: 11 },
    { kind: 'graph', seed: 12 },
    { kind: 'bar-chart', seed: 13 },
    { kind: 'bar-chart', seed: 14 },
  ],
  'cubes-3d': [
    { kind: 'cube', seed: 21 },
    { kind: 'cube', seed: 22 },
    { kind: 'box-3d', seed: 23 },
  ],
  flowcharts: [
    { kind: 'flowchart', seed: 31 },
    { kind: 'flowchart', seed: 32 },
    { kind: 'tree', seed: 33 },
  ],
  'mixed-notes': [
    { kind: 'mixed-notes', seed: 41 },
    { kind: 'mixed-notes', seed: 42 },
    { kind: 'mixed-notes', seed: 43 },
  ],
  // Wave 2: relation-bearing scenes, each kind at normal + messy.
  'flowcharts-complex': [
    { kind: 'flowchart-complex', seed: 51 },
    { kind: 'flowchart-complex', seed: 52, messiness: 'messy' },
    { kind: 'flowchart-complex', seed: 53 },
    { kind: 'flowchart-complex', seed: 54, messiness: 'messy' },
  ],
  'state-machines': [
    { kind: 'state-machine', seed: 61 },
    { kind: 'state-machine', seed: 62, messiness: 'messy' },
    { kind: 'state-machine', seed: 63 },
    { kind: 'state-machine', seed: 64, messiness: 'messy' },
  ],
  sequences: [
    { kind: 'sequence-diagram', seed: 71 },
    { kind: 'sequence-diagram', seed: 72, messiness: 'messy' },
    { kind: 'timeline', seed: 73 },
    { kind: 'timeline', seed: 74, messiness: 'messy' },
  ],
  'trees-graphs': [
    { kind: 'tree-deep', seed: 81 },
    { kind: 'tree-deep', seed: 82, messiness: 'messy' },
    { kind: 'graph-crossing', seed: 83 },
    { kind: 'graph-crossing', seed: 84, messiness: 'messy' },
  ],
  nested: [
    { kind: 'nested-boxes', seed: 91 },
    { kind: 'nested-boxes', seed: 92, messiness: 'messy' },
    { kind: 'venn', seed: 93 },
    { kind: 'venn', seed: 94, messiness: 'messy' },
  ],
  charts: [
    { kind: 'plot-multi', seed: 101 },
    { kind: 'plot-multi', seed: 102, messiness: 'messy' },
    { kind: 'bar-values', seed: 103 },
    { kind: 'bar-stacked', seed: 104, messiness: 'messy' },
  ],
  'tables-mindmaps': [
    { kind: 'table', seed: 111 },
    { kind: 'table', seed: 112, messiness: 'messy' },
    { kind: 'mind-map', seed: 113 },
    { kind: 'mind-map', seed: 114, messiness: 'messy' },
  ],
  'math-sketches': [
    { kind: 'number-line', seed: 121 },
    { kind: 'unit-circle', seed: 122 },
    { kind: 'unit-circle', seed: 123, messiness: 'messy' },
    { kind: 'triangle-labelled', seed: 124 },
    { kind: 'triangle-labelled', seed: 125, messiness: 'messy' },
  ],
  'notes-complex': [
    { kind: 'notes-complex', seed: 131 },
    { kind: 'notes-complex', seed: 132, messiness: 'messy' },
    { kind: 'notes-complex', seed: 133 },
    { kind: 'notes-complex', seed: 134, messiness: 'messy' },
  ],
};

/** The five original datasets; everything else is wave 2. */
export const LEGACY_DATASETS = ['shapes-basic', 'graphs', 'cubes-3d', 'flowcharts', 'mixed-notes'];

const HEADINGS = ['RLHF overview', 'Policy gradients', 'Reward models', 'Gradient descent', 'Attention recap', 'Minimax search'];
const BULLETS = [
  'reward model scores the samples',
  'PPO keeps the KL penalty small',
  'loss = -log p(y|x)',
  'sample N rollouts per prompt',
  'learning rate decays over time',
  'clip the ratio at 0.2',
  'value head predicts the return',
  'alpha-beta prunes dead branches',
  'softmax over the keys',
];
const FOOTNOTED = [
  ['the baseline* reduces variance', '* baseline = mean reward over the batch'],
  ['KL term* keeps the policy close', '* KL = divergence from the SFT model'],
  ['the critic* is trained jointly', '* critic = value network V(s)'],
];

const CURVES: { name: string; f: (u: number) => number; f2?: (u: number) => number; x: string; y: string; xTicks: string[] }[] = [
  { name: 'loss vs step', f: (u) => 0.9 * Math.exp(-3 * u) + 0.08, x: 'step', y: 'loss', xTicks: ['1k', '2k', '3k'] },
  { name: 'reward curve', f: (u) => 1 / (1 + Math.exp(-10 * (u - 0.5))), x: 'epoch', y: 'R', xTicks: ['1', '2', '3', '4'] },
  { name: 'y = x^2', f: (u) => u * u, x: 'x', y: 'y', xTicks: ['1', '2', '3'] },
  { name: 'train vs val', f: (u) => 0.9 * Math.exp(-3 * u) + 0.05, f2: (u) => 0.9 * Math.exp(-3 * u) + 0.1 + 0.35 * u * u, x: 'epoch', y: 'loss', xTicks: ['5', '10', '15'] },
  { name: 'sin x', f: (u) => 0.5 + 0.45 * Math.sin(u * Math.PI * 2), x: 'x', y: 'y', xTicks: ['pi', '2pi'] },
];
const BARS: { title: string; bars: { label: string; value: number }[] }[] = [
  { title: 'win rate', bars: [{ label: 'SFT', value: 0.45 }, { label: 'PPO', value: 0.7 }, { label: 'DPO', value: 0.65 }] },
  { title: 'accuracy', bars: [{ label: 'A', value: 0.4 }, { label: 'B', value: 0.8 }, { label: 'C', value: 0.55 }, { label: 'D', value: 0.3 }] },
  { title: 'latency ms', bars: [{ label: '3b', value: 0.3 }, { label: '7b', value: 0.6 }, { label: '72b', value: 1 }] },
];
const FLOWS: { nodes: { label: string; shape?: 'box' | 'diamond' | 'rounded' }[]; edgeLabels?: (string | undefined)[] }[] = [
  { nodes: [{ label: 'start', shape: 'rounded' }, { label: 'load data' }, { label: 'train' }, { label: 'eval' }, { label: 'done', shape: 'rounded' }] },
  { nodes: [{ label: 'prompt' }, { label: 'policy' }, { label: 'reward' }, { label: 'update' }] },
  { nodes: [{ label: 'input' }, { label: 'ok?', shape: 'diamond' }, { label: 'output' }], edgeLabels: [undefined, 'yes'] },
  { nodes: [{ label: 'tokens' }, { label: 'embed' }, { label: 'attention' }, { label: 'MLP' }, { label: 'logits' }] },
];
const TREES: { root: string; children: { label: string; children?: string[] }[] }[] = [
  { root: 'root', children: [{ label: 'A', children: ['a1', 'a2'] }, { label: 'B', children: ['b1'] }] },
  { root: 'loss', children: [{ label: 'CE' }, { label: 'KL' }, { label: 'MSE' }] },
  { root: 'S0', children: [{ label: 'S1', children: ['S3', 'S4'] }, { label: 'S2', children: ['S5'] }] },
];


const COMPLEX_FLOWS: FlowSpec[] = [
  {
    nodes: [
      { id: 'start', shape: 'rounded', col: 1, row: 0 },
      { id: 'read input', col: 1, row: 1 },
      { id: 'valid?', shape: 'diamond', col: 1, row: 2 },
      { id: 'process', col: 0, row: 3 },
      { id: 'show error', col: 2, row: 3 },
      { id: 'save', col: 1, row: 4 },
      { id: 'done', shape: 'rounded', col: 1, row: 5 },
    ],
    edges: [
      { from: 'start', to: 'read input' },
      { from: 'read input', to: 'valid?' },
      { from: 'valid?', to: 'process', label: 'yes' },
      { from: 'valid?', to: 'show error', label: 'no' },
      { from: 'process', to: 'save' },
      { from: 'show error', to: 'read input', label: 'retry' },
      { from: 'save', to: 'done' },
    ],
  },
  {
    nodes: [
      { id: 'init', shape: 'rounded', col: 0, row: 0 },
      { id: 'sample batch', col: 0, row: 1 },
      { id: 'compute loss', col: 0, row: 2 },
      { id: 'update weights', col: 0, row: 3 },
      { id: 'converged?', shape: 'diamond', col: 0, row: 4 },
      { id: 'stop', shape: 'rounded', col: 1, row: 4 },
    ],
    edges: [
      { from: 'init', to: 'sample batch' },
      { from: 'sample batch', to: 'compute loss' },
      { from: 'compute loss', to: 'update weights' },
      { from: 'update weights', to: 'converged?' },
      { from: 'converged?', to: 'stop', label: 'yes' },
      { from: 'converged?', to: 'sample batch', label: 'no' },
    ],
  },
  {
    nodes: [
      { id: 'request', col: 0, row: 0 },
      { id: 'cached?', shape: 'diamond', col: 1, row: 0 },
      { id: 'fetch', col: 2, row: 1 },
      { id: 'store', col: 3, row: 1 },
      { id: 'respond', col: 3, row: 0 },
    ],
    edges: [
      { from: 'request', to: 'cached?' },
      { from: 'cached?', to: 'respond', label: 'hit' },
      { from: 'cached?', to: 'fetch', label: 'miss' },
      { from: 'fetch', to: 'store' },
      { from: 'store', to: 'respond' },
    ],
  },
  {
    nodes: [
      { id: 'parse', col: 0, row: 0 },
      { id: 'type?', shape: 'diamond', col: 1, row: 0 },
      { id: 'int path', col: 2, row: 0 },
      { id: 'str path', col: 2, row: 1 },
      { id: 'merge', col: 3, row: 0 },
      { id: 'emit', col: 4, row: 0 },
    ],
    edges: [
      { from: 'parse', to: 'type?' },
      { from: 'type?', to: 'int path', label: 'int' },
      { from: 'type?', to: 'str path', label: 'str' },
      { from: 'int path', to: 'merge' },
      { from: 'str path', to: 'merge' },
      { from: 'merge', to: 'emit' },
      { from: 'emit', to: 'parse', label: 'next' },
    ],
  },
];

const STATE_MACHINES: StateSpec[] = [
  {
    states: [{ id: 'q0' }, { id: 'q1' }, { id: 'q2', accept: true }],
    start: 'q0',
    transitions: [
      { from: 'q0', to: 'q1', label: 'a' },
      { from: 'q1', to: 'q2', label: 'b' },
      { from: 'q1', to: 'q1', label: 'a' },
      { from: 'q2', to: 'q0', label: 'c' },
    ],
  },
  {
    states: [{ id: 'idle' }, { id: 'run' }, { id: 'wait' }, { id: 'done', accept: true }],
    start: 'idle',
    transitions: [
      { from: 'idle', to: 'run', label: 'start' },
      { from: 'run', to: 'wait', label: 'io' },
      { from: 'wait', to: 'run', label: 'ready' },
      { from: 'run', to: 'done', label: 'exit' },
      { from: 'run', to: 'run', label: 'tick' },
    ],
  },
  {
    states: [{ id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3', accept: true }],
    start: 'S0',
    transitions: [
      { from: 'S0', to: 'S1', label: '0' },
      { from: 'S0', to: 'S0', label: '1' },
      { from: 'S1', to: 'S2', label: '1' },
      { from: 'S2', to: 'S3', label: '0' },
      { from: 'S3', to: 'S1', label: '0' },
    ],
  },
  {
    states: [{ id: 'red' }, { id: 'green' }, { id: 'yellow' }],
    start: 'red',
    transitions: [
      { from: 'red', to: 'green', label: 'timer' },
      { from: 'green', to: 'yellow', label: 'timer' },
      { from: 'yellow', to: 'red', label: 'timer' },
      { from: 'green', to: 'green', label: 'hold' },
    ],
  },
];

const SEQUENCES: SequenceSpec[] = [
  {
    actors: ['client', 'server', 'db'],
    messages: [
      { from: 'client', to: 'server', label: 'login' },
      { from: 'server', to: 'db', label: 'lookup user' },
      { from: 'db', to: 'server', label: 'row' },
      { from: 'server', to: 'client', label: 'token' },
    ],
  },
  {
    actors: ['user', 'app', 'api', 'cache'],
    messages: [
      { from: 'user', to: 'app', label: 'open page' },
      { from: 'app', to: 'cache', label: 'get key' },
      { from: 'cache', to: 'app', label: 'miss' },
      { from: 'app', to: 'api', label: 'fetch' },
      { from: 'api', to: 'app', label: 'json' },
      { from: 'app', to: 'user', label: 'render' },
    ],
  },
  {
    actors: ['agent', 'env'],
    messages: [
      { from: 'agent', to: 'env', label: 'action' },
      { from: 'env', to: 'agent', label: 'state' },
      { from: 'env', to: 'agent', label: 'reward' },
      { from: 'agent', to: 'env', label: 'reset' },
    ],
  },
];

const TIMELINES: { steps: string[]; rows?: 1 | 2 }[] = [
  { steps: ['collect', 'clean', 'train', 'eval', 'deploy'], rows: 1 },
  { steps: ['tokenize', 'embed', 'attend', 'MLP', 'norm', 'logits'], rows: 2 },
  { steps: ['plan', 'build', 'test', 'ship'], rows: 1 },
  { steps: ['1990', '2000', '2010', '2020', '2030'], rows: 1 },
];

const DEEP_TREES: TreeNode[] = [
  { label: 'root', children: [
    { label: 'A', children: [{ label: 'A1', children: [{ label: 'x' }, { label: 'y' }] }, { label: 'A2' }] },
    { label: 'B', children: [{ label: 'B1' }, { label: 'B2', children: [{ label: 'z' }] }] },
  ] },
  { label: 'expr', children: [
    { label: '+', children: [{ label: 'a' }, { label: '*', children: [{ label: 'b' }, { label: 'c' }] }] },
    { label: '-', children: [{ label: 'd' }, { label: 'e' }] },
  ] },
  { label: 'CEO', children: [
    { label: 'CTO', children: [{ label: 'infra', children: [{ label: 'ops' }, { label: 'sec' }] }, { label: 'apps' }] },
    { label: 'CFO', children: [{ label: 'tax' }] },
    { label: 'COO', children: [{ label: 'hr' }, { label: 'sales' }] },
  ] },
  { label: '8', children: [
    { label: '3', children: [{ label: '1' }, { label: '6', children: [{ label: '4' }, { label: '7' }] }] },
    { label: '10', children: [{ label: '14', children: [{ label: '13' }] }] },
  ] },
];

const CROSSING_GRAPHS: GraphSpec[] = [
  { nodes: ['A', 'B', 'C', 'D'], edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }, { from: 'D', to: 'A' }, { from: 'A', to: 'C' }, { from: 'B', to: 'D' }] },
  { nodes: ['1', '2', '3', '4', '5'], edges: [{ from: '1', to: '3' }, { from: '3', to: '5' }, { from: '5', to: '2' }, { from: '2', to: '4' }, { from: '4', to: '1' }] },
  { nodes: ['u', 'v', 'w', 'x', 'y'], directed: true, edges: [{ from: 'u', to: 'w', label: '2' }, { from: 'w', to: 'y', label: '1' }, { from: 'y', to: 'v', label: '4' }, { from: 'v', to: 'x', label: '3' }, { from: 'x', to: 'u', label: '5' }, { from: 'u', to: 'v' }] },
  { nodes: ['P', 'Q', 'R', 'S'], directed: true, layout: 'grid', edges: [{ from: 'P', to: 'S' }, { from: 'Q', to: 'R' }, { from: 'P', to: 'Q' }, { from: 'R', to: 'S' }] },
];

const NESTED: NestedSpec[] = [
  { label: 'system', children: [{ label: 'frontend', children: [{ label: 'ui' }] }, { label: 'backend', children: [{ label: 'api' }, { label: 'db', shape: 'circle' }] }] },
  { label: 'outer', children: [{ label: 'inner', children: [{ label: 'core' }] }] },
  { label: 'VPC', children: [{ label: 'public', children: [{ label: 'lb' }] }, { label: 'private', children: [{ label: 'app' }, { label: 'cache' }] }] },
  { label: 'universe', shape: 'circle', children: [{ label: 'galaxy', shape: 'circle', children: [{ label: 'sun', shape: 'circle' }] }] },
];

const VENNS: VennSpec[] = [
  { sets: ['A', 'B'], overlap: 'A∩B' },
  { sets: ['cats', 'dogs'], overlap: 'pets', members: [['fur'], ['bark']] },
  { sets: ['ML', 'stats', 'code'], overlap: 'data sci' },
  { sets: ['X', 'Y'], overlap: 'both', members: [['1', '2'], ['3']] },
];

const MULTI_PLOTS = [
  {
    title: 'loss curves', xLabel: 'epoch', yLabel: 'loss', xTicks: ['5', '10', '15'], yTicks: ['0.5', '1'],
    curves: [
      { name: 'train', f: (u: number) => 0.9 * Math.exp(-3 * u) + 0.05, style: 'solid' as const },
      { name: 'val', f: (u: number) => 0.9 * Math.exp(-3 * u) + 0.1 + 0.35 * u * u, style: 'dashed' as const },
    ],
  },
  {
    title: 'activations', xLabel: 'x', yLabel: 'y', xTicks: ['-2', '0', '2'],
    curves: [
      { name: 'relu', f: (u: number) => Math.max(0, u - 0.5) * 2, style: 'solid' as const },
      { name: 'sigmoid', f: (u: number) => 1 / (1 + Math.exp(-10 * (u - 0.5))), style: 'dashed' as const },
      { name: 'tanh', f: (u: number) => 0.5 + 0.5 * Math.tanh(6 * (u - 0.5)), style: 'dotted' as const },
    ],
  },
  {
    xLabel: 'time', yLabel: 'speed', xTicks: ['1', '2', '3', '4'],
    curves: [
      { name: 'car', f: (u: number) => 0.2 + 0.7 * u, style: 'solid' as const },
      { name: 'bike', f: (u: number) => 0.1 + 0.3 * u, style: 'dashed' as const },
    ],
  },
];

const VALUE_BARS = [
  { title: 'sales by quarter', bars: [{ label: 'Q1', value: 12 }, { label: 'Q2', value: 18 }, { label: 'Q3', value: 9 }, { label: 'Q4', value: 21 }] },
  { title: 'accuracy %', bars: [{ label: 'base', value: 62 }, { label: '+hints', value: 78 }, { label: '+ctx', value: 85 }] },
  { title: 'runtime s', bars: [{ label: 'A', value: 3 }, { label: 'B', value: 7 }, { label: 'C', value: 5 }] },
];
const STACKED_BARS = [
  { title: 'cost split', bars: [{ label: '2022', value: 10, value2: 5 }, { label: '2023', value: 14, value2: 6 }, { label: '2024', value: 12, value2: 9 }] },
  { title: 'tokens', bars: [{ label: 'in', value: 30, value2: 10 }, { label: 'out', value: 20, value2: 25 }] },
  { title: 'users', bars: [{ label: 'web', value: 40, value2: 15 }, { label: 'ios', value: 25, value2: 20 }, { label: 'android', value: 30, value2: 10 }] },
];

const TABLES: TableSpec[] = [
  { columns: ['', 'train', 'val'], rows: [{ header: 'loss', cells: ['0.12', '0.31'] }, { header: 'acc', cells: ['98', '91'] }] },
  { columns: ['model', 'size', 'score'], rows: [{ header: 'A', cells: ['3b', '41'] }, { header: 'B', cells: ['7b', '58'] }, { header: 'C', cells: ['72b', '77'] }] },
  { columns: ['', 'x', 'y', 'z'], rows: [{ header: 'r1', cells: ['1', '0', '2'] }, { header: 'r2', cells: ['0', '1', '5'] }, { header: 'r3', cells: ['3', '4', '1'] }] },
  { columns: ['day', 'am', 'pm'], rows: [{ header: 'mon', cells: ['gym', 'work'] }, { header: 'tue', cells: ['read', 'code'] }] },
];

const MIND_MAPS: MindMapSpec[] = [
  { center: 'ML', branches: [{ label: 'supervised', leaves: ['SVM', 'trees'] }, { label: 'unsupervised', leaves: ['k-means'] }, { label: 'RL', leaves: ['PPO'] }, { label: 'deep' }] },
  { center: 'trip', branches: [{ label: 'flights' }, { label: 'hotel', leaves: ['book', 'pay'] }, { label: 'food' }, { label: 'sights', leaves: ['museum'] }, { label: 'budget' }] },
  { center: 'thesis', branches: [{ label: 'intro' }, { label: 'method', leaves: ['data', 'model'] }, { label: 'results' }, { label: 'outlook' }] },
];

const NUMBER_LINES = [
  { ticks: ['-3', '-2', '-1', '0', '1', '2', '3'], mark: { index: 4, label: 'x' } },
  { ticks: ['0', '1', '2', '3', '4', '5'], mark: { index: 2, label: 'a' } },
  { ticks: ['-1', '0', '1'], mark: { index: 1, label: 'p' } },
];
const UNIT_CIRCLES = [
  { angleDeg: 45, angleLabel: '45°', pointLabel: '(√2/2, √2/2)', radiusLabel: '1' },
  { angleDeg: 60, angleLabel: 'θ', pointLabel: '(cos θ, sin θ)', radiusLabel: 'r' },
  { angleDeg: 30, angleLabel: 'π/6', pointLabel: 'P', radiusLabel: '1' },
  { angleDeg: 120, angleLabel: '120°', pointLabel: 'Q' },
];
const TRIANGLES = [
  { vertices: ['A', 'B', 'C'] as [string, string, string], sides: ['c', 'a', 'b'] as [string, string, string], rightAngle: true },
  { vertices: ['P', 'Q', 'R'] as [string, string, string], sides: ['3', '5', '4'] as [string, string, string], rightAngle: true },
  { vertices: ['A', 'B', 'C'] as [string, string, string], sides: ['x', 'y', 'z'] as [string, string, string], angleLabel: 'β' },
  { vertices: ['X', 'Y', 'Z'] as [string, string, string], sides: ['12', '8', '10'] as [string, string, string], angleLabel: 'θ' },
];

function pen(seed: number, kind: string, messiness: Messiness): Pen {
  const rng = new Rng(`${kind}:${seed}`);
  return { rng, w: new InkWriter(rng.fork('ink'), 's', inkStyleFor(messiness)), mess: MESS_PROFILES[messiness] };
}

type FigFn = (type: FigureType, description: string, draw: () => string[] | Relations | void) => Figure;

/** Deterministic scene for (kind, seed, messiness): same inputs give byte-identical strokes. */
export function buildScene(kind: SceneKind, seed: number, messiness: Messiness = 'normal'): Scene {
  const p = pen(seed, kind, messiness);
  const { rng } = p;
  const figures: Figure[] = [];
  const links: SceneLink[] = [];
  let text = '';
  let width = 560, height = 440;
  const fig: FigFn = (type, description, draw) => {
    const f = figure(p, `fig${figures.length + 1}`, type, description, draw);
    figures.push(f);
    return f;
  };

  switch (kind) {
    case 'circle': {
      const r = rng.range(70, 130);
      fig('circle', 'a hand-drawn circle', () => drawCircle(p, width / 2 + rng.range(-40, 40), height / 2 + rng.range(-30, 30), r));
      break;
    }
    case 'ellipse': {
      const rx = rng.range(120, 180), ry = rng.range(55, 90);
      fig('ellipse', 'a hand-drawn ellipse, wider than tall', () => drawEllipse(p, width / 2, height / 2, rx, ry));
      break;
    }
    case 'square': {
      const s = rng.range(140, 220);
      fig('square', 'a hand-drawn square', () => drawRect(p, { x: width / 2 - s / 2, y: height / 2 - s / 2, w: s, h: s }));
      break;
    }
    case 'rectangle': {
      const w = rng.range(240, 340), h = rng.range(110, 170);
      fig('rectangle', 'a hand-drawn rectangle, wider than tall', () => drawRect(p, { x: width / 2 - w / 2, y: height / 2 - h / 2, w, h }));
      break;
    }
    case 'triangle': {
      const w = rng.range(180, 260), h = rng.range(150, 210);
      fig('triangle', 'a hand-drawn triangle', () => drawTriangle(p, { x: width / 2 - w / 2, y: height / 2 - h / 2, w, h }));
      break;
    }
    case 'line': {
      const a = { x: rng.range(60, 120), y: rng.range(120, 320) }, b = { x: width - rng.range(60, 120), y: rng.range(120, 320) };
      fig('line', 'a single straight line', () => drawLine(p, a, b));
      break;
    }
    case 'arrow': {
      const a = { x: rng.range(60, 120), y: rng.range(150, 300) }, b = { x: width - rng.range(60, 120), y: rng.range(150, 300) };
      fig('arrow', 'a straight arrow pointing right', () => drawArrow(p, a, b));
      break;
    }
    case 'curved-arrow': {
      const a = { x: rng.range(70, 120), y: rng.range(250, 330) }, b = { x: width - rng.range(70, 120), y: rng.range(250, 330) };
      fig('curved-arrow', 'a curved arrow pointing right', () => drawArrow(p, a, b, { curved: true, bulge: -rng.range(0.3, 0.45) }));
      break;
    }
    case 'graph': {
      width = 760; height = 560;
      const c = rng.pick(CURVES);
      fig('graph', `x/y axes with a plotted curve (${c.name})`, () => {
        return drawGraph(p, { x: 60, y: 50, w: width - 120, h: height - 100 }, { curve: c.f, curve2: c.f2, xTicks: c.xTicks, xLabel: c.x, yLabel: c.y, title: c.name });
      });
      break;
    }
    case 'bar-chart': {
      width = 760; height = 560;
      const b = rng.pick(BARS);
      fig('bar-chart', `bar chart "${b.title}" with bars ${b.bars.map((x) => x.label).join(', ')}`, () => {
        return drawBarChart(p, { x: 60, y: 50, w: width - 120, h: height - 100 }, { bars: b.bars, title: b.title });
      });
      break;
    }
    case 'cube':
    case 'box-3d': {
      width = 640; height = 520;
      const wire = rng.chance(0.5);
      const labelled = rng.chance(0.7);
      const aspect = kind === 'cube' ? 1 : rng.range(1.5, 2.2);
      fig(kind, `${wire ? 'wireframe ' : ''}${kind === 'cube' ? 'isometric cube' : '3D box'}${labelled ? ' with edges labelled a, b, c' : ''}`, () => {
        return drawCube(p, { x: 120, y: 80, w: width - 240, h: height - 160 }, { wireframe: wire, aspect, edgeLabels: labelled ? ['a', 'b', 'c'] : undefined });
      });
      break;
    }
    case 'flowchart': {
      width = 900; height = 600;
      const f = rng.pick(FLOWS);
      const direction = rng.pick(['down', 'right'] as const);
      if (direction === 'down') { width = 600; height = 900; }
      fig('flowchart', `flowchart: ${f.nodes.map((n) => n.label).join(' → ')}`, () => {
        const labels = drawFlowchart(p, { x: 60, y: 60, w: width - 120, h: height - 120 }, { nodes: f.nodes, direction, edgeLabels: f.edgeLabels });
        return { labels, ...flowRelations(f) };
      });
      break;
    }
    case 'tree': {
      width = 760; height = 560;
      const t = rng.pick(TREES);
      fig('tree', `tree with root ${t.root} and children ${t.children.map((c) => c.label).join(', ')}`, () => {
        const labels = drawTree(p, { x: 80, y: 60, w: width - 160, h: height - 120 }, t);
        return { labels, ...treeRelations(t) };
      });
      break;
    }
    case 'flowchart-complex': {
      const f = rng.pick(COMPLEX_FLOWS);
      const cols = Math.max(...f.nodes.map((n) => n.col)) + 1, rows = Math.max(...f.nodes.map((n) => n.row)) + 1;
      width = Math.max(640, cols * 250 + 120); height = Math.max(440, rows * 160 + 120);
      fig('flowchart-complex', `flowchart with ${f.nodes.filter((n) => n.shape === 'diamond').length} decision(s) and a loop: ${f.nodes.map((n) => n.label ?? n.id).join(', ')}`, () =>
        drawFlowchartComplex(p, { x: 60, y: 60, w: width - 120, h: height - 120 }, f));
      break;
    }
    case 'state-machine': {
      width = 860; height = 520;
      const m = rng.pick(STATE_MACHINES);
      fig('state-machine', `state machine with states ${m.states.map((s) => s.id).join(', ')}; start ${m.start}, accepting ${m.states.filter((s) => s.accept).map((s) => s.id).join(', ') || 'none'}`, () =>
        drawStateMachine(p, { x: 70, y: 70, w: width - 140, h: height - 140 }, m));
      break;
    }
    case 'sequence-diagram': {
      const q = rng.pick(SEQUENCES);
      width = Math.max(700, q.actors.length * 230); height = 180 + q.messages.length * 80;
      fig('sequence-diagram', `sequence diagram between ${q.actors.join(', ')} with ${q.messages.length} numbered messages`, () =>
        drawSequenceDiagram(p, { x: 50, y: 50, w: width - 100, h: height - 100 }, q));
      break;
    }
    case 'timeline': {
      const t = rng.pick(TIMELINES);
      const rows = t.rows ?? 1;
      width = rows === 1 ? Math.max(700, t.steps.length * 190) : 760; height = rows === 1 ? 300 : 480;
      fig('timeline', `pipeline of ${t.steps.length} numbered steps: ${t.steps.join(' → ')}`, () =>
        drawTimeline(p, { x: 50, y: 60, w: width - 100, h: height - 120 }, { steps: t.steps, rows }));
      break;
    }
    case 'tree-deep': {
      width = 900; height = 620;
      const t = rng.pick(DEEP_TREES);
      fig('tree-deep', `tree rooted at ${t.label}`, () => drawTreeDeep(p, { x: 60, y: 50, w: width - 120, h: height - 100 }, t));
      break;
    }
    case 'graph-crossing': {
      width = 620; height = 620;
      const g = rng.pick(CROSSING_GRAPHS);
      fig('graph-crossing', `${g.directed ? 'directed ' : ''}graph on ${g.nodes.join(', ')} with crossing edges`, () =>
        drawGraphCrossing(p, { x: 80, y: 80, w: width - 160, h: height - 160 }, g));
      break;
    }
    case 'nested-boxes': {
      width = 800; height = 560;
      const n = rng.pick(NESTED);
      fig('nested-boxes', `nested shapes: ${n.label} containing ${(n.children ?? []).map((c) => c.label).join(', ')}`, () =>
        drawNested(p, { x: 60, y: 50, w: width - 120, h: height - 100 }, n));
      break;
    }
    case 'venn': {
      width = 760; height = 560;
      const v = rng.pick(VENNS);
      fig('venn', `Venn diagram of ${v.sets.join(', ')} with "${v.overlap}" in the overlap`, () =>
        drawVenn(p, { x: 60, y: 50, w: width - 120, h: height - 100 }, v));
      break;
    }
    case 'plot-multi': {
      width = 820; height = 580;
      const pl = rng.pick(MULTI_PLOTS);
      fig('plot-multi', `axes "${pl.xLabel}" / "${pl.yLabel}" with ${pl.curves.length} curves (${pl.curves.map((c) => c.name).join(', ')}) and a legend`, () =>
        drawPlotMulti(p, { x: 50, y: 40, w: width - 100, h: height - 80 }, pl));
      break;
    }
    case 'bar-values':
    case 'bar-stacked': {
      width = 800; height = 560;
      const b = kind === 'bar-values' ? rng.pick(VALUE_BARS) : rng.pick(STACKED_BARS);
      fig(kind, `${kind === 'bar-stacked' ? 'stacked ' : ''}bar chart "${b.title}" with values written on the bars`, () =>
        drawBarValues(p, { x: 60, y: 40, w: width - 120, h: height - 80 }, { ...b, stacked: kind === 'bar-stacked' }));
      break;
    }
    case 'table': {
      const t = rng.pick(TABLES);
      width = Math.max(600, t.columns.length * 170 + 120); height = 120 + (t.rows.length + 1) * 60;
      fig('table', `table with columns ${t.columns.filter(Boolean).join(', ')} and rows ${t.rows.map((r) => r.header).join(', ')}`, () =>
        drawTable(p, { x: 60, y: 60, w: width - 120, h: height - 120 }, t, 16));
      break;
    }
    case 'mind-map': {
      width = 900; height = 640;
      const m = rng.pick(MIND_MAPS);
      fig('mind-map', `mind map centred on "${m.center}" with branches ${m.branches.map((b) => b.label).join(', ')}`, () =>
        drawMindMap(p, { x: 80, y: 60, w: width - 160, h: height - 120 }, m));
      break;
    }
    case 'number-line': {
      width = 820; height = 280;
      const n = rng.pick(NUMBER_LINES);
      fig('number-line', `number line from ${n.ticks[0]} to ${n.ticks[n.ticks.length - 1]} with ${n.mark.label} marked`, () =>
        drawNumberLine(p, { x: 50, y: 60, w: width - 100, h: height - 120 }, n));
      break;
    }
    case 'unit-circle': {
      width = 620; height = 620;
      const u = rng.pick(UNIT_CIRCLES);
      fig('unit-circle', `unit circle with a radius at ${u.angleLabel}`, () => drawUnitCircle(p, { x: 50, y: 50, w: width - 100, h: height - 100 }, u));
      break;
    }
    case 'triangle-labelled': {
      width = 620; height = 520;
      const t = rng.pick(TRIANGLES);
      fig('triangle-labelled', `triangle ${t.vertices.join('')} with sides ${t.sides.join(', ')}${t.rightAngle ? ', right angle at ' + t.vertices[0] : ''}`, () =>
        drawTriangleLabelled(p, { x: 80, y: 60, w: width - 160, h: height - 120 }, t));
      break;
    }
    case 'mixed-notes': {
      width = 1000; height = 1300;
      text = drawNotesPage(p, width, height, fig);
      break;
    }
    case 'notes-complex': {
      width = 1000; height = 1400;
      text = drawComplexNotesPage(p, width, height, fig, links);
      break;
    }
  }
  return { kind, seed, messiness, title: `${kind} #${seed}${messiness !== 'normal' ? ` (${messiness})` : ''}`, width, height, strokes: p.w.strokes, text, figures, links };
}

export function expectedTableCells(labels: string[]): string[][] | undefined {
  const table = TABLES.find(t => JSON.stringify([...t.columns, ...t.rows.flatMap(r => [r.header, ...r.cells])].filter(Boolean)) === JSON.stringify(labels));
  return table ? [[...table.columns], ...table.rows.map(r => [r.header, ...r.cells])] : undefined;
}

export function expectedNodeShapes(f: Figure): Map<string, string> {
  const matches = (labels: string[]) => JSON.stringify(labels) === JSON.stringify(f.nodes);
  if (f.type === 'flowchart-complex') {
    const spec = COMPLEX_FLOWS.find(s => matches(s.nodes.map(n => n.label ?? n.id)));
    if (spec) return new Map(spec.nodes.map(n => [n.label ?? n.id, n.shape ?? 'box']));
  }
  if (f.type === 'flowchart') {
    const spec = FLOWS.find(s => matches(s.nodes.map(n => n.label)));
    if (spec) return new Map(spec.nodes.map(n => [n.label, n.shape ?? 'box']));
  }
  if (f.type === 'nested-boxes') {
    const flatten = (n: NestedSpec): [string, string][] => [[n.label, n.shape ?? 'box'], ...(n.children ?? []).flatMap(flatten)];
    const nodes = NESTED.map(flatten).find(nodes => matches(nodes.map(([label]) => label)));
    if (nodes) return new Map(nodes);
  }
  return new Map((f.nodes ?? []).map(label => [label, f.type === 'state-machine' ? 'circle' : f.type === 'mind-map' ? 'ellipse' : 'rectangle']));
}

function flowRelations(f: (typeof FLOWS)[number]): Omit<Relations, 'labels'> {
  const nodes = f.nodes.map((n) => n.label);
  const edges = nodes.slice(1).map((to, i) => ({ from: nodes[i], to, ...(f.edgeLabels?.[i] ? { label: f.edgeLabels[i]! } : {}) }));
  return { nodes, edges, sequence: nodes };
}

function treeRelations(t: (typeof TREES)[number]): Omit<Relations, 'labels'> {
  const nodes = [t.root];
  const edges: { from: string; to: string }[] = [];
  for (const c of t.children) {
    nodes.push(c.label);
    edges.push({ from: t.root, to: c.label });
    for (const g of c.children ?? []) {
      nodes.push(g);
      edges.push({ from: c.label, to: g });
    }
  }
  return { nodes, edges, directed: false };
}

/**
 * A notes page with 2–3 figures of different kinds, arrows drawn between figures and sentences
 * that refer to them ("see fig 2"). Tests figure counting and keeping neighbouring figures apart.
 */
function drawComplexNotesPage(p: Pen, width: number, height: number, fig: FigFn, links: SceneLink[]): string {
  const { rng, w } = p;
  const lines: string[] = [];
  const left = 70;
  let y = 110;
  const heading = rng.pick(HEADINGS);
  writeText(p, heading, left, y, { size: 30 });
  lines.push(`# ${heading}`);
  w.pause(900);
  y += 70;
  const count = rng.int(2, 3);
  const intro = rng.pick(['the pipeline below feeds the chart', 'two views of the same run', 'overview first, then detail']);
  writeText(p, intro, left, y, { size: 20 });
  lines.push(intro);
  y += 60;

  type Slot = { box: Box; kind: FigureType };
  const kinds = shuffle(rng, ['timeline', 'state-machine', 'bar-values', 'table', 'nested-boxes', 'tree-deep', 'graph-crossing', 'plot-multi'] as FigureType[]).slice(0, count);
  const slots: Slot[] = [];
  if (count === 2) {
    slots.push({ box: { x: left, y, w: 400, h: 300 }, kind: kinds[0] });
    slots.push({ box: { x: left + 500, y: y + 30, w: 380, h: 300 }, kind: kinds[1] });
  } else {
    slots.push({ box: { x: left, y, w: 380, h: 280 }, kind: kinds[0] });
    slots.push({ box: { x: left + 480, y: y + 20, w: 380, h: 280 }, kind: kinds[1] });
    slots.push({ box: { x: left + 200, y: y + 420, w: 440, h: 300 }, kind: kinds[2] });
  }
  const drawn: Figure[] = [];
  slots.forEach((s, i) => {
    const b = s.box;
    const f = drawOne(p, s.kind, b, fig);
    drawn.push(f);
    const cap = `fig ${i + 1}`;
    writeText(p, cap, b.x + b.w / 2 - textWidth(cap, 16) / 2, b.y + b.h + 28, { size: 16 });
    lines.push(cap);
    w.pause(600);
  });
  // Arrows between figures: fig1 → fig2 (and fig2 → fig3), drawn from bbox edge to bbox edge.
  for (let i = 0; i < drawn.length - 1; i++) {
    const a = drawn[i].bbox, b = drawn[i + 1].bbox;
    const from = { x: a.right + 10, y: (a.top + a.bottom) / 2 }, to = { x: b.left - 10, y: (b.top + b.bottom) / 2 };
    if (b.top > a.bottom + 40) {
      from.x = (a.left + a.right) / 2; from.y = a.bottom + 40;
      to.x = (b.left + b.right) / 2; to.y = b.top - 10;
    }
    drawArrow(p, from, to, { curved: rng.chance(0.5), bulge: 0.15 });
    links.push({ from: drawn[i].id, to: drawn[i + 1].id });
    w.pause(500);
  }
  y = Math.max(...slots.map((s) => s.box.y + s.box.h)) + 90;
  const refs = [
    `see fig ${rng.int(1, count)} for the ${rng.pick(['steps', 'states', 'numbers'])}`,
    `fig 1 feeds into fig 2`,
    `compare fig 1 with fig ${count}`,
  ];
  const ref = rng.pick(refs);
  writeText(p, ref, left, y, { size: 20 });
  lines.push(ref);
  y += 48;
  const bullets = shuffle(rng, BULLETS).slice(0, 2);
  for (const b of bullets) {
    w.stroke([{ x: left, y: y - 6 }, { x: left + 12, y: y - 7 }], { pauseMs: 300 });
    writeText(p, b, left + 24, y, { size: 20 });
    lines.push(`- ${b}`);
    y += 48;
  }
  void width; void height;
  return lines.join('\n');
}

function drawOne(p: Pen, kind: FigureType, box: Box, fig: FigFn): Figure {
  const { rng } = p;
  switch (kind) {
    case 'timeline': {
      const t = rng.pick(TIMELINES.filter((x) => x.steps.length <= 4));
      return fig('timeline', `pipeline: ${t.steps.join(' → ')}`, () => drawTimeline(p, { ...box, h: 120 }, { steps: t.steps, rows: 1 }, 13));
    }
    case 'state-machine': {
      const m = rng.pick(STATE_MACHINES.filter((x) => x.states.length <= 3));
      return fig('state-machine', `state machine ${m.states.map((s) => s.id).join(', ')}`, () => drawStateMachine(p, box, m, 13));
    }
    case 'bar-values': {
      const b = rng.pick(VALUE_BARS);
      return fig('bar-values', `bar chart "${b.title}" with values`, () => drawBarValues(p, box, b, 13));
    }
    case 'table': {
      const t = rng.pick(TABLES.filter((x) => x.columns.length <= 3));
      return fig('table', `table ${t.columns.filter(Boolean).join(', ')}`, () => drawTable(p, { ...box, h: Math.min(box.h, (t.rows.length + 1) * 46) }, t, 14));
    }
    case 'nested-boxes': {
      const n = rng.pick(NESTED.slice(0, 3));
      return fig('nested-boxes', `nested shapes in ${n.label}`, () => drawNested(p, box, n, 13));
    }
    case 'tree-deep': {
      const t = rng.pick(DEEP_TREES);
      return fig('tree-deep', `tree rooted at ${t.label}`, () => drawTreeDeep(p, box, t, 12));
    }
    case 'graph-crossing': {
      const g = rng.pick(CROSSING_GRAPHS);
      return fig('graph-crossing', `graph on ${g.nodes.join(', ')}`, () => drawGraphCrossing(p, { x: box.x + 40, y: box.y, w: box.h, h: box.h }, g, 13));
    }
    default: {
      const pl = rng.pick(MULTI_PLOTS);
      return fig('plot-multi', `plot with ${pl.curves.length} curves and a legend`, () => drawPlotMulti(p, box, pl, 12));
    }
  }
}

function drawNotesPage(p: Pen, width: number, height: number, fig: FigFn): string {
  const { rng, w } = p;
  const lines: string[] = [];
  const left = 70;
  let y = 110;
  const heading = rng.pick(HEADINGS);
  writeText(p, heading, left, y, { size: 30 });
  lines.push(`# ${heading}`);
  w.pause(900);
  y += 70;
  const bullets = shuffle(rng, BULLETS).slice(0, rng.int(2, 3));
  for (const b of bullets) {
    // Bullet: a tight scribbled dot or a short dash.
    if (rng.chance(0.6)) {
      const cx = left + 5, cy = y - 6;
      const dot: { x: number; y: number }[] = [];
      for (let k = 0; k <= 20; k++) {
        const a = (k / 20) * Math.PI * 4, r = 1.5 + k * 0.12;
        dot.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      w.stroke(dot, { pauseMs: 300 });
    } else w.stroke([{ x: left, y: y - 6 }, { x: left + 12, y: y - 7 }], { pauseMs: 300 });
    writeText(p, b, left + 24, y, { size: 20 });
    lines.push(`- ${b}`);
    w.pause(700);
    y += 48;
  }
  y += 30;
  const figKinds: FigureType[] = ['graph', 'bar-chart', 'cube', 'flowchart', 'tree'];
  const kind = rng.pick(figKinds);
  const box = { x: left + 40, y, w: 560, h: kind === 'flowchart' ? 140 : 340 };
  switch (kind) {
    case 'graph': {
      const c = rng.pick(CURVES);
      fig('graph', `x/y axes with a plotted curve (${c.name})`, () => {
        return drawGraph(p, box, { curve: c.f, curve2: c.f2, xTicks: c.xTicks, xLabel: c.x, yLabel: c.y, title: c.name }, 15);
      });
      break;
    }
    case 'bar-chart': {
      const b = rng.pick(BARS);
      fig('bar-chart', `bar chart "${b.title}"`, () => {
        return drawBarChart(p, box, { bars: b.bars, title: b.title }, 15);
      });
      break;
    }
    case 'cube':
      fig('cube', 'isometric cube with edges labelled a, b, c', () => {
        return drawCube(p, { x: box.x + 120, y: box.y, w: 300, h: box.h }, { wireframe: rng.chance(0.5), edgeLabels: ['a', 'b', 'c'] }, 15);
      });
      break;
    case 'flowchart': {
      const f = rng.pick(FLOWS);
      fig('flowchart', `flowchart: ${f.nodes.map((n) => n.label).join(' → ')}`, () => {
        return drawFlowchart(p, { x: box.x, y: box.y + 20, w: width - box.x - 100, h: box.h - 40 }, { nodes: f.nodes, direction: 'right', edgeLabels: f.edgeLabels }, 15);
      });
      break;
    }
    case 'tree': {
      const t = rng.pick(TREES);
      fig('tree', `tree with root ${t.root}`, () => {
        return drawTree(p, { x: box.x + 60, y: box.y, w: 440, h: box.h }, t, 14);
      });
      break;
    }
  }
  y += box.h + 70;
  const [para, def] = rng.pick(FOOTNOTED);
  writeText(p, para, left, y, { size: 20 });
  lines.push(para);
  // Footnote definition near the bottom of the page.
  const defY = height - 90;
  drawLine(p, { x: left, y: defY - 40 }, { x: left + Math.min(220, textWidth(def, 17)), y: defY - 40 }, { shake: 0.5, pauseMs: 900 });
  writeText(p, def, left, defY, { size: 17 });
  lines.push('', def);
  return lines.join('\n');
}

function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The reference.md section for one page: text, then the machine-readable figure expectations. */
export function sceneReference(scene: Scene): string {
  const figures: (FigureExpectation & { description: string })[] = scene.figures.map((f) => ({
    id: f.id,
    type: f.type,
    description: f.description,
    labels: f.labels,
    ...(f.nodes ? { nodes: f.nodes } : {}),
    ...(f.edges ? { edges: f.edges } : {}),
    ...(f.directed === false ? { directed: false } : {}),
    ...(f.sequence ? { sequence: f.sequence } : {}),
    ...(f.contains ? { contains: f.contains } : {}),
    bbox: { left: Math.round(f.bbox.left), top: Math.round(f.bbox.top), right: Math.round(f.bbox.right), bottom: Math.round(f.bbox.bottom) },
    strokeIds: f.strokeIds,
  }));
  return formatReferencePage(scene.text, figures, {
    kind: scene.kind,
    seed: scene.seed,
    messiness: scene.messiness,
    ...(scene.links.length ? { links: scene.links } : {}),
  });
}
