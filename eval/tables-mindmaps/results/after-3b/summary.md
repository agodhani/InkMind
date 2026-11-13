# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T13:02:52.309Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | table | — | — | 1/1 | 0% | 9/12 | — | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 32.8s · table: “Shape: 4×1 grid, arrow. Table: 4 rows × 1 column. Labels: model, size, score, A,” |
| 2 | table (messy) | — | — | 1/1 | 0% | 2/8 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 26.0s · table: “Shape: sketch. Labels: loss, acc.” |
| 3 | mind-map | — | — | 1/1 | 0% | 8/9 | 0/8 · P 0/0 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 24.7s · mind-map: “Shape: ellipse 80 px×46 px, arrow. Labels: budget, sights, food, hotel, book, pa” |
| 4 | mind-map (messy) | — | — | 1/1 | 0% | 7/9 | 0/8 · P 0/0 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 26.9s · mind-map: “Shape: ellipse 78 px×55 px, arrow. Labels: flight, budget, hotel, book, pay, tri” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 15/18 (83%) | 0/16 (0%) | — | — | — | — | 2/2 (100%) |
| table | 2 | — | — | 2/2 (100%) | 0% | 11/20 (55%) | — | — | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 26/38 (68%) | 0/16 (0%) | — | 1/2 (50%) | 1.00 | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
