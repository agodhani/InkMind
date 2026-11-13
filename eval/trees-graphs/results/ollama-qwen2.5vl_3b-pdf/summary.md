# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T06:56:51.229Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tree-deep | — | — | 1/1 | 0% | 10/10 | 6/9 · P 6/9 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 1307.6s · tree-deep: “Shape: circle. Table: 4 rows × 3 columns. Labels: root, A, A1, A2, B, B1, B2, x,” |
| 2 | tree-deep (messy) | — | — | 0/1 | 0% | 4/11 | 1/10 · P 1/3 | — | — | 2/1 ✗ | 2 blocks (diagram:2), 2075.2s · tree-deep: “Shape: closed shape: closed 5-sided shape 58 px×39 px, closed shape: closed 5-si” |
| 3 | graph-crossing | — | — | 1/1 | 0% | 4/4 | 4/6 · P 4/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 461.1s · graph-crossing: “Shape: circle. Labels: A, B, C, D, edge. Steps: A → C → B → D. Relations: A — C ” |
| 4 | graph-crossing (messy) | — | — | 1/1 | 0% | 4/4 | 2/4 · P 2/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 295.6s · graph-crossing: “Shape: circle. Labels: p, q, r, s, ← left. Relations: p → q (← left), p → r (← l” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 6/10 (60%) | 6/8 (75%) | — | — | — | 2/2 (100%) |
| tree-deep | 2 | — | — | 1/2 (50%) | 0% | 14/21 (67%) | 7/19 (37%) | 7/12 (58%) | — | — | — | 1/2 (50%) |
| **total** | 4 | — | — | 3/4 (75%) | 0% | 22/29 (76%) | 13/29 (45%) | 13/20 (65%) | — | — | — | 3/4 (75%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
