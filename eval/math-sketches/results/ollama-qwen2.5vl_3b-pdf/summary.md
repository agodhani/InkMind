# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:56:34.575Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | number-line | — | — | 1/1 | 0% | 1/4 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 7.2s · number-line: “Shape: free arrow. Labels: Figure A (sketch, groups 0).” |
| 2 | unit-circle | — | — | 1/1 | 0% | 5/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 61.4s · unit-circle: “Shape: circle. Labels: (cos θ, sin θ). Relations: circle → x-axis (r), circle → ” |
| 3 | unit-circle (messy) | — | — | 1/1 | 0% | 3/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 51.1s · unit-circle: “Shape: x-axis, y-axis. Labels: 1, 2. Relations: 1 → 2 (5°).” |
| 4 | triangle-labelled | — | — | 1/1 | 0% | 3/6 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 6.5s · triangle-labelled: “Shape: triangle. Labels: P, Q, R.” |
| 5 | triangle-labelled (messy) | — | — | 1/1 | 0% | 4/7 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 48.0s · triangle-labelled: “Shape: triangle. Labels: X, 10, 8, θ.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| number-line | 1 | — | — | 1/1 (100%) | 0% | 1/4 (25%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| triangle-labelled | 2 | — | — | 2/2 (100%) | 0% | 7/13 (54%) | — | — | — | — | — | 2/2 (100%) |
| unit-circle | 2 | — | — | 2/2 (100%) | 0% | 8/10 (80%) | — | 0/3 (0%) | — | — | — | 2/2 (100%) |
| **total** | 5 | — | — | 5/5 (100%) | 0% | 16/27 (59%) | — | 0/3 (0%) | 0/1 (0%) | — | — | 5/5 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
