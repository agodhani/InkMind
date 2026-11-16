# after-replay

Transcriber: `replay:main-w4-dots3` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T02:03:08.915Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | state-machine | — | — | 1/1 | 0% | 9/9 | 5/5 · P 5/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · state-machine: “Shape: state machine diagram with 4 states (S0, S1, S2, S3) represented as circl” |
| 2 | state-machine (messy) | — | — | 1/1 | 0% | 6/7 | 2/4 · P 2/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · state-machine: “Shape: flowchart with 4 circles (states) and arrows (transitions). Labels: q0, q” |
| 3 | state-machine | — | — | 1/1 | 0% | 9/9 | 5/5 · P 5/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · state-machine: “Shape: state machine diagram with four states (S0, S1, S2, S3) represented as ci” |
| 4 | state-machine (messy) | — | — | 1/1 | 0% | 9/9 | 3/5 · P 3/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · state-machine: “Shape: state machine diagram with 5 states (circles) and transitions (arrows). L” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | — | — | 4/4 (100%) | 0% | 33/34 (97%) | 15/19 (79%) | 15/19 (79%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
