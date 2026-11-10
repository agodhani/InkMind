# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:03:58.628Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | mixed-notes | 0.909 | 0.871 | 0/1 | 0% | 0/4 | — | — | — | 1/1 ✓ | 2 blocks (paragraph:1, diagram:1), 1 spurious diagram(s), 48.7s · tree: “Shape: circle ~53 px, circle ~54 px, circle ~50 px, circle ~52 px.” |
| 2 | mixed-notes | 0.6 | 0.5 | 0/1 | 0% | 4/4 | — | — | — | 1/1 ✓ | 2 blocks (paragraph:1, diagram:1), 1 spurious diagram(s), 148.7s · tree: “Loss
CE
KL
MSE
KL term* keeps the policy close” |
| 3 | mixed-notes | 0.767 | 0.701 | 0/1 | 0% | 4/4 | — | — | — | 2/1 ✗ | 5 blocks (paragraph:2, list:1, diagram:2), 1 spurious diagram(s), 224.2s · flowchart: “input ok? yes output” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 3 | 0.759 | 0.691 | 0/3 (0%) | 0% | 8/12 (67%) | — | — | — | — | — | 2/3 (67%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
