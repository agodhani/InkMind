# after-replay

Transcriber: `replay:main-w4-dots3` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T02:03:08.813Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | table | — | — | 1/1 | 0% | 12/12 | — | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · table: “Shape: a hand-drawn table with 4 rows and 3 columns. Labels: model, size, score,” |
| 2 | table (messy) | — | — | 1/1 | 0% | 5/8 | — | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · table: “Shape: table (3 rows × 3 columns). Labels: loss, acc, train, val, 0.72, 0.37, 90” |
| 3 | mind-map | — | — | 1/1 | 0% | 9/9 | 8/8 · P 8/8 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · mind-map: “Shape: a mindmap with a central ellipse labeled 'trip' and branches extending to” |
| 4 | mind-map (messy) | — | — | 1/1 | 0% | 9/9 | 8/8 · P 8/8 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · mind-map: “Shape: a central ellipse with 5 radiating lines, some with sub-branches (mindmap” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 18/18 (100%) | 16/16 (100%) | 16/16 (100%) | — | — | — | 2/2 (100%) |
| table | 2 | — | — | 2/2 (100%) | 0% | 17/20 (85%) | — | — | 2/2 (100%) | 1.00 | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 35/38 (92%) | 16/16 (100%) | 16/16 (100%) | 2/2 (100%) | 1.00 | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
