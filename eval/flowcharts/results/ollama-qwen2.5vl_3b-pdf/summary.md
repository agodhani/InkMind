# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T04:03:34.842Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | flowchart | — | — | 1/1 | 0% | 4/4 | 0/2 · P 0/3 | 1/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 1226.3s · flowchart: “Shape: triangle, diamond. Labels: input, ok?, yes, output, triangle. Steps: inpu” |
| 2 | flowchart | — | — | 1/1 | 0% | 5/5 | 2/4 · P 2/3 | 0/1 τ 1 | — | 1/1 ✓ | 1 blocks (diagram:1), 986.1s · flowchart: “Shape: start, load data, train, eval, done. Labels: start, train, eval, done. Ne” |
| 3 | tree | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 2 | — | — | 2/2 (100%) | 0% | 9/9 (100%) | 2/6 (33%) | 2/6 (33%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
