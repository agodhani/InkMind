# Transcription eval

Scores the app's real transcriber + prompt against human-written references.

```bash
# 1. extract ink from a tablet-app PDF (PDF Expert / GoodNotes export) → InkMind strokes
pip install pymupdf pillow
python3 scripts/pdf_to_strokes.py notes.pdf eval/<name>/strokes.json --png-dir eval/<name>/pages
pdftoppm -r 150 -png notes.pdf eval/<name>/pages/page      # raster of the original pages

# 2. write eval/<name>/reference.md with the true text, pages separated by `<!-- page N -->`

# 3. run (Ollama must be up; OpenRouter needs OPENROUTER_API_KEY)
npm run eval -- --dataset eval/<name> --provider ollama --model qwen2.5vl:7b             # whole page, PDF raster
npm run eval -- --dataset eval/<name> --provider ollama --model qwen2.5vl:7b --image strokes   # the app's own rendering of the ink (MODEL_RENDER; --render original for the user's ink)
npm run eval -- --dataset eval/<name> --provider ollama --model qwen2.5vl:7b --band 6 --context 2   # N line-groups per request (+context groups), like scope=region
npm run eval -- --dataset eval/<name> --provider openrouter --model google/gemma-4-31b-it:free
```

Results land in `eval/<name>/results/<run>/` — `summary.md` (WER/CER per page, committed) and
`page-N.json` with the blocks, hypothesis and reference (local only). The same `strokes.json`
can be loaded into the app via Pages → Import… to see and correct the transcription live.

WER/CER are computed on lower-cased text with punctuation, bullets, arrows and Markdown stripped,
so they measure *reading* accuracy, not formatting.

## Synthetic shape / diagram datasets

`npm run gen:shapes` (scripts/gen_shapes.ts, generator in `src/sim/`) writes reproducible, seed-based
datasets in the same layout — `strokes.json`, `pages/page-N.png` rendered with the app's own
renderer, `reference.md` — so they can be scored with the commands above and imported into the app.
They contain no personal data and are committed:

| dataset | pages | content |
|---|---|---|
| `eval/shapes-basic` | 8 | single primitives: circle, ellipse, square, rectangle, triangle, line, arrow, curved arrow |
| `eval/graphs` | 4 | x/y axes with a plotted curve and tick labels, bar charts |
| `eval/cubes-3d` | 3 | isometric cubes / 3D boxes with edge labels |
| `eval/flowcharts` | 3 | flowcharts (boxes + arrows + labels) and trees/graphs |
| `eval/mixed-notes` | 3 | heading + bullets + one figure + `*` footnote marker and definition |
| `eval/flowcharts-complex` | 4 | flowcharts with decision diamonds, yes/no edge labels, merges and back-edge loops |
| `eval/state-machines` | 4 | state machines: circles, start arrow, double-circle accept states, labelled transitions, self-loops |
| `eval/sequences` | 4 | sequence diagrams (lifelines + numbered horizontal messages) and timelines/pipelines (numbered boxes + arrows) |
| `eval/trees-graphs` | 4 | trees of depth 3–4 and small graphs with crossing edges (some directed/labelled) |
| `eval/nested` | 4 | boxes inside boxes (2–3 levels) and Venn diagrams with set and overlap labels |
| `eval/charts` | 4 | plots with 2–3 curves, legend and axis titles; bar charts with values; stacked bars |
| `eval/tables-mindmaps` | 4 | tables with row/column headers; mind maps (centre + radial branches + leaves) |
| `eval/math-sketches` | 5 | number line with a marked point, unit circle with an angle, triangles with vertex and side labels |
| `eval/notes-complex` | 4 | notes pages with 2–3 figures, arrows drawn *between* figures and text referring to them ("see fig 2") |

The wave-2 datasets alternate **normal** and **messy** pages. Every scene has a messiness level
(`neat | normal | messy`, `src/sim/ink.ts` `MESS_PROFILES`) that scales jitter and wobble, corner
placement error and overshoot, the chance that a side stops short of its corner (gaps), letter slant
and how much long connectors bow. The level is recorded in `reference.md` and `strokes.json`;
`npm run eval -- --messiness messy` scores only those pages.

