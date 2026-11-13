# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T12:40:18.140Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | circle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 33.1s · circle: “Shape: circle ~216 px. Labels: fill the listed ids with handwriting INSIDE each ” |
| 2 | ellipse | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 27.6s · ellipse: “Shape: ellipse 358 px×121 px. Labels: fill the listed ids with handwriting INSID” |
| 3 | square | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 28.0s · square: “Shape: square ~172 px. Labels: fill the listed ids with handwriting INSIDE each ” |
| 4 | rectangle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 24.6s · rectangle: “Shape: rectangle 326 px×143 px. Labels: rectangle.” |
| 5 | triangle | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 24.4s · triangle: “Shape: triangle 250 px×185 px.” |
| 6 | line | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 24.0s · line: “Shape: sketch. Labels: stroke group 0.” |
| 7 | arrow | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 41.9s · arrow: “Shape: arrow. Labels: upward arrow.” |
| 8 | curved-arrow | — | — | 1/1 | 0% | — | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 35.3s · curved-arrow: “Shape: arrow. Labels: arrow.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| arrow | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| circle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| curved-arrow | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| ellipse | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| line | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| rectangle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| square | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| triangle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| **total** | 8 | — | — | 8/8 (100%) | 0% | — | — | — | — | — | — | 8/8 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
