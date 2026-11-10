# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:24:38.043Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | sequence-diagram | — | — | 1/1 | 0% | 9/10 | 2/6 · P 2/4 | 0/1 τ -1 | — | 1/1 ✓ | 1 blocks (diagram:1), 110.2s · sequence-diagram: “Shape: user, app, api, cache. Labels: 6. render, 5. json, 4. fetch, 3. fetch, 2.” |
| 2 | sequence-diagram (messy) | — | — | 1/1 | 0% | 1/6 | 0/4 · P 0/3 | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 76.8s · sequence-diagram: “Shape: arrow → right, arrow ← left. Labels: 1. QC, 2. state, 3. \mathbb{N}, 4. \” |
| 3 | timeline | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |
| 4 | timeline (messy) | — | — | 1/1 | 0% | 3/10 | 0/4 · P 0/0 | 0/1 τ 1 | — | 2/1 ✗ | 2 blocks (diagram:2), 1 spurious diagram(s), 82.7s · timeline: “Shape: closed 5-sided shape 103 px×47 px, closed 5-sided shape 107 px×46 px, cur” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sequence-diagram | 2 | — | — | 2/2 (100%) | 0% | 10/16 (63%) | 2/10 (20%) | 2/7 (29%) | 0/2 (0%) | -1.00 | — | 2/2 (100%) |
| timeline | 1 | — | — | 1/1 (100%) | 0% | 3/10 (30%) | 0/4 (0%) | — | 0/1 (0%) | 1.00 | — | 0/1 (0%) |
| **total** | 3 | — | — | 3/3 (100%) | 0% | 13/26 (50%) | 2/14 (14%) | 2/7 (29%) | 0/3 (0%) | 0.00 | — | 2/3 (67%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
