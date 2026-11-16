# after-replay

Transcriber: `replay:main-w4-dots3` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T02:03:08.853Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | nested-boxes | — | — | 1/1 | 0% | 3/3 | — | — | 2/2 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · nested-boxes: “Shape: three nested rectangles. Labels: Outer, Inner, core. Relations: n2 inside” |
| 2 | nested-boxes (messy) | — | — | 1/1 | 0% | 6/6 | — | — | 5/5 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · nested-boxes: “Shape: nested rectangles and an oval. Labels: system, frontend, ui, backend, api” |
| 3 | venn | — | — | 1/1 | 0% | 3/3 | — | — | 2/2 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · venn: “Shape: Venn diagram consisting of two intersecting circles (A on the left, B on ” |
| 4 | venn (messy) | — | — | 1/1 | 0% | 4/5 | — | — | 0/4 | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · venn: “Shape: two overlapping circles (Venn diagram). Labels: cats, fur, pets, dark, do” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 9/9 (100%) | — | — | — | — | 7/7 (100%) | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 7/8 (88%) | — | — | — | — | 2/6 (33%) | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 16/17 (94%) | — | — | — | — | 9/13 (69%) | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
