# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T02:08:39.196Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | graph | — | — | 1/1 | 0% | 4/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 97.2s · graph: “Shape: x-axis, y-axis. Labels: pi, 2pi. Relations: pi → 2pi.” |
| 2 | graph | — | — | 1/1 | 0% | 6/7 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 230.5s · graph: “Shape: x-axis, y-axis. Labels: R, epoch, 1, 2, 3, 4. Steps: 1 → 2 → 3 → 4. Relat” |
| 3 | bar-chart | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |
| 4 | bar-chart | — | — | 1/1 | 0% | 3/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 343.6s · bar-chart: “Shape: free arrow, label (3b), label (7b), label (72b). Labels: 3b, 7b, 72b, fre” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bar-chart | 1 | — | — | 1/1 (100%) | 0% | 3/4 (75%) | — | 0/2 (0%) | — | — | — | 1/1 (100%) |
| graph | 2 | — | — | 2/2 (100%) | 0% | 10/12 (83%) | — | 0/4 (0%) | — | — | — | 2/2 (100%) |
| **total** | 3 | — | — | 3/3 (100%) | 0% | 13/16 (81%) | — | 0/6 (0%) | — | — | — | 3/3 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
