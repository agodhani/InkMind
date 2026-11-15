# Synthetic shape suite — final-3b

14 dataset(s): shapes-basic, graphs, cubes-3d, flowcharts, mixed-notes, flowcharts-complex, state-machines, sequences, trees-graphs, nested, charts, tables-mindmaps, math-sketches, notes-complex · 2026-11-15T22:56:39.455Z

## By dataset

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `shapes-basic` | 8 | — | — | 8/8 (100%) | 0% | — | — | — | — | — | — | 8/8 (100%) |
| `graphs` | 4 | — | — | 4/4 (100%) | 0% | 14/20 (70%) | — | — | — | — | — | 4/4 (100%) |
| `cubes-3d` | 3 | — | — | 3/3 (100%) | 0% | 9/9 (100%) | — | — | — | — | — | 3/3 (100%) |
| `flowcharts` | 3 | — | — | 3/3 (100%) | 0% | 15/15 (100%) | 6/11 (55%) | 6/11 (55%) | 1/2 (50%) | 1.00 | — | 3/3 (100%) |
| `mixed-notes` | 3 | 0.104 | 0.065 | 1/3 (33%) | 0% | 12/12 (100%) | — | 0/8 (0%) | — | — | — | 2/3 (67%) |
| `flowcharts-complex` | 4 | — | — | 4/4 (100%) | 0% | 24/32 (75%) | 8/23 (35%) | 8/18 (44%) | — | — | — | 4/4 (100%) |
| `state-machines` | 4 | — | — | 4/4 (100%) | 0% | 22/34 (65%) | 5/19 (26%) | 5/16 (31%) | — | — | — | 4/4 (100%) |
| `sequences` | 4 | — | — | 4/4 (100%) | 0% | 24/38 (63%) | 13/19 (68%) | 13/17 (76%) | 3/4 (75%) | 1.00 | — | 4/4 (100%) |
| `trees-graphs` | 4 | — | — | 4/4 (100%) | 0% | 22/29 (76%) | 16/29 (55%) | 16/23 (70%) | — | — | — | 4/4 (100%) |
| `nested` | 4 | — | — | 4/4 (100%) | 0% | 7/17 (41%) | — | 0/5 (0%) | — | — | 3/13 (23%) | 4/4 (100%) |
| `charts` | 4 | — | — | 4/4 (100%) | 0% | 15/35 (43%) | — | 0/1 (0%) | 1/4 (25%) | 1.00 | — | 4/4 (100%) |
| `tables-mindmaps` | 4 | — | — | 4/4 (100%) | 0% | 32/38 (84%) | 0/16 (0%) | 0/11 (0%) | 1/2 (50%) | 1.00 | — | 4/4 (100%) |
| `math-sketches` | 5 | — | — | 5/5 (100%) | 0% | 15/27 (56%) | — | — | 1/1 (100%) | 1.00 | — | 5/5 (100%) |
| `notes-complex` | 4 | 0.436 | 0.376 | 7/9 (78%) | 0% | 28/67 (42%) | 9/26 (35%) | 9/13 (69%) | 2/6 (33%) | 1.00 | — | 2/4 (50%) |
| *legacy five* | 21 | 0.104 | 0.065 | 19/21 (90%) | 0% | 50/56 (89%) | 6/11 (55%) | 6/19 (32%) | 1/2 (50%) | 1.00 | — | 20/21 (95%) |
| *wave 2* | 37 | 0.436 | 0.376 | 40/42 (95%) | 0% | 189/317 (60%) | 51/132 (39%) | 51/104 (49%) | 8/17 (47%) | 1.00 | 3/13 (23%) | 35/37 (95%) |
| **total** | 58 | 0.294 | 0.243 | 59/63 (94%) | 0% | 239/373 (64%) | 57/143 (40%) | 57/123 (46%) | 9/19 (47%) | 1.00 | 3/13 (23%) | 55/58 (95%) |

## By scene kind

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| arrow | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| bar-chart | 2 | — | — | 2/2 (100%) | 0% | 6/8 (75%) | — | — | — | — | — | 2/2 (100%) |
| bar-stacked | 1 | — | — | 1/1 (100%) | 0% | 6/10 (60%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| bar-values | 1 | — | — | 1/1 (100%) | 0% | 5/7 (71%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| box-3d | 1 | — | — | 1/1 (100%) | 0% | 3/3 (100%) | — | — | — | — | — | 1/1 (100%) |
| circle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| cube | 2 | — | — | 2/2 (100%) | 0% | 6/6 (100%) | — | — | — | — | — | 2/2 (100%) |
| curved-arrow | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| ellipse | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| flowchart | 2 | — | — | 2/2 (100%) | 0% | 9/9 (100%) | 4/6 (67%) | 4/6 (67%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| flowchart-complex | 4 | — | — | 4/4 (100%) | 0% | 24/32 (75%) | 8/23 (35%) | 8/18 (44%) | — | — | — | 4/4 (100%) |
| graph | 2 | — | — | 2/2 (100%) | 0% | 8/12 (67%) | — | — | — | — | — | 2/2 (100%) |
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 4/10 (40%) | 4/4 (100%) | — | — | — | 2/2 (100%) |
| line | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 16/18 (89%) | 0/16 (0%) | 0/11 (0%) | — | — | — | 2/2 (100%) |
| mixed-notes | 3 | 0.104 | 0.065 | 1/3 (33%) | 0% | 12/12 (100%) | — | 0/8 (0%) | — | — | — | 2/3 (67%) |
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 4/9 (44%) | — | 0/3 (0%) | — | — | 1/7 (14%) | 2/2 (100%) |
| notes-complex | 4 | 0.436 | 0.376 | 7/9 (78%) | 0% | 28/67 (42%) | 9/26 (35%) | 9/13 (69%) | 2/6 (33%) | 1.00 | — | 2/4 (50%) |
| number-line | 1 | — | — | 1/1 (100%) | 0% | 3/4 (75%) | — | — | 1/1 (100%) | 1.00 | — | 1/1 (100%) |
| plot-multi | 2 | — | — | 2/2 (100%) | 0% | 4/18 (22%) | — | 0/1 (0%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| rectangle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| sequence-diagram | 2 | — | — | 2/2 (100%) | 0% | 11/16 (69%) | 6/10 (60%) | 6/10 (60%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| square | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| state-machine | 4 | — | — | 4/4 (100%) | 0% | 22/34 (65%) | 5/19 (26%) | 5/16 (31%) | — | — | — | 4/4 (100%) |
| table | 2 | — | — | 2/2 (100%) | 0% | 16/20 (80%) | — | — | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| timeline | 2 | — | — | 2/2 (100%) | 0% | 13/22 (59%) | 7/9 (78%) | 7/7 (100%) | 2/2 (100%) | 1.00 | — | 2/2 (100%) |
| tree | 1 | — | — | 1/1 (100%) | 0% | 6/6 (100%) | 2/5 (40%) | 2/5 (40%) | — | — | — | 1/1 (100%) |
| tree-deep | 2 | — | — | 2/2 (100%) | 0% | 14/21 (67%) | 12/19 (63%) | 12/19 (63%) | — | — | — | 2/2 (100%) |
| triangle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| triangle-labelled | 2 | — | — | 2/2 (100%) | 0% | 9/13 (69%) | — | — | — | — | — | 2/2 (100%) |
| unit-circle | 2 | — | — | 2/2 (100%) | 0% | 3/10 (30%) | — | — | — | — | — | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 3/8 (38%) | — | 0/2 (0%) | — | — | 2/6 (33%) | 2/2 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
