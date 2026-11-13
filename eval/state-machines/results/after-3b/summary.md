# after-3b

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T12:52:06.822Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | state-machine | — | — | 1/1 | 0% | 9/9 | 3/5 · P 3/5 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 30.2s · state-machine: “Shape: circle ~58 px, circle ~61 px, circle ~49 px, circle ~63 px, arrow, self-l” |
| 2 | state-machine (messy) | — | — | 1/1 | 0% | 1/7 | 0/4 · P 0/3 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 39.9s · state-machine: “Shape: circle ~58 px, circle ~63 px, circle ~65 px, circle ~45 px, curve, arrow,” |
| 3 | state-machine | — | — | 1/1 | 0% | 9/9 | 2/5 · P 2/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 43.8s · state-machine: “Shape: circle ~61 px, circle ~63 px, circle ~45 px, circle ~60 px, curve, arrow,” |
| 4 | state-machine (messy) | — | — | 1/1 | 0% | 2/9 | 0/5 · P 0/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 42.0s · state-machine: “Shape: circle ~60 px, circle ~57 px, circle ~62 px, circle ~44 px, circle ~65 px” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | — | — | 4/4 (100%) | 0% | 21/34 (62%) | 5/19 (26%) | 5/16 (31%) | — | — | — | 4/4 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
