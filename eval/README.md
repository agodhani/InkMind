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

Strokes are drawn the way a person would (several strokes per shape, jitter, pressure variation,
realistic timestamps); text uses the public-domain Hershey single-line font with jitter.
`npm run gen:shapes -- --dataset graphs` regenerates one dataset, `--out <dir>` writes elsewhere.
The same scenes can be replayed live in the app with the dev simulator: open the app with `?sim=1`.

Each page of `reference.md` ends with a machine-readable fence listing the expected figures:

````md
```json figures
{ "figures": [
  {"id":"fig1","type":"graph","labels":["x","y","sin x"],"bbox":{...},"strokeIds":["s0","s1",...]}
] }
```
````

`scripts/eval.ts` strips the fence from the text reference and adds diagram metrics to `summary.md`
(see `src/sim/metrics.ts`):

* **figures found** — a `diagram` block whose `strokeIds` cover ≥ 80 % of the figure's strokes with ≤ 20 % foreign strokes;
* **text leak** — share of figure strokes that ended up in non-diagram blocks;
* **labels found** — expected labels (axis names, node texts, …) present case-insensitively in the diagram caption;
* WER/CER are unchanged and cover the text parts only (`diagram` blocks are excluded).
