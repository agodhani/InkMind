# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T12:42:12.224Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | graph | — | — | 1/1 | 0% | 4/5 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 31.5s · graph: “Shape: x/y axes, curved arrow, arrow. Labels: y, sin x, 2pi.” |
| 2 | graph | — | — | 1/1 | 0% | 2/7 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 31.8s · graph: “Shape: x/y axes, curve, arrow. Labels: R, epoch.” |
| 3 | bar-chart | — | — | 1/1 | 0% | 3/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 27.1s · bar-chart: “Shape: x/y axes, curve. Labels: 3b, 7b, 72b.” |
| 4 | bar-chart | — | — | 1/1 | 0% | 3/4 | — | — | — | 1/1 ✓ | 1 blocks (diagram:1), 23.6s · bar-chart: “Shape: x/y axes, curve. Labels: 3b, 7b, 72b.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bar-chart | 2 | — | — | 2/2 (100%) | 0% | 6/8 (75%) | — | — | — | — | — | 2/2 (100%) |
| graph | 2 | — | — | 2/2 (100%) | 0% | 6/12 (50%) | — | — | — | — | — | 2/2 (100%) |
| **total** | 4 | — | — | 4/4 (100%) | 0% | 12/20 (60%) | — | — | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
