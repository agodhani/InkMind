# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:10:49.429Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | flowchart-complex | — | — | 1/1 | 0% | 10/10 | 6/7 · P 6/7 | — | — | 2/1 ✗ | 2 blocks (diagram:2), 146.5s · flowchart-complex: “Shape: ellipse, rectangle. Labels: start, read input, valid?, process, save, don” |
| 2 | flowchart-complex (messy) | — | — | 1/1 | 0% | 5/7 | 1/5 · P 1/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 75.6s · flowchart-complex: “Shape: request, coched?, hit, respond, fetch, store. Labels: request, coched?, h” |
| 3 | flowchart-complex | — | — | 0/1 | 0% | 0/8 | 5/6 · P 5/6 | — | — | 5/1 ✗ | 5 blocks (diagram:5), 1 spurious diagram(s), 97.7s · flowchart-complex: “Shape: ellipse 163 px×48 px, rectangle 156 px×54 px, arrow. Relations: shape (gr” |
| 4 | flowchart-complex (messy) | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 3 | — | — | 2/3 (67%) | 0% | 15/25 (60%) | 12/18 (67%) | 12/18 (67%) | — | — | — | 1/3 (33%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
