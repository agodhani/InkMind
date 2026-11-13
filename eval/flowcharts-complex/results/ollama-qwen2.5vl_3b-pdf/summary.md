# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T04:52:34.950Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | flowchart-complex | — | — | 1/1 | 0% | 9/10 | 3/7 · P 3/7 | — | — | 2/1 ✗ | 2 blocks (diagram:2), 816.5s · flowchart-complex: “Shape: ellipse, text, rectangle. Table: 3 rows × 3 columns. Labels: start, read ” |
| 2 | flowchart-complex (messy) | — | — | 1/1 | 0% | 6/7 | 4/5 · P 4/8 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 243.4s · flowchart-complex: “Shape: box, diamond. Table: 2 rows × 4 columns. Labels: request, cached?, hit, r” |
| 3 | flowchart-complex | — | — | 0/1 | 0% | 7/8 | 5/6 · P 5/5 | — | — | 4/1 ✗ | 4 blocks (diagram:4), 315.5s · flowchart-complex: “Shape: ellipse, rectangle, diamond. Table: 3 rows × 2 columns. Labels: init, sam” |
| 4 | flowchart-complex (messy) | — | — | 1/1 | 0% | 6/7 | 1/5 · P 1/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 316.6s · flowchart-complex: “Shape: rectangle, closed 5-sided shape. Labels: request, cached?, hit, miss, fet” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | — | — | 3/4 (75%) | 0% | 28/32 (88%) | 13/23 (57%) | 13/25 (52%) | — | — | — | 2/4 (50%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
