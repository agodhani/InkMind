# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T12:56:53.009Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tree-deep | — | — | 1/1 | 0% | 7/10 | 0/9 · P 0/10 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 29.8s · tree-deep: “Shape: circle ~46 px, circle ~47 px, circle ~43 px, circle ~42 px, circle ~45 px” |
| 2 | tree-deep (messy) | — | — | 1/1 | 0% | 4/11 | 0/10 · P 0/9 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 31.4s · tree-deep: “Shape: closed 4-sided shape 70 px×47 px, closed 5-sided shape 58 px×39 px, close” |
| 3 | graph-crossing | — | — | 1/1 | 0% | 4/4 | 0/6 · P 0/0 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 34.2s · graph-crossing: “Shape: circle ~46 px, circle ~48 px, diamond 371 px×370 px. Labels: A, B, C, D.” |
| 4 | graph-crossing (messy) | — | — | 1/1 | 0% | 4/4 | 4/4 · P 4/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 30.7s · graph-crossing: “Shape: circle ~47 px, circle ~44 px, circle ~48 px, arrow. Labels: P, Q, R, S. S” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 4/10 (40%) | 4/4 (100%) | — | — | — | 2/2 (100%) |
| tree-deep | 2 | — | — | 2/2 (100%) | 0% | 11/21 (52%) | 0/19 (0%) | 0/19 (0%) | — | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 19/29 (66%) | 4/29 (14%) | 4/23 (17%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
