# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T13:08:37.029Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | notes-complex | 1 | 1 | 1/2 | 0% | 7/17 | 2/3 · P 2/2 | 2/2 τ 1 | — | 2/2 ✓ | 2 blocks (diagram:2), 1 spurious diagram(s), 49.2s · timeline: “Shape: rectangle 71 px×37 px, closed 5-sided shape 75 px×40 px, rectangle 68 px×”; table: “Shape: 3×3 grid. Table: 3 rows × 3 columns. Labels: day, am, pm.” |
| 2 | notes-complex (messy) | 1 | 1 | 1/3 | 0% | 11/21 | 4/7 · P 4/4 | 0/2 τ — | — | 4/3 ✗ | 4 blocks (diagram:4), 2 spurious diagram(s), 68.0s · graph-crossing: “Shape: circle ~54 px, circle ~47 px, circle ~44 px, circle ~45 px, arrow. Labels”; table: “Shape: 3×3 grid. Table: 3 rows × 3 columns. Labels: clay, cim, pm, mon, work, tu”; timeline: “Shape: closed 4-sided shape 87 px×34 px, arrow.” |
| 3 | notes-complex | 1 | 1 | 1/2 | 0% | 5/12 | 2/5 · P 2/5 | 0/1 τ — | — | 3/2 ✗ | 3 blocks (diagram:3), 2 spurious diagram(s), 29.7s · bar-values: “Shape: x/y axes, curve.”; graph-crossing: “Shape: circle ~49 px, circle ~47 px, circle ~46 px, circle ~44 px, circle ~48 px” |
| 4 | notes-complex (messy) | 1 | 1 | 2/2 | 0% | 2/17 | 0/11 · P 0/2 | 0/1 τ — | — | 3/2 ✗ | 3 blocks (diagram:3), 1 spurious diagram(s), 71.7s · timeline: “Shape: closed 5-sided shape 83 px×52 px, rectangle 67 px×38 px, rectangle 71 px×”; tree-deep: “Shape: closed 4-sided shape 63 px×66 px, closed 5-sided shape 55 px×57 px, close” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | 1.000 | 1.000 | 5/9 (56%) | 0% | 25/67 (37%) | 8/26 (31%) | 8/13 (62%) | 2/6 (33%) | 1.00 | — | 1/4 (25%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
