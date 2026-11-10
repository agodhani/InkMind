# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-10T05:15:14.047Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | state-machine | — | — | 1/1 | 0% | 9/9 | 3/5 · P 3/3 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 66.3s · state-machine: “Shape: circle. Labels: S0, S1, S2, S3. Relations: S0 → S1 (1), S1 → S2 (0), S2 →” |
| 2 | state-machine (messy) | — | — | 1/1 | 0% | 4/7 | 1/4 · P 1/3 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 69.6s · state-machine: “Shape: 4 free arrows. Labels: q0, ε, q1, q2. Relations: q0 → ε (c1), ε → q1 (b),” |
| 3 | state-machine | — | — | 1/1 | 0% | 9/9 | 3/5 · P 3/3 | — | — | 1/1 ✓ | 1 blocks (diagram:1), 72.9s · state-machine: “Shape: circle. Labels: S0, S1, S2, S3. Relations: S0 → S1 (0), S1 → S2 (1), S2 →” |
| 4 | state-machine (messy) | — | — | 1/1 | 0% | 0/9 | 0/5 · P 0/0 | — | — | 2/1 ✗ | 2 blocks (diagram:2), 55.9s · state-machine: “Shape: circle ~62 px, curve, curve, curve, arrow, arrow, arrow.” |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 4 | — | — | 4/4 (100%) | 0% | 22/34 (65%) | 7/19 (37%) | 7/9 (78%) | — | — | — | 3/4 (75%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
