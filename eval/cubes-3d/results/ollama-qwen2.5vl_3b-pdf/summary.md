# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T02:44:06.318Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | cube | — | — | 1/1 | 0% | 1/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 1402.1s · cube: “Shape: cube / 3D box. Labels: a cube / 3D box, edge. Steps: a cube / 3D box. Nes” |
| 2 | cube | — | — | 1/1 | 0% | 3/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 501.0s · cube: “Shape: cube / 3D box. Labels: a, b, c, edge. Steps: a → b → c. Relations: a — b ” |
| 3 | box-3d | — | — | 1/1 | 0% | 0/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 224.1s · box-3d: “Shape: cube / 3D box.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-3d | 1 | — | — | 1/1 (100%) | 0% | 0/3 (0%) | — | — | — | — | — | 1/1 (100%) |
| cube | 2 | — | — | 2/2 (100%) | 0% | 4/6 (67%) | — | 0/4 (0%) | — | — | — | 2/2 (100%) |
| **total** | 3 | — | — | 3/3 (100%) | 0% | 4/9 (44%) | — | 0/4 (0%) | — | — | — | 3/3 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
