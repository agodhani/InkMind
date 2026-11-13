# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T01:28:07.585Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | circle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 42.2s · circle: “Shape: circle. Labels: circle circle, circle, none. Relations: circle ↺ (none).” |
| 2 | ellipse | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 18.1s · ellipse: “Shape: arrow → right, arrow ← left. Labels: 2 free arrows, arrow → right, arrow ” |
| 3 | square | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 13.6s · square: “Shape: square. Labels: square square, square, none. Relations: square ↺ (none).” |
| 4 | rectangle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 12.8s · rectangle: “Shape: rectangle. Labels: rectangle, none. Relations: rectangle ↺ (none).” |
| 5 | triangle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 63.6s · triangle: “Shape: triangle 250 px×185 px. Labels: triangle, none. Steps: triangle. Relation” |
| 6 | line | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 41.8s |
| 7 | arrow | — | — | 0/1 | 100% | — | — | — | — | 0/1 ✗ | 1 blocks (margin_note:1), 55.0s |
| 8 | curved-arrow | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 47.9s · curved-arrow: “Shape: arrow → right. Labels: free arrow. Relations: free arrow ↺.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| arrow | 1 | — | — | 0/1 (0%) | 100% | — | — | — | — | — | — | 0/1 (0%) |
| circle | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| curved-arrow | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| ellipse | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/2 (0%) | — | — | — | 1/1 (100%) |
| line | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| rectangle | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| square | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| triangle | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| **total** | 8 | — | — | 7/8 (88%) | 17% | — | — | 0/7 (0%) | — | — | — | 7/8 (88%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
