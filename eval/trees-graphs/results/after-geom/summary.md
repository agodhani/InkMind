# after-geom

Transcriber: `geometry` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T01:48:00.370Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tree-deep | — | — | 1/1 | 0% | 0/10 | 0/9 · P 0/9 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · tree-deep: “Shape: circle ~46 px, circle ~47 px, circle ~43 px, circle ~42 px, circle ~45 px” |
| 2 | tree-deep (messy) | — | — | 1/1 | 0% | 0/11 | 0/10 · P 0/9 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · tree-deep: “Shape: closed 4-sided shape 70 px×47 px, closed 5-sided shape 58 px×39 px, close” |
| 3 | graph-crossing | — | — | 1/1 | 0% | 0/4 | 0/6 · P 0/6 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · graph-crossing: “Shape: circle ~46 px, circle ~48 px. Relations: circle 1 — circle 3, circle 1 — ” |
| 4 | graph-crossing (messy) | — | — | 1/1 | 0% | 0/4 | 0/4 · P 0/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · graph-crossing: “Shape: circle ~47 px, circle ~44 px, circle ~48 px, arrow. Relations: circle 1 →” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 0/8 (0%) | 0/10 (0%) | 0/10 (0%) | — | — | — | 2/2 (100%) |
| tree-deep | 2 | — | — | 2/2 (100%) | 0% | 0/21 (0%) | 0/19 (0%) | 0/18 (0%) | — | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 0/29 (0%) | 0/29 (0%) | 0/28 (0%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
