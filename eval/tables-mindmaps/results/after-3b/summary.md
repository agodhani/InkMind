# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T01:50:24.126Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | table | — | — | 1/1 | 0% | 0/12 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 41.7s · table: “Shape: 4×3 grid. Table: 4 rows × 3 columns.” |
| 2 | table (messy) | — | — | 1/1 | 0% | 4/8 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 31.1s · table: “Shape: 3×3 grid. Table: 3 rows × 3 columns. Labels: loss, acc, train, 0.72, vol,” |
| 3 | mind-map | — | — | 1/1 | 0% | 9/9 | 1/8 · P 1/8 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 35.5s · mind-map: “Shape: ellipse 80 px×46 px. Labels: budget, hotel, food, museum, sights, flights” |
| 4 | mind-map (messy) | — | — | 1/1 | 0% | 7/9 | 0/8 · P 0/8 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 39.3s · mind-map: “Shape: ellipse 78 px×55 px. Labels: flight, hotel, food, museum, signs, budget, ” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 16/18 (89%) | 1/16 (6%) | 1/16 (6%) | — | — | — | 2/2 (100%) |
| table | 2 | — | — | 2/2 (100%) | 0% | 4/20 (20%) | — | — | 0/2 (0%) | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 20/38 (53%) | 1/16 (6%) | 1/16 (6%) | 0/2 (0%) | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
