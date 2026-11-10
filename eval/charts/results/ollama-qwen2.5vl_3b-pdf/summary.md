# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:49:00.321Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | plot-multi | — | — | 1/1 | 0% | 2/8 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 65.4s · plot-multi: “Shape: L-shaped x/y axes, rectangle. Labels: speed, time. Relations: speed → tim” |
| 2 | plot-multi (messy) | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |
| 3 | bar-values | — | — | 1/1 | 0% | 1/7 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 70.6s · bar-values: “Shape: L-shaped x/y axes, 3 curves plotted. Labels: base, hints, ctx. Relations:” |
| 4 | bar-stacked (messy) | — | — | 1/1 | 0% | 0/10 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 89.4s · bar-stacked: “Shape: a circle with 'A' written inside. Labels: n=7 order=8 — looks like text (” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bar-stacked | 1 | — | — | 1/1 (100%) | 0% | 0/10 (0%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| bar-values | 1 | — | — | 1/1 (100%) | 0% | 1/7 (14%) | — | 0/2 (0%) | 0/1 (0%) | — | — | 1/1 (100%) |
| plot-multi | 1 | — | — | 1/1 (100%) | 0% | 2/8 (25%) | — | 0/1 (0%) | 0/1 (0%) | — | — | 1/1 (100%) |
| **total** | 3 | — | — | 3/3 (100%) | 0% | 3/25 (12%) | — | 0/3 (0%) | 0/3 (0%) | — | — | 3/3 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
