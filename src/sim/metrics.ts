import type { BoundingBox } from '../types';
import type { DigitalBlock } from '../model/page';

/** Machine-readable expectation for one figure on a reference page (see eval/README.md). */
export interface FigureExpectation {
  id: string;
  type: string;
  labels: string[];
  strokeIds: string[];
  bbox?: BoundingBox;
}

export interface PageExpectation {
  /** Reference text for the text parts (figures excluded). */
  text: string;
  figures: FigureExpectation[];
}

const FIGURES_FENCE = /```json\s*figures\s*\n([\s\S]*?)\n```/;

const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/** Split a reference page into its text and the figure expectations in its ```json figures fence. */
export function parseReferencePage(md: string): PageExpectation {
  const m = FIGURES_FENCE.exec(md);
  const text = md.replace(FIGURES_FENCE, '').replace(HTML_COMMENT, '').trim();
  if (!m) return { text, figures: [] };
  const parsed = JSON.parse(m[1]) as { figures?: FigureExpectation[] } | FigureExpectation[];
  const figures = Array.isArray(parsed) ? parsed : (parsed.figures ?? []);
  return { text, figures };
}

export function formatReferencePage(text: string, figures: FigureExpectation[]): string {
  if (figures.length === 0) return text.trim() + '\n';
  // One figure per line keeps reference.md diff-able; stroke id lists would otherwise run to hundreds of lines.
  const body = figures.map((f) => `  ${JSON.stringify(f)}`).join(',\n');
  return `${text.trim()}\n\n\`\`\`json figures\n{ "figures": [\n${body}\n] }\n\`\`\`\n`;
}

export const FIGURE_MIN_COVERAGE = 0.8;
export const FIGURE_MAX_FOREIGN = 0.2;

export interface FigureScore {
  id: string;
  type: string;
  /** Share of the figure's strokes inside the best diagram block. */
  coverage: number;
  /** Share of that block's strokes that are not the figure's. */
  foreign: number;
  detected: boolean;
  /** Share of the figure's strokes that landed in non-diagram blocks. */
  leaked: number;
  labels: string[];
  labelsFound: string[];
  caption: string;
}

export interface DiagramMetrics {
  figures: number;
  detected: number;
  /** detected / figures, or null when the page has no figures. */
  figureRecall: number | null;
  /** figure strokes in text blocks / all figure strokes. */
  textLeak: number | null;
  labels: number;
  labelsFound: number;
  labelRecall: number | null;
  /** Diagram blocks that do not correspond to any expected figure (≥ 50 % foreign strokes). */
  spuriousDiagrams: number;
  perFigure: FigureScore[];
}

type BlockLike = Pick<DigitalBlock, 'kind' | 'text' | 'strokeIds'>;

/**
 * Score diagram handling: a figure is detected when some `diagram` block covers ≥ 80 % of its strokes
 * with ≤ 20 % foreign strokes; its labels are looked up (case-insensitively) in that block's caption.
 */
export function diagramMetrics(figures: FigureExpectation[], blocks: BlockLike[]): DiagramMetrics {
  const diagrams = blocks.filter((b) => b.kind === 'diagram');
  const textStrokeIds = new Set(blocks.filter((b) => b.kind !== 'diagram').flatMap((b) => b.strokeIds));
  const matchedDiagrams = new Set<BlockLike>();
  const perFigure: FigureScore[] = figures.map((f) => {
    const own = new Set(f.strokeIds);
    let best: { block: BlockLike; coverage: number; foreign: number } | null = null;
    for (const d of diagrams) {
      const ids = new Set(d.strokeIds);
      const inter = [...ids].filter((id) => own.has(id)).length;
      const coverage = own.size ? inter / own.size : 0;
      const foreign = ids.size ? (ids.size - inter) / ids.size : 1;
      if (!best || coverage > best.coverage || (coverage === best.coverage && foreign < best.foreign)) best = { block: d, coverage, foreign };
    }
    const detected = !!best && best.coverage >= FIGURE_MIN_COVERAGE && best.foreign <= FIGURE_MAX_FOREIGN;
    if (best && best.coverage > 0) matchedDiagrams.add(best.block);
    const caption = best?.block.text ?? '';
    const labelsFound = f.labels.filter((l) => captionHasLabel(caption, l));
    return {
      id: f.id,
      type: f.type,
      coverage: round(best?.coverage ?? 0),
      foreign: round(best?.foreign ?? 0),
      detected,
      leaked: round(own.size ? f.strokeIds.filter((id) => textStrokeIds.has(id)).length / own.size : 0),
      labels: f.labels,
      labelsFound,
      caption,
    };
  });
  const figureStrokes = figures.flatMap((f) => f.strokeIds);
  const leakedStrokes = figureStrokes.filter((id) => textStrokeIds.has(id)).length;
  const labels = perFigure.reduce((n, f) => n + f.labels.length, 0);
  const labelsFound = perFigure.reduce((n, f) => n + f.labelsFound.length, 0);
  const detected = perFigure.filter((f) => f.detected).length;
  const figureIds = new Set(figureStrokes);
  const spuriousDiagrams = diagrams.filter((d) => {
    const foreign = d.strokeIds.filter((id) => !figureIds.has(id)).length;
    return d.strokeIds.length === 0 || foreign / d.strokeIds.length >= 0.5;
  }).length;
  return {
    figures: figures.length,
    detected,
    figureRecall: figures.length ? round(detected / figures.length) : null,
    textLeak: figureStrokes.length ? round(leakedStrokes / figureStrokes.length) : null,
    labels,
    labelsFound,
    labelRecall: labels ? round(labelsFound / labels) : null,
    spuriousDiagrams,
    perFigure,
  };
}

/** Case-insensitive label lookup; one- and two-character labels must match as whole words ("x" is not in "box"). */
export function captionHasLabel(caption: string, label: string): boolean {
  const c = caption.toLowerCase(), l = label.trim().toLowerCase();
  if (!l) return false;
  if (l.length > 2) return c.includes(l);
  const esc = l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?=$|[^\\p{L}\\p{N}])`, 'u').test(c);
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}
