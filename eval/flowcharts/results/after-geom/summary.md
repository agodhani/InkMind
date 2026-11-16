# after-geom

Transcriber: `geometry` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T02:03:09.605Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | flowchart | — | — | 1/1 | 0% | 0/4 | 0/2 · P 0/2 | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · flowchart: “Shape: rectangle 117 px×42 px, triangle 144 px×68 px, rectangle 109 px×48 px, ar” |
| 2 | flowchart | — | — | 1/1 | 0% | 0/5 | 0/4 · P 0/4 | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · flowchart: “Shape: ellipse 152 px×38 px, rectangle 156 px×43 px, rectangle 161 px×41 px, ell” |
| 3 | tree | — | — | 1/1 | 0% | 0/6 | 0/5 · P 0/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · tree: “Shape: closed 5-sided shape 62 px×53 px, closed 5-sided shape 58 px×50 px, circl” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flowchart | 2 | — | — | 2/2 (100%) | 0% | 0/9 (0%) | 0/6 (0%) | 0/6 (0%) | 0/2 (0%) | — | — | 2/2 (100%) |
| tree | 1 | — | — | 1/1 (100%) | 0% | 0/6 (0%) | 0/5 (0%) | 0/5 (0%) | — | — | — | 1/1 (100%) |
| **total** | 3 | — | — | 3/3 (100%) | 0% | 0/15 (0%) | 0/11 (0%) | 0/11 (0%) | 0/2 (0%) | — | — | 3/3 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
