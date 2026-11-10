# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T06:14:34.774Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | notes-complex | 0.931 | 0.904 | 0/2 | 0% | 1/17 | 0/3 · P 0/0 | 0/2 τ — | — | 1/2 ✗ | 2 blocks (diagram:1, paragraph:1), 1 spurious diagram(s), 143.0s · timeline: “fig 1”; table: “fig 1” |
| 2 | notes-complex (messy) | 0.793 | 0.714 | 0/3 | 0% | 0/21 | 0/7 · P 0/1 | 0/2 τ — | — | 2/3 ✗ | 3 blocks (paragraph:1, diagram:2), 1 spurious diagram(s), 330.1s · graph-crossing: “fig 1”; table: “fig 1”; timeline: “Shape: cube / 3D box.” |
| 3 | notes-complex | 0.769 | 0.693 | 0/2 | 0% | 2/12 | 0/5 · P 0/0 | 0/1 τ 1 | — | 2/2 ✓ | 3 blocks (paragraph:1, diagram:2), 2 spurious diagram(s), 287.7s · bar-values: “Shape: closed 5-sided shape 191 px×171 px, curve, curve, curve.”; graph-crossing: “Shape: closed 5-sided shape 191 px×171 px, curve, curve, curve.” |
| 4 | notes-complex (messy) | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 3 | 0.831 | 0.770 | 0/7 (0%) | 0% | 3/50 (6%) | 0/15 (0%) | 0/1 (0%) | 0/5 (0%) | 1.00 | — | 1/3 (33%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
