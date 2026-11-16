# after-replay

Transcriber: `replay:main-w4-dots3` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T02:03:08.970Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | sequence-diagram | — | — | 1/1 | 0% | 10/10 | 6/6 · P 6/6 | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · sequence-diagram: “Sequence diagram showing interactions between user, app, api, and cache. Lifelin” |
| 2 | sequence-diagram (messy) | — | — | 1/1 | 0% | 6/6 | 4/4 · P 4/4 | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · sequence-diagram: “Shape: Sequence diagram with two lifelines (vertical dashed lines) and four hori” |
| 3 | timeline | — | — | 1/1 | 0% | 12/12 | 5/5 · P 5/5 | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · timeline: “Shape: flowchart with 6 rectangular nodes in a snake-like path (top row left-to-” |
| 4 | timeline (messy) | — | — | 1/1 | 0% | 10/10 | 4/4 · P 4/4 | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · timeline: “Shape: flowchart with 5 boxes connected by arrows from left to right. Labels: 1,” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sequence-diagram | 2 | — | — | 2/2 (100%) | 0% | 16/16 (100%) | 10/10 (100%) | 10/10 (100%) | 2/2 (100%) | 1.00 | — | 2/2 (100%) |
| timeline | 2 | — | — | 2/2 (100%) | 0% | 22/22 (100%) | 9/9 (100%) | 9/9 (100%) | 2/2 (100%) | 1.00 | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 38/38 (100%) | 19/19 (100%) | 19/19 (100%) | 4/4 (100%) | 1.00 | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
