# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T04:55:28.749Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | graph | — | — | 1/1 | 0% | 4/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 12.6s · graph: “Shape: L-shaped x/y axes, 1 curve plotted. Labels: pi, 2pi. Relations: pi → 2pi ” |
| 2 | graph | — | — | 1/1 | 0% | 4/7 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 12.1s · graph: “Shape: L-shaped x/y axes, 1 curve plotted, 1 free arrow. Labels: reward curve, R” |
| 3 | bar-chart | — | — | 1/1 | 0% | 3/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 28.8s · bar-chart: “Shape: a curved line ~166 px, 11 straight lines, 7 short strokes that look like ” |
| 4 | bar-chart | — | — | 1/1 | 0% | 0/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 19.3s · bar-chart: “Shape: L-shaped x/y axes, 2 curves plotted.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bar-chart | 2 | — | — | 2/2 (100%) | 0% | 3/8 (38%) | — | 0/2 (0%) | — | — | — | 2/2 (100%) |
| graph | 2 | — | — | 2/2 (100%) | 0% | 8/12 (67%) | — | 0/3 (0%) | — | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 11/20 (55%) | — | 0/5 (0%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
