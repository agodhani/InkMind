# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T04:56:56.942Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | flowchart | — | — | 1/1 | 0% | 1/4 | 0/2 · P 0/0 | 0/1 τ — | — | 1/1 ✓ | 1 blocks (diagram:1), 11.7s · flowchart: “Shape: triangle. Labels: ok?.” |
| 2 | flowchart | — | — | 1/1 | 0% | 5/5 | 4/4 · P 4/4 | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 19.8s · flowchart: “Shape: rectangle, closed 4-sided shape. Labels: start, load data, train, eval, d” |
| 3 | tree | — | — | 1/1 | 0% | 5/6 | 3/5 · P 3/3 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 20.7s · tree: “Shape: closed shape: circle ~50 px, closed shape: circle ~55 px, closed shape: c” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flowchart | 2 | — | — | 2/2 (100%) | 0% | 6/9 (67%) | 4/6 (67%) | 4/4 (100%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| tree | 1 | — | — | 1/1 (100%) | 0% | 5/6 (83%) | 3/5 (60%) | 3/3 (100%) | — | — | — | 1/1 (100%) |
| **total** | 3 | — | — | 3/3 (100%) | 0% | 11/15 (73%) | 7/11 (64%) | 7/7 (100%) | 1/2 (50%) | 1.00 | — | 3/3 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
