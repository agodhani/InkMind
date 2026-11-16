# fix-1-geom

Transcriber: `geometry` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T01:38:16.737Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | cube | — | — | 1/1 | 0% | 0/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · cube: “Shape: cube / 3D box.” |
| 2 | cube | — | — | 1/1 | 0% | 0/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · cube: “Shape: cube / 3D box.” |
| 3 | box-3d | — | — | 1/1 | 0% | 0/3 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · box-3d: “Shape: cube / 3D box.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-3d | 1 | — | — | 1/1 (100%) | 0% | 0/3 (0%) | — | — | — | — | — | 1/1 (100%) |
| cube | 2 | — | — | 2/2 (100%) | 0% | 0/6 (0%) | — | — | — | — | — | 2/2 (100%) |
| **total** | 3 | — | — | 3/3 (100%) | 0% | 0/9 (0%) | — | — | — | — | — | 3/3 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
