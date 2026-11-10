# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T04:56:04.764Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | cube | — | — | 1/1 | 0% | 1/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 11.7s · cube: “Shape: a cube / 3D box drawn with 9 edges. Labels: a cube / 3D box drawn with 9 ” |
| 2 | cube | — | — | 1/1 | 0% | 3/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 15.1s · cube: “Shape: cube / 3D box. Labels: a, b, c. Relations: a → b (edge), b → c (edge), c ” |
| 3 | box-3d | — | — | 1/1 | 0% | 3/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 9.2s · box-3d: “Shape: cube / 3D box. Labels: a, b, c.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-3d | 1 | — | — | 1/1 (100%) | 0% | 3/3 (100%) | — | — | — | — | — | 1/1 (100%) |
| cube | 2 | — | — | 2/2 (100%) | 0% | 4/6 (67%) | — | 0/3 (0%) | — | — | — | 2/2 (100%) |
| **total** | 3 | — | — | 3/3 (100%) | 0% | 7/9 (78%) | — | 0/3 (0%) | — | — | — | 3/3 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
