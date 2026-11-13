# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T07:09:37.078Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | nested-boxes | — | — | 1/1 | 0% | 3/3 | — | — | 0/2 | 1/1 ✓ | 1 blocks (diagram:1), 124.8s · nested-boxes: “Shape: rectangle 442 px×318 px, 3×2 grid, arrow, arrow, arrow. Table: 3 rows × 2” |
| 2 | nested-boxes (messy) | — | — | 1/1 | 0% | 2/6 | — | — | 0/5 | 1/1 ✓ | 1 blocks (diagram:1), 218.6s · nested-boxes: “Shape: rectangle. Labels: frontend, backend. Steps: frontend → backend. Relation” |
| 3 | venn | — | — | 1/1 | 0% | 3/3 | — | — | 0/2 | 1/1 ✓ | 1 blocks (diagram:1), 223.8s · venn: “Shape: circle. Labels: A, B, A∩B. Steps: A → B. Relations: A → B (A∩B).” |
| 4 | venn (messy) | — | — | 1/1 | 0% | 3/5 | — | — | 0/4 | 1/1 ✓ | 1 blocks (diagram:1), 198.7s · venn: “Shape: circle. Labels: cats, dogs, pets. Relations: cats → dogs (pets).” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 5/9 (56%) | — | 0/1 (0%) | — | — | 0/7 (0%) | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 6/8 (75%) | — | 0/2 (0%) | — | — | 0/6 (0%) | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 11/17 (65%) | — | 0/3 (0%) | — | — | 0/13 (0%) | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
