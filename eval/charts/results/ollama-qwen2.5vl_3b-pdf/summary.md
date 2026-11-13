# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T07:59:57.647Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | plot-multi | — | — | 1/1 | 0% | 2/8 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 248.4s · plot-multi: “Shape: L-shaped x/y axes, rectangle. Labels: speed, time. Steps: speed → time. R” |
| 2 | plot-multi (messy) | — | — | 1/1 | 0% | 2/10 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 289.1s · plot-multi: “Shape: circle, arrow, axes. Table: 1 row × 3 columns. Labels: 1, 10, 100, ← left” |
| 3 | bar-values | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |
| 4 | bar-stacked (messy) | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 2 | — | — | 2/2 (100%) | 0% | 4/18 (22%) | — | 0/3 (0%) | 0/2 (0%) | — | — | 2/2 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
