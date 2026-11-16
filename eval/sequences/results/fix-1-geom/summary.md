# fix-1-geom

Transcriber: `geometry` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T01:38:17.000Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | sequence-diagram | — | — | 1/1 | 0% | 0/10 | 0/6 · P 0/6 | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · sequence-diagram: “Shape: rectangle 92 px×42 px, rectangle 98 px×36 px, rectangle 99 px×43 px, rect” |
| 2 | sequence-diagram (messy) | — | — | 1/1 | 0% | 0/6 | 0/4 · P 0/4 | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · sequence-diagram: “Shape: rectangle 80 px×41 px, 2 lifelines, arrow. Relations: lifeline 1 → lifeli” |
| 3 | timeline | — | — | 1/1 | 0% | 6/12 | 0/5 · P 0/5 | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · timeline: “Shape: rectangle 128 px×44 px, rectangle 125 px×39 px, rectangle 119 px×41 px, r” |
| 4 | timeline (messy) | — | — | 1/1 | 0% | 5/10 | 0/4 · P 0/3 | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 0.0s · timeline: “Shape: rectangle 104 px×50 px, closed 4-sided shape 96 px×64 px, closed 5-sided ” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sequence-diagram | 2 | — | — | 2/2 (100%) | 0% | 0/16 (0%) | 0/10 (0%) | 0/10 (0%) | 0/2 (0%) | — | — | 2/2 (100%) |
| timeline | 2 | — | — | 2/2 (100%) | 0% | 11/22 (50%) | 0/9 (0%) | 0/8 (0%) | 0/2 (0%) | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 11/38 (29%) | 0/19 (0%) | 0/18 (0%) | 0/4 (0%) | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
