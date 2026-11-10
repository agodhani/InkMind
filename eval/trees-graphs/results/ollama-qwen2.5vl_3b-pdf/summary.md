# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:34:52.591Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tree-deep | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |
| 2 | tree-deep (messy) | — | — | 0/1 | 0% | 4/11 | 2/10 · P 2/4 | — | — | 2/1 ✗ | 2 blocks (diagram:2), 101.9s · tree-deep: “Shape: closed shape: closed 5-sided shape. Labels: CEO, CTO, CFO, HR, S. Relatio” |
| 3 | graph-crossing | — | — | 1/1 | 0% | 4/4 | 6/6 · P 6/6 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 99.6s · graph-crossing: “Shape: circle. Labels: A, B, C, D. Relations: A → B (edge), A → C (edge), A → D ” |
| 4 | graph-crossing (messy) | — | — | 1/1 | 0% | 4/4 | 2/4 · P 2/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 66.2s · graph-crossing: “Shape: arrow ← left, arrow → right. Labels: P, Q, R, S. Relations: P → Q, P → R,” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 8/10 (80%) | 8/10 (80%) | — | — | — | 2/2 (100%) |
| tree-deep | 1 | — | — | 0/1 (0%) | 0% | 4/11 (36%) | 2/10 (20%) | 2/4 (50%) | — | — | — | 0/1 (0%) |
| **total** | 3 | — | — | 2/3 (67%) | 0% | 12/19 (63%) | 10/20 (50%) | 10/14 (71%) | — | — | — | 2/3 (67%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
