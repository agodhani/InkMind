# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T09:43:44.947Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | notes-complex | 0.931 | 0.904 | 0/2 | 0% | 1/17 | 0/3 · P 0/0 | 0/2 τ — | — | 1/2 ✗ | 2 blocks (diagram:1, paragraph:1), 1 spurious diagram(s), 1237.4s · timeline: “fig 1”; table: “fig 1” |
| 2 | notes-complex (messy) | 1 | 1 | 0/3 | 0% | 0/21 | 0/7 · P 0/1 | 0/2 τ — | — | 3/3 ✓ | 3 blocks (diagram:3), 2 spurious diagram(s), 2081.9s · graph-crossing: “Shape: circle ~54 px, circle ~47 px, crossing axes, arrow, arrow, arrow, arrow, ”; table: “Shape: circle ~54 px, circle ~47 px, crossing axes, arrow, arrow, arrow, arrow, ”; timeline: “Shape: cube / 3D box.” |
| 3 | notes-complex | 0.769 | 0.693 | 0/2 | 0% | 1/12 | 0/5 · P 0/0 | 0/1 τ — | — | 2/2 ✓ | 3 blocks (paragraph:1, diagram:2), 2 spurious diagram(s), 333.6s · bar-values: “fig 2”; graph-crossing: “fig 2” |
| 4 | notes-complex (messy) | 0.704 | 0.642 | 0/2 | 0% | 2/17 | 0/11 · P 0/0 | 0/1 τ — | — | 1/2 ✗ | 2 blocks (diagram:1, paragraph:1), 1 spurious diagram(s), 249.3s · timeline: “Fig 1”; tree-deep: “Fig 1” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | 0.851 | 0.810 | 0/9 (0%) | 0% | 4/67 (6%) | 0/26 (0%) | 0/1 (0%) | 0/6 (0%) | — | — | 2/4 (50%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
