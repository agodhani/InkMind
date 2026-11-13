# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T08:38:42.548Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | number-line | — | — | 1/1 | 0% | 0/4 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 269.8s · number-line: “Shape: arrow.” |
| 2 | unit-circle | — | — | 1/1 | 0% | 2/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 182.1s · unit-circle: “Shape: circle, arrow → right, arrow ↑ up, x-axis, y-axis, a curved line, 36 shor” |
| 3 | unit-circle (messy) | — | — | 1/1 | 0% | 2/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 372.9s · unit-circle: “Shape: crossing axes, x-axis, y-axis. Labels: x-axis, y-axis. Steps: x-axis → y-” |
| 4 | triangle-labelled | — | — | 1/1 | 0% | 0/6 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 293.8s · triangle-labelled: “Shape: triangle. Labels: triangle triangle, triangle, a label inside. Relations:” |
| 5 | triangle-labelled (messy) | — | — | 1/1 | 0% | 0/7 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 253.8s · triangle-labelled: “Shape: triangle. Labels: n1 triangle, triangle, a label inside. Relations: n1 tr” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| number-line | 1 | — | — | 1/1 (100%) | 0% | 0/4 (0%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| triangle-labelled | 2 | — | — | 2/2 (100%) | 0% | 0/13 (0%) | — | 0/2 (0%) | — | — | — | 2/2 (100%) |
| unit-circle | 2 | — | — | 2/2 (100%) | 0% | 4/10 (40%) | — | 0/2 (0%) | — | — | — | 2/2 (100%) |
| **total** | 5 | — | — | 5/5 (100%) | 0% | 4/27 (15%) | — | 0/4 (0%) | 0/1 (0%) | — | — | 5/5 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
