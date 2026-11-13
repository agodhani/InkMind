# Synthetic shape suite — ollama-qwen2.5vl_3b-pdf

14 dataset(s): shapes-basic, graphs, cubes-3d, flowcharts, mixed-notes, flowcharts-complex, state-machines, sequences, trees-graphs, nested, charts, tables-mindmaps, math-sketches, notes-complex · 2026-11-13T09:43:44.948Z

## By dataset

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `shapes-basic` | 8 | — | — | 7/8 (88%) | 17% | — | — | 0/7 (0%) | — | — | — | 7/8 (88%) |
| `graphs` | 3 | — | — | 3/3 (100%) | 0% | 13/16 (81%) | — | 0/6 (0%) | — | — | — | 3/3 (100%) |
| `cubes-3d` | 3 | — | — | 3/3 (100%) | 0% | 4/9 (44%) | — | 0/4 (0%) | — | — | — | 3/3 (100%) |
| `flowcharts` | 2 | — | — | 2/2 (100%) | 0% | 9/9 (100%) | 2/6 (33%) | 2/6 (33%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| `mixed-notes` | 3 | 0.814 | 0.733 | 0/3 (0%) | 0% | 8/12 (67%) | — | — | — | — | — | 2/3 (67%) |
| `flowcharts-complex` | 4 | — | — | 3/4 (75%) | 0% | 28/32 (88%) | 13/23 (57%) | 13/25 (52%) | — | — | — | 2/4 (50%) |
| `state-machines` | 4 | — | — | 4/4 (100%) | 0% | 24/34 (71%) | 5/19 (26%) | 5/10 (50%) | — | — | — | 3/4 (75%) |
| `sequences` | 1 | — | — | 1/1 (100%) | 0% | 6/12 (50%) | 2/5 (40%) | 2/5 (40%) | 0/1 (0%) | 0.33 | — | 1/1 (100%) |
| `trees-graphs` | 4 | — | — | 3/4 (75%) | 0% | 22/29 (76%) | 13/29 (45%) | 13/20 (65%) | — | — | — | 3/4 (75%) |
| `nested` | 4 | — | — | 4/4 (100%) | 0% | 11/17 (65%) | — | 0/3 (0%) | — | — | 0/13 (0%) | 4/4 (100%) |
| `charts` | 2 | — | — | 2/2 (100%) | 0% | 4/18 (22%) | — | 0/3 (0%) | 0/2 (0%) | — | — | 2/2 (100%) |
| `tables-mindmaps` | 4 | — | — | 3/4 (75%) | 10% | 16/38 (42%) | 9/16 (56%) | 9/16 (56%) | 0/2 (0%) | — | — | 4/4 (100%) |
| `math-sketches` | 5 | — | — | 5/5 (100%) | 0% | 4/27 (15%) | — | 0/4 (0%) | 0/1 (0%) | — | — | 5/5 (100%) |
| `notes-complex` | 4 | 0.851 | 0.810 | 0/9 (0%) | 0% | 4/67 (6%) | 0/26 (0%) | 0/1 (0%) | 0/6 (0%) | — | — | 2/4 (50%) |
| *legacy five* | 19 | 0.814 | 0.733 | 15/19 (79%) | 1% | 34/46 (74%) | 2/6 (33%) | 2/23 (9%) | 1/2 (50%) | 1.00 | — | 17/19 (89%) |
| *wave 2* | 32 | 0.851 | 0.810 | 25/37 (68%) | 1% | 119/274 (43%) | 42/118 (36%) | 42/87 (48%) | 0/12 (0%) | 0.33 | 0/13 (0%) | 26/32 (81%) |
| **total** | 51 | 0.835 | 0.777 | 40/56 (71%) | 1% | 153/320 (48%) | 44/124 (35%) | 44/110 (40%) | 1/14 (7%) | 0.78 | 0/13 (0%) | 43/51 (84%) |

## By scene kind

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| arrow | 1 | — | — | 0/1 (0%) | 100% | — | — | — | — | — | — | 0/1 (0%) |
| bar-chart | 1 | — | — | 1/1 (100%) | 0% | 3/4 (75%) | — | 0/2 (0%) | — | — | — | 1/1 (100%) |
| box-3d | 1 | — | — | 1/1 (100%) | 0% | 0/3 (0%) | — | — | — | — | — | 1/1 (100%) |
| circle | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| cube | 2 | — | — | 2/2 (100%) | 0% | 4/6 (67%) | — | 0/4 (0%) | — | — | — | 2/2 (100%) |
| curved-arrow | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| ellipse | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/2 (0%) | — | — | — | 1/1 (100%) |
| flowchart | 2 | — | — | 2/2 (100%) | 0% | 9/9 (100%) | 2/6 (33%) | 2/6 (33%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| flowchart-complex | 4 | — | — | 3/4 (75%) | 0% | 28/32 (88%) | 13/23 (57%) | 13/25 (52%) | — | — | — | 2/4 (50%) |
| graph | 2 | — | — | 2/2 (100%) | 0% | 10/12 (83%) | — | 0/4 (0%) | — | — | — | 2/2 (100%) |
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 6/10 (60%) | 6/8 (75%) | — | — | — | 2/2 (100%) |
| line | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 16/18 (89%) | 9/16 (56%) | 9/16 (56%) | — | — | — | 2/2 (100%) |
| mixed-notes | 3 | 0.814 | 0.733 | 0/3 (0%) | 0% | 8/12 (67%) | — | — | — | — | — | 2/3 (67%) |
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 5/9 (56%) | — | 0/1 (0%) | — | — | 0/7 (0%) | 2/2 (100%) |
| notes-complex | 4 | 0.851 | 0.810 | 0/9 (0%) | 0% | 4/67 (6%) | 0/26 (0%) | 0/1 (0%) | 0/6 (0%) | — | — | 2/4 (50%) |
| number-line | 1 | — | — | 1/1 (100%) | 0% | 0/4 (0%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| plot-multi | 2 | — | — | 2/2 (100%) | 0% | 4/18 (22%) | — | 0/3 (0%) | 0/2 (0%) | — | — | 2/2 (100%) |
| rectangle | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| square | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| state-machine | 4 | — | — | 4/4 (100%) | 0% | 24/34 (71%) | 5/19 (26%) | 5/10 (50%) | — | — | — | 3/4 (75%) |
| table | 2 | — | — | 1/2 (50%) | 27% | 0/20 (0%) | — | — | 0/2 (0%) | — | — | 2/2 (100%) |
| timeline | 1 | — | — | 1/1 (100%) | 0% | 6/12 (50%) | 2/5 (40%) | 2/5 (40%) | 0/1 (0%) | 0.33 | — | 1/1 (100%) |
| tree-deep | 2 | — | — | 1/2 (50%) | 0% | 14/21 (67%) | 7/19 (37%) | 7/12 (58%) | — | — | — | 1/2 (50%) |
| triangle | 1 | — | — | 1/1 (100%) | 0% | — | — | 0/1 (0%) | — | — | — | 1/1 (100%) |
| triangle-labelled | 2 | — | — | 2/2 (100%) | 0% | 0/13 (0%) | — | 0/2 (0%) | — | — | — | 2/2 (100%) |
| unit-circle | 2 | — | — | 2/2 (100%) | 0% | 4/10 (40%) | — | 0/2 (0%) | — | — | — | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 6/8 (75%) | — | 0/2 (0%) | — | — | 0/6 (0%) | 2/2 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
