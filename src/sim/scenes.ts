import type { InkStroke } from '../model/page';
import type { FigureExpectation } from './metrics';
import { formatReferencePage } from './metrics';
import { DEFAULT_INK_STYLE, InkWriter } from './ink';
import { Rng } from './rng';
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
  type Figure,
  type FigureType,
  type Pen,
} from './shapes';

export type SceneKind = FigureType | 'mixed-notes';

export interface Scene {
  kind: SceneKind;
  seed: number;
  title: string;
  width: number;
  height: number;
  strokes: InkStroke[];
  /** Reference Markdown for the text parts (figure labels excluded). */
  text: string;
  figures: Figure[];
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
  { kind: 'mixed-notes', label: 'Notes page (text + figure + footnote)', group: 'Pages' },
];

/** Dataset name → pages (scene kind + seed). Kept small so eval runs on a CPU model stay practical. */
export const DATASETS: Record<string, { kind: SceneKind; seed: number }[]> = {
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
};

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

function pen(seed: number, kind: string): Pen {
  const rng = new Rng(`${kind}:${seed}`);
  return { rng, w: new InkWriter(rng.fork('ink'), 's', { ...DEFAULT_INK_STYLE }) };
}

export function buildScene(kind: SceneKind, seed: number): Scene {
  const p = pen(seed, kind);
  const { rng } = p;
  const figures: Figure[] = [];
  let text = '';
  let width = 560, height = 440;
  const fig = (type: FigureType, description: string, draw: () => string[] | void) =>
    figures.push(figure(p, `fig${figures.length + 1}`, type, description, draw));

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
        return drawFlowchart(p, { x: 60, y: 60, w: width - 120, h: height - 120 }, { nodes: f.nodes, direction, edgeLabels: f.edgeLabels });
      });
      break;
    }
    case 'tree': {
      width = 760; height = 560;
      const t = rng.pick(TREES);
      fig('tree', `tree with root ${t.root} and children ${t.children.map((c) => c.label).join(', ')}`, () => {
        return drawTree(p, { x: 80, y: 60, w: width - 160, h: height - 120 }, t);
      });
      break;
    }
    case 'mixed-notes': {
      width = 1000; height = 1300;
      text = drawNotesPage(p, width, height, fig);
      break;
    }
  }
  return { kind, seed, title: `${kind} #${seed}`, width, height, strokes: p.w.strokes, text, figures };
}

function drawNotesPage(p: Pen, width: number, height: number, fig: (type: FigureType, description: string, draw: () => string[] | void) => void): string {
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
    bbox: { left: Math.round(f.bbox.left), top: Math.round(f.bbox.top), right: Math.round(f.bbox.right), bottom: Math.round(f.bbox.bottom) },
    strokeIds: f.strokeIds,
  }));
  return formatReferencePage(scene.text, figures);
}
