# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:39:28.957Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | nested-boxes | — | — | 1/1 | 0% | 3/3 | — | — | 0/2 | 1/1 ✓ | 1 blocks (diagram:1), 76.3s · nested-boxes: “Shape: rectangle. Labels: outer, inner, core. Relations: outer → inner (← left),” |
| 2 | nested-boxes (messy) | — | — | 1/1 | 0% | 3/6 | — | — | 0/5 | 1/1 ✓ | 1 blocks (diagram:1), 60.9s · nested-boxes: “Shape: rectangle. Labels: frontend, backend. Relations: frontend → backend (syst” |
| 3 | venn | — | — | 1/1 | 0% | 0/3 | — | — | 0/2 | 2/1 ✗ | 2 blocks (diagram:2), 1 spurious diagram(s), 79.0s · venn: “Shape: circle ~414 px, circle ~414 px.” |
| 4 | venn (messy) | — | — | 1/1 | 0% | 0/5 | — | — | 0/4 | 1/1 ✓ | 1 blocks (diagram:1), 60.1s · venn: “Shape: circle. Labels: left, right. Relations: left → right (pots).” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 6/9 (67%) | — | 0/4 (0%) | — | — | 0/7 (0%) | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 0/8 (0%) | — | 0/2 (0%) | — | — | 0/6 (0%) | 1/2 (50%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 6/17 (35%) | — | 0/6 (0%) | — | — | 0/13 (0%) | 3/4 (75%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
