# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T05:10:03.786Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | state-machine | — | — | 1/1 | 0% | 9/9 | 1/5 · P 1/2 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 379.0s · state-machine: “Shape: circle. Labels: S0, S1, S2, S3, 1, 0. Steps: S0 → S2 → S3. Relations: S0 ” |
| 2 | state-machine (messy) | — | — | 1/1 | 0% | 6/7 | 2/4 · P 2/2 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 162.8s · state-machine: “Shape: circle. Labels: q0, q1, q2, a, b. Steps: q0 → q1 → q2. Relations: q0 → q1” |
| 3 | state-machine | — | — | 1/1 | 0% | 9/9 | 2/5 · P 2/4 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 262.1s · state-machine: “Shape: circle. Labels: S0, S1, S2, S3, 1, 0. Steps: S0 → S1 → S2. Nested: S0 ins” |
| 4 | state-machine (messy) | — | — | 1/1 | 0% | 0/9 | 0/5 · P 0/2 | — | — | 2/1 ✗ | 2 blocks (diagram:2), 244.9s · state-machine: “Shape: circle ~62 px, curve, curve, curve, arrow, curved arrow, curved arrow. Re” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | — | — | 4/4 (100%) | 0% | 24/34 (71%) | 5/19 (26%) | 5/10 (50%) | — | — | — | 3/4 (75%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
