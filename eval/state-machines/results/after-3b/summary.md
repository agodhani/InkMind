# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-16T01:54:54.059Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | state-machine | — | — | 1/1 | 0% | 9/9 | 5/5 · P 5/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 31.6s · state-machine: “Shape: double circle, circle ~58 px, circle ~61 px, circle ~49 px, circle ~63 px” |
| 2 | state-machine (messy) | — | — | 1/1 | 0% | 2/7 | 0/4 · P 0/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 34.1s · state-machine: “Shape: double circle, circle ~58 px, circle ~63 px, circle ~65 px, circle ~45 px” |
| 3 | state-machine | — | — | 1/1 | 0% | 9/9 | 5/5 · P 5/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 41.7s · state-machine: “Shape: double circle, circle ~61 px, circle ~63 px, circle ~45 px, circle ~60 px” |
| 4 | state-machine (messy) | — | — | 1/1 | 0% | 2/9 | 0/5 · P 0/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 37.6s · state-machine: “Shape: double circle, circle ~60 px, circle ~57 px, circle ~62 px, circle ~44 px” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | — | — | 4/4 (100%) | 0% | 22/34 (65%) | 10/19 (53%) | 10/18 (56%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
