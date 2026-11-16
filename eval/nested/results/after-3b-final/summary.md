# after-3b-final

Transcriber: `replay:after-3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T00:59:33.494Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | nested-boxes | — | — | 1/1 | 0% | 3/3 | — | — | 1/2 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · nested-boxes: “Shape: rectangle 442 px×318 px, rectangle 677 px×462 px, rectangle 549 px×388 px” |
| 2 | nested-boxes (messy) | — | — | 1/1 | 0% | 1/6 | — | — | 0/5 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · nested-boxes: “Shape: rectangle 273 px×394 px, rectangle 111 px×327 px, rectangle 700 px×471 px” |
| 3 | venn | — | — | 1/1 | 0% | 3/3 | — | — | 2/2 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · venn: “Shape: circle ~414 px, arrow. Labels: A, A∩B, B. Steps: A → B → A∩B. Nested: B i” |
| 4 | venn (messy) | — | — | 1/1 | 0% | 0/5 | — | — | 0/4 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · venn: “Shape: circle ~416 px, circle ~414 px. Labels: c0ts, pet5, dark, cogs. Nested: t” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 4/9 (44%) | — | 0/3 (0%) | — | — | 1/7 (14%) | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 3/8 (38%) | — | 0/2 (0%) | — | — | 2/6 (33%) | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 7/17 (41%) | — | 0/5 (0%) | — | — | 3/13 (23%) | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
