# final-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-15T22:33:58.890Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | graph | — | — | 1/1 | 0% | 5/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 26.1s · graph: “Shape: x/y axes, curved arrow, arrow. Labels: y, x, 2pi, sin x, pi, 1.” |
| 2 | graph | — | — | 1/1 | 0% | 3/7 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 25.7s · graph: “Shape: x/y axes, curve, arrow. Labels: R, epoch, 4.” |
| 3 | bar-chart | — | — | 1/1 | 0% | 3/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 27.6s · bar-chart: “Shape: x/y axes, curve. Labels: latency, 3b, 7b, 72b.” |
| 4 | bar-chart | — | — | 1/1 | 0% | 3/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 24.0s · bar-chart: “Shape: x/y axes, curve. Labels: 3b, 7b, 72b.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bar-chart | 2 | — | — | 2/2 (100%) | 0% | 6/8 (75%) | — | — | — | — | — | 2/2 (100%) |
| graph | 2 | — | — | 2/2 (100%) | 0% | 8/12 (67%) | — | — | — | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 14/20 (70%) | — | — | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
