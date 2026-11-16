# after-geom

Transcriber: `geometry` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T01:48:00.394Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | nested-boxes | — | — | 1/1 | 0% | 0/3 | — | — | 0/2 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · nested-boxes: “Shape: rectangle 442 px×318 px, rectangle 677 px×462 px, rectangle 549 px×388 px” |
| 2 | nested-boxes (messy) | — | — | 1/1 | 0% | 0/6 | — | — | 0/5 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · nested-boxes: “Shape: rectangle 273 px×394 px, rectangle 111 px×327 px, ellipse 88 px×306 px, r” |
| 3 | venn | — | — | 1/1 | 0% | 0/3 | — | — | 0/2 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · venn: “Shape: circle ~414 px. Nested: text (group 0) inside circle 1, text (group 0) in” |
| 4 | venn (messy) | — | — | 1/1 | 0% | 0/5 | — | — | 0/4 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · venn: “Shape: circle ~416 px, circle ~414 px. Nested: text 1 inside circle 1, text 2 in” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 0/9 (0%) | — | — | — | — | 0/7 (0%) | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 0/8 (0%) | — | — | — | — | 0/6 (0%) | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 0/17 (0%) | — | — | — | — | 0/13 (0%) | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
