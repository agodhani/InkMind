# fix-1-geom

Transcriber: `geometry` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T01:38:16.900Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | flowchart-complex | — | — | 1/1 | 0% | 0/10 | 0/7 · P 0/7 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · flowchart-complex: “Shape: ellipse 151 px×44 px, rectangle 159 px×51 px, diamond 184 px×96 px, recta” |
| 2 | flowchart-complex (messy) | — | — | 1/1 | 0% | 0/7 | 0/5 · P 0/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · flowchart-complex: “Shape: diamond 158 px×99 px, rectangle 144 px×57 px, closed 4-sided shape 148 px” |
| 3 | flowchart-complex | — | — | 1/1 | 0% | 0/8 | 0/6 · P 0/6 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · flowchart-complex: “Shape: ellipse 163 px×48 px, rectangle 156 px×54 px, rectangle 168 px×53 px, rec” |
| 4 | flowchart-complex (messy) | — | — | 1/1 | 0% | 0/7 | 0/5 · P 0/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · flowchart-complex: “Shape: rectangle 142 px×50 px, diamond 163 px×74 px, closed 5-sided shape 166 px” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | — | — | 4/4 (100%) | 0% | 0/32 (0%) | 0/23 (0%) | 0/23 (0%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
