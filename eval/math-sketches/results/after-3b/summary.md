# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T13:04:58.317Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | number-line | — | — | 1/1 | 0% | 3/4 | — | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 21.0s · number-line: “Shape: arrow. Labels: -1, 0, 1.” |
| 2 | unit-circle | — | — | 1/1 | 0% | 4/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 29.2s · unit-circle: “Shape: circle ~454 px, crossing axes, curve, arrow. Labels: y, x, (cos θ, sin θ)” |
| 3 | unit-circle (messy) | — | — | 1/1 | 0% | 1/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 28.5s · unit-circle: “Shape: circle ~460 px, crossing axes, curve, arrow. Labels: √2, 2/2, x.” |
| 4 | triangle-labelled | — | — | 1/1 | 0% | 5/6 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 23.8s · triangle-labelled: “Shape: triangle 424 px×357 px. Labels: R, P, Q, 4, 7, 3.” |
| 5 | triangle-labelled (messy) | — | — | 1/1 | 0% | 5/7 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 23.4s · triangle-labelled: “Shape: triangle 413 px×367 px. Labels: t, 70, 8, θ, 12, X, Y.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| number-line | 1 | — | — | 1/1 (100%) | 0% | 3/4 (75%) | — | — | 1/1 (100%) | 1.00 | — | 1/1 (100%) |
| triangle-labelled | 2 | — | — | 2/2 (100%) | 0% | 10/13 (77%) | — | — | — | — | — | 2/2 (100%) |
| unit-circle | 2 | — | — | 2/2 (100%) | 0% | 5/10 (50%) | — | — | — | — | — | 2/2 (100%) |
| **total** | 5 | — | — | 5/5 (100%) | 0% | 18/27 (67%) | — | — | 1/1 (100%) | 1.00 | — | 5/5 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
