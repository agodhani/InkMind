# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T04:25:47.432Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | circle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 29.7s · circle: “Shape: circle. Labels: circle.” |
| 2 | ellipse | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 31.4s · ellipse: “Shape: circle. Labels: A.” |
| 3 | square | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 38.1s · square: “Shape: square. Labels: square.” |
| 4 | rectangle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 32.2s · rectangle: “Shape: rectangle. Labels: A.” |
| 5 | triangle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 78.7s · triangle: “Shape: triangle. Labels: triangle.” |
| 6 | line | — | — | 0/1 | 100% | — | — | — | — | 0/1 ✗ | 1 blocks (margin_note:1), 28.6s |
| 7 | arrow | — | — | 0/1 | 100% | — | — | — | — | 0/1 ✗ | 1 blocks (margin_note:1), 32.3s |
| 8 | curved-arrow | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 55.7s · curved-arrow: “Shape: free arrow. Labels: arrow → right.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| arrow | 1 | — | — | 0/1 (0%) | 100% | — | — | — | — | — | — | 0/1 (0%) |
| circle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| curved-arrow | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| ellipse | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| line | 1 | — | — | 0/1 (0%) | 100% | — | — | — | — | — | — | 0/1 (0%) |
| rectangle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| square | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| triangle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| **total** | 8 | — | — | 6/8 (75%) | 22% | — | — | 0/1 (0%) | — | — | — | 6/8 (75%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
