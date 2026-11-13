# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · reconcile: on · 2026-11-13T05:47:51.728Z

| page | kind | WER | CER | figures found | text leak | labels found | edges found · precision | sequence | nesting | diagram blocks / figures | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | sequence-diagram | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |
| 2 | sequence-diagram (messy) | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |
| 3 | timeline | — | — | 1/1 | 0% | 6/12 | 2/5 · P 2/5 | 0/1 τ 0.333 | — | 1/1 ✓ | 1 blocks (diagram:1), 124.0s · timeline: “Shape: rectangle. Labels: tokenize, embed, attend, logits, norm, MLP. Steps: tok” |
| 4 | timeline (messy) | — | — | — | — | — | — | — | — | — | error (see .raw.txt) |

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **total** | 1 | — | — | 1/1 (100%) | 0% | 6/12 (50%) | 2/5 (40%) | 2/5 (40%) | 0/1 (0%) | 0.33 | — | 1/1 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
