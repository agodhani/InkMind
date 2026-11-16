# after-3b-final

Transcriber: `replay:after-3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T00:59:32.913Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | notes-complex | 0.069 | 0.044 | 2/2 | 0% | 13/17 | 2/3 · P 2/2 | 2/2 τ 1 | — | 2/2 ✓ | 3 blocks (paragraph:1, diagram:2), 0.1s · timeline: “Shape: rectangle 71 px×37 px, closed 5-sided shape 75 px×40 px, rectangle 68 px×”; table: “Shape: 3×3 grid. Table: 3 rows × 3 columns. Labels: day, am, pm, mon, gym, work,” |
| 2 | notes-complex (messy) | 0.207 | 0.122 | 3/3 | 0% | 12/21 | 4/7 · P 4/4 | 0/2 τ 1 | — | 3/3 ✓ | 5 blocks (paragraph:2, diagram:3), 0.1s · graph-crossing: “Shape: circle ~54 px, circle ~47 px, circle ~44 px, circle ~45 px, arrow. Labels”; table: “Shape: 3×3 grid. Table: 3 rows × 3 columns. Labels: header, rows, day time pm, m”; timeline: “Shape: closed 4-sided shape 87 px×34 px, arrow.” |
| 3 | notes-complex | 0.154 | 0.086 | 2/2 | 0% | 5/12 | 0/5 · P 0/5 | 0/1 τ — | — | 2/2 ✓ | 4 blocks (paragraph:2, diagram:2), 0.1s · bar-values: “Shape: x/y axes, curve.”; graph-crossing: “Shape: circle ~49 px, circle ~47 px, circle ~46 px, circle ~44 px, circle ~48 px” |
| 4 | notes-complex (messy) | 0.111 | 0.052 | 2/2 | 0% | 6/17 | 1/11 · P 1/2 | 0/1 τ — | — | 2/2 ✓ | 3 blocks (paragraph:1, diagram:2), 0.1s · timeline: “Shape: closed 5-sided shape 83 px×52 px, rectangle 67 px×38 px, rectangle 71 px×”; tree-deep: “Shape: closed 4-sided shape 63 px×66 px, closed 5-sided shape 55 px×57 px, close” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | 0.135 | 0.076 | 9/9 (100%) | 0% | 36/67 (54%) | 7/26 (27%) | 7/13 (54%) | 2/6 (33%) | 1.00 | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
