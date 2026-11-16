# after-3b-final

Transcriber: `replay:after-3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T00:59:33.139Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | mixed-notes | 0 | 0 | 1/1 | 0% | 4/4 | 3/3 · P 3/3 | — | — | 1/1 ✓ | 2 blocks (paragraph:1, diagram:1), 0.1s · tree: “Shape: circle ~53 px, circle ~54 px, circle ~50 px, circle ~52 px. Labels: loss,” |
| 2 | mixed-notes | 0.08 | 0.029 | 1/1 | 0% | 4/4 | 1/3 · P 1/3 | — | — | 1/1 ✓ | 2 blocks (paragraph:1, diagram:1), 0.1s · tree: “Shape: circle ~55 px, circle ~50 px, rectangle 61 px×45 px. Labels: loss, CE, KL” |
| 3 | mixed-notes | 0.233 | 0.166 | 1/1 | 0% | 4/4 | 0/2 · P 0/2 | 0/1 τ 0.333 | — | 1/1 ✓ | 2 blocks (paragraph:1, diagram:1), 0.1s · flowchart: “Shape: rectangle 112 px×43 px, diamond 141 px×63 px, rectangle 119 px×40 px, arr” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 3 | 0.104 | 0.065 | 3/3 (100%) | 0% | 12/12 (100%) | 4/8 (50%) | 4/8 (50%) | 0/1 (0%) | 0.33 | — | 3/3 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