Strokes are drawn the way a person would (several strokes per shape, jitter, pressure variation,
realistic timestamps); text uses the public-domain Hershey single-line font with jitter.
`npm run gen:shapes -- --dataset graphs` regenerates one dataset, `--out <dir>` writes elsewhere.
The same scenes can be replayed live in the app with the dev simulator: open the app with `?sim=1`.

Each page of `reference.md` ends with a machine-readable fence listing the expected figures and, for
relation-bearing scenes, their ground truth (`nodes`, `edges {from,to,label?}`, `directed: false` for
plain lines, an ordered `sequence`, and `contains {outer,inner}` pairs). Page metadata (`kind`,
`seed`, `messiness`, arrows `links` between figures on notes pages) comes first:

````md
```json figures
{ "kind": "flowchart-complex", "seed": 51, "messiness": "normal", "figures": [
  {"id":"fig1","type":"flowchart-complex","labels":["start","read input","valid?",...],
   "nodes":["start","read input","valid?",...],
   "edges":[{"from":"start","to":"read input"},{"from":"valid?","to":"process","label":"yes"},{"from":"show error","to":"read input","label":"retry"}],
   "bbox":{...},"strokeIds":["s0","s1",...]}
] }
```
````

`scripts/eval.ts` strips the fence from the text reference and adds diagram metrics to `summary.md`
(see `src/sim/metrics.ts`):

* **figures found** — a `diagram` block whose `strokeIds` cover ≥ 80 % of the figure's strokes with ≤ 20 % foreign strokes;
* **text leak** — share of figure strokes that ended up in non-diagram blocks;
* **labels found** — expected labels (axis names, node texts, …) present case-insensitively in the diagram caption;
* **edge recall / precision** — expected relations vs the relations the blocks claim (structured `figure.edges`
  when the model/reconciler produced them, otherwise `A → B (label)` phrases parsed from the caption), matched by
  endpoint label: case-insensitive, `->`/`=>`/`→` are equivalent, extra words around a label are tolerated,
  either direction counts for undirected figures (trees, mind maps, plain graphs);
* **sequence exact / τ** — for ordered step lists (pipeline stages, numbered messages, table headers, bar order):
  whether every step appears in the right order, and the Kendall tau of the steps that were found. Steps are
  looked up in the structured `figure.sequence` when the model/reconciler produced one that names at least one
  step, otherwise in the caption text (`summary.json` reports how many sequences were scored structurally);
* **nesting** — expected "inner inside outer" pairs vs the structured `figure.nodes` parents (`parent` = id of the
  enclosing node); when no block carries nesting data the caption phrases are used instead ("ui inside frontend",
  "system contains backend");
* **figure count ok** — pages whose number of `diagram` blocks equals the number of expected figures (notes pages
  with 2–3 figures and arrows between them test that neighbouring figures are not merged);
* WER/CER are unchanged and cover the text parts only (`diagram` blocks are excluded).

By default the eval post-processes the model's blocks exactly like `useTranscription` does for a fresh
page — `reconcileFigureBlocks` (geometry fill-in from the shape hints), unclaimed strokes attached to the
last block, then `mergeBlocks` into an empty page — before scoring, so the numbers reflect what users
see; `--reconcile 0` scores the raw model output. `summary.md` adds a per-scene-kind table under the per-page one, and `summary.json`
holds the same aggregates.

### One table for all synthetic datasets

```bash
npm run eval:shapes                                     # every synthetic dataset, ollama qwen2.5vl:3b
npm run eval:shapes -- --model qwen2.5vl:7b --messiness messy
npm run eval:shapes -- --dataset flowcharts-complex,state-machines
```

`scripts/eval_shapes.ts` runs `scripts/eval.ts` over each dataset and prints one Markdown table by
dataset (with *legacy five* vs *wave 2* subtotals) and one by scene kind; it is also written to
`eval/shapes-suite/<run>.md`.

### Simulator

The same scenes can be drawn live in the app (`?sim=1`): pick a scene, seed and messiness, **Draw**
(pointer-event replay) or **Instant**, then compare the blocks with the expected text, relations
(each expected edge turns green/red once a transcription exists), step order and nesting. **Run
suite** replays N relation-bearing scenes back-to-back (normal, then messy), waits for each
transcription and shows a per-scene table with totals that can be copied as Markdown.
