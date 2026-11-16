# baseline-replay

Transcriber: `replay:main-w4-dots3` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T01:35:13.203Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tree-deep | — | — | 1/1 | 0% | 10/10 | 9/9 · P 9/10 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · tree-deep: “Shape: a tree graph with circular nodes and straight connecting edges. Labels: r” |
| 2 | tree-deep (messy) | — | — | 1/1 | 0% | 9/11 | 7/10 · P 7/10 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · tree-deep: “Shape: a tree diagram with boxes representing organizational roles. Labels: CEO,” |
| 3 | graph-crossing | — | — | 1/1 | 0% | 4/4 | 6/6 · P 6/6 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · graph-crossing: “Shape: a graph with four circular nodes arranged in a diamond layout (top, botto” |
| 4 | graph-crossing (messy) | — | — | 1/1 | 0% | 4/4 | 4/4 · P 4/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · graph-crossing: “Shape: four circles arranged in a rectangular layout (top-left, top-right, botto” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 10/10 (100%) | 10/10 (100%) | — | — | — | 2/2 (100%) |
| tree-deep | 2 | — | — | 2/2 (100%) | 0% | 19/21 (90%) | 16/19 (84%) | 16/20 (80%) | — | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 27/29 (93%) | 26/29 (90%) | 26/30 (87%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
