# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T04:32:26.979Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | graph | — | — | 1/1 | 0% | 4/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 116.5s · graph: “Shape: L-shaped x/y axes, 1 curve plotted. Labels: pi, 2pi. Relations: pi → 2pi ” |
| 2 | graph | — | — | 1/1 | 0% | 3/7 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 76.7s · graph: “Shape: x-axis, y-axis. Labels: epoch, R. Relations: epoch → R (reward curve).” |
| 3 | bar-chart | — | — | 1/1 | 0% | 3/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 109.5s · bar-chart: “Shape: a curved line ~166 px, 11 straight lines, 7 short strokes that look like ” |
| 4 | bar-chart | — | — | 1/1 | 0% | 3/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 96.8s · bar-chart: “Shape: L-shaped x/y axes, 2 curved lines, 6 straight lines, 12 short strokes tha” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bar-chart | 2 | — | — | 2/2 (100%) | 0% | 6/8 (75%) | — | 0/4 (0%) | — | — | — | 2/2 (100%) |
| graph | 2 | — | — | 2/2 (100%) | 0% | 7/12 (58%) | — | 0/2 (0%) | — | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 13/20 (65%) | — | 0/6 (0%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
