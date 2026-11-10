# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:53:40.430Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | table | — | — | 0/1 | 59% | 0/12 | — | 0/1 τ — | — | 1/1 ✓ | 2 blocks (diagram:1, table:1), 34.0s · table: “Shape: crossing axes, arrow.” |
| 2 | table (messy) | — | — | 0/1 | 26% | 0/8 | — | 0/1 τ — | — | 1/1 ✓ | 2 blocks (diagram:1, table:1), 45.7s · table: “Shape: crossing axes.” |
| 3 | mind-map | — | — | 1/1 | 0% | 8/9 | 3/8 · P 3/6 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 113.1s · mind-map: “Shape: free arrows. Labels: budget, flights, hotel, book, pay, sights, food, mus” |
| 4 | mind-map (messy) | — | — | 1/1 | 0% | 7/9 | 4/8 · P 4/8 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 87.3s · mind-map: “Shape: triangle, free arrow, text strokes inside the shape. Labels: trip, budget” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 15/18 (83%) | 7/16 (44%) | 7/14 (50%) | — | — | — | 2/2 (100%) |
| table | 2 | — | — | 0/2 (0%) | 45% | 0/20 (0%) | — | — | 0/2 (0%) | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 2/4 (50%) | 16% | 15/38 (39%) | 7/16 (44%) | 7/14 (50%) | 0/2 (0%) | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
