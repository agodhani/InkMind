# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T12:46:55.066Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | mixed-notes | 1 | 1 | 0/1 | 0% | 3/4 | — | — | — | 2/1 ✗ | 2 blocks (diagram:2), 2 spurious diagram(s), 29.3s · tree: “Shape: circle ~53 px, circle ~54 px, circle ~50 px, circle ~52 px. Labels: CE, K” |
| 2 | mixed-notes | 1 | 1 | 0/1 | 0% | 4/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 1 spurious diagram(s), 29.5s · tree: “Shape: circle ~55 px, circle ~50 px, rectangle 61 px×45 px. Labels: loss, CE, KL” |
| 3 | mixed-notes | 1 | 1 | 0/1 | 0% | 4/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 1 spurious diagram(s), 70.4s · flowchart: “Shape: rectangle 112 px×43 px, diamond 141 px×63 px, rectangle 119 px×40 px, arr” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 3 | 1.000 | 1.000 | 0/3 (0%) | 0% | 11/12 (92%) | — | 0/8 (0%) | — | — | — | 2/3 (67%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
