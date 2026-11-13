# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T08:15:50.026Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | table | — | — | 1/1 | 0% | 0/12 | — | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 90.0s · table: “Shape: crossing axes, arrow.” |
| 2 | table (messy) | — | — | 0/1 | 63% | 0/8 | — | 0/1 τ — | — | 1/1 ✓ | 2 blocks (diagram:1, table:1), 79.3s · table: “Shape: crossing axes.” |
| 3 | mind-map | — | — | 1/1 | 0% | 9/9 | 5/8 · P 5/8 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 334.8s · mind-map: “Shape: circle, box 2. Table: 1 row × 7 columns. Labels: trip, budget, flights, h” |
| 4 | mind-map (messy) | — | — | 1/1 | 0% | 7/9 | 4/8 · P 4/8 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 448.2s · mind-map: “Shape: triangle, box. Table: 1 row × 8 columns. Labels: trip, budget, hotel, foo” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 16/18 (89%) | 9/16 (56%) | 9/16 (56%) | — | — | — | 2/2 (100%) |
| table | 2 | — | — | 1/2 (50%) | 27% | 0/20 (0%) | — | — | 0/2 (0%) | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 3/4 (75%) | 10% | 16/38 (42%) | 9/16 (56%) | 9/16 (56%) | 0/2 (0%) | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
