# ollama-qwen2.5vl_3b-pdf

Transcriber: `ollama:qwen2.5vl:3b` · image: pdf · render: pdf raster · 2026-11-09T07:03:58.630Z

| page | WER | CER | figures found | text leak | labels found | notes |
|---|---|---|---|---|---|---|
| 1 | 0.409 | 0.437 | 1/1 | 0% | 1/4 | 4 blocks (heading:1, list:1, diagram:1, paragraph:1), 247.4s · tree: “loss” |
| 2 | 0.64 | 0.65 | 1/1 | 0% | 4/4 | 3 blocks (paragraph:2, diagram:1), 155.5s · tree: “loss
CE
KL
MSE
KL term* keeps the policy close” |
| 3 | 0.933 | 0.828 | 1/1 | 0% | 4/4 | 3 blocks (paragraph:1, list:1, diagram:1), 270.5s · flowchart: “input ok? yes output” |
| **total** | **0.661** | **0.638** | **3/3** (100%) | **0%** | **9/12** (75%) | 3 text page(s) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive). WER/CER cover the text parts only.
