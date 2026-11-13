# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T13:01:01.826Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | plot-multi | — | — | 1/1 | 0% | 1/8 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 29.7s · plot-multi: “Shape: rectangle 86 px×56 px, x/y axes, arrow. Labels: speed.” |
| 2 | plot-multi (messy) | — | — | 1/1 | 0% | 1/10 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 30.1s · plot-multi: “Shape: x/y axes, curve, arrow. Labels: 1005 curves, 0, 1, 2, 3.” |
| 3 | bar-values | — | — | 1/1 | 0% | 2/7 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 26.2s · bar-values: “Shape: x/y axes, curve. Labels: accuracy %, base, + hints, + ctx.” |
| 4 | bar-stacked (messy) | — | — | 1/1 | 0% | 4/10 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 54.9s · bar-stacked: “Shape: closed 4-sided shape 114 px×107 px, closed 4-sided shape 121 px×130 px, x” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bar-stacked | 1 | — | — | 1/1 (100%) | 0% | 4/10 (40%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| bar-values | 1 | — | — | 1/1 (100%) | 0% | 2/7 (29%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| plot-multi | 2 | — | — | 2/2 (100%) | 0% | 2/18 (11%) | — | — | 0/2 (0%) | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 8/35 (23%) | — | — | 0/4 (0%) | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
