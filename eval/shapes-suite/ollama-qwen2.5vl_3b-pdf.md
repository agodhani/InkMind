# Synthetic shape suite — ollama-qwen2.5vl_3b-pdf

14 dataset(s): shapes-basic, graphs, cubes-3d, flowcharts, mixed-notes, flowcharts-complex, state-machines, sequences, trees-graphs, nested, charts, tables-mindmaps, math-sketches, notes-complex · 2026-11-10T06:14:34.775Z

## By dataset

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `shapes-basic` | 8 | — | — | 6/8 (75%) | 22% | — | — | — | — | — | — | 6/8 (75%) |
| `graphs` | 4 | — | — | 4/4 (100%) | 0% | 11/20 (55%) | — | 0/5 (0%) | — | — | — | 4/4 (100%) |
| `cubes-3d` | 3 | — | — | 3/3 (100%) | 0% | 7/9 (78%) | — | 0/3 (0%) | — | — | — | 3/3 (100%) |
| `flowcharts` | 3 | — | — | 3/3 (100%) | 0% | 11/15 (73%) | 7/11 (64%) | 7/7 (100%) | 1/2 (50%) | 1.00 | — | 3/3 (100%) |
| `mixed-notes` | 3 | 0.759 | 0.691 | 0/3 (0%) | 0% | 8/12 (67%) | — | — | — | — | — | 2/3 (67%) |
| `flowcharts-complex` | 3 | — | — | 2/3 (67%) | 0% | 15/25 (60%) | 12/18 (67%) | 12/18 (67%) | — | — | — | 1/3 (33%) |
| `state-machines` | 4 | — | — | 4/4 (100%) | 0% | 22/34 (65%) | 7/19 (37%) | 7/9 (78%) | — | — | — | 3/4 (75%) |
| `sequences` | 3 | — | — | 3/3 (100%) | 0% | 13/26 (50%) | 2/14 (14%) | 2/7 (29%) | 0/3 (0%) | 0.00 | — | 2/3 (67%) |
| `trees-graphs` | 3 | — | — | 2/3 (67%) | 0% | 12/19 (63%) | 10/20 (50%) | 10/14 (71%) | — | — | — | 2/3 (67%) |
| `nested` | 4 | — | — | 4/4 (100%) | 0% | 6/17 (35%) | — | 0/6 (0%) | — | — | 0/13 (0%) | 3/4 (75%) |
| `charts` | 3 | — | — | 3/3 (100%) | 0% | 3/25 (12%) | — | 0/3 (0%) | 0/3 (0%) | — | — | 3/3 (100%) |
| `tables-mindmaps` | 4 | — | — | 2/4 (50%) | 16% | 15/38 (39%) | 7/16 (44%) | 7/14 (50%) | 0/2 (0%) | — | — | 4/4 (100%) |
| `math-sketches` | 5 | — | — | 5/5 (100%) | 0% | 16/27 (59%) | — | 0/3 (0%) | 0/1 (0%) | — | — | 5/5 (100%) |
| `notes-complex` | 3 | 0.831 | 0.770 | 0/7 (0%) | 0% | 3/50 (6%) | 0/15 (0%) | 0/1 (0%) | 0/5 (0%) | 1.00 | — | 1/3 (33%) |
| *legacy five* | 21 | 0.759 | 0.691 | 16/21 (76%) | 1% | 37/56 (66%) | 7/11 (64%) | 7/15 (47%) | 1/2 (50%) | 1.00 | — | 18/21 (86%) |
| *wave 2* | 32 | 0.831 | 0.770 | 25/36 (69%) | 2% | 105/261 (40%) | 38/102 (37%) | 38/75 (51%) | 0/14 (0%) | 0.33 | 0/13 (0%) | 24/32 (75%) |
| **total** | 53 | 0.795 | 0.731 | 41/57 (72%) | 2% | 142/317 (45%) | 45/113 (40%) | 45/90 (50%) | 1/16 (6%) | 0.50 | 0/13 (0%) | 42/53 (79%) |

## By scene kind

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| arrow | 1 | — | — | 0/1 (0%) | 100% | — | — | — | — | — | — | 0/1 (0%) |
| bar-chart | 2 | — | — | 2/2 (100%) | 0% | 3/8 (38%) | — | 0/2 (0%) | — | — | — | 2/2 (100%) |
| bar-stacked | 1 | — | — | 1/1 (100%) | 0% | 0/10 (0%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| bar-values | 1 | — | — | 1/1 (100%) | 0% | 1/7 (14%) | — | 0/2 (0%) | 0/1 (0%) | — | — | 1/1 (100%) |
| box-3d | 1 | — | — | 1/1 (100%) | 0% | 3/3 (100%) | — | — | — | — | — | 1/1 (100%) |
| circle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| cube | 2 | — | — | 2/2 (100%) | 0% | 4/6 (67%) | — | 0/3 (0%) | — | — | — | 2/2 (100%) |
| curved-arrow | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| ellipse | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| flowchart | 2 | — | — | 2/2 (100%) | 0% | 6/9 (67%) | 4/6 (67%) | 4/4 (100%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| flowchart-complex | 3 | — | — | 2/3 (67%) | 0% | 15/25 (60%) | 12/18 (67%) | 12/18 (67%) | — | — | — | 1/3 (33%) |
| graph | 2 | — | — | 2/2 (100%) | 0% | 8/12 (67%) | — | 0/3 (0%) | — | — | — | 2/2 (100%) |
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 8/10 (80%) | 8/10 (80%) | — | — | — | 2/2 (100%) |
| line | 1 | — | — | 0/1 (0%) | 100% | — | — | — | — | — | — | 0/1 (0%) |
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 15/18 (83%) | 7/16 (44%) | 7/14 (50%) | — | — | — | 2/2 (100%) |
| mixed-notes | 3 | 0.759 | 0.691 | 0/3 (0%) | 0% | 8/12 (67%) | — | — | — | — | — | 2/3 (67%) |
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 6/9 (67%) | — | 0/4 (0%) | — | — | 0/7 (0%) | 2/2 (100%) |
| notes-complex | 3 | 0.831 | 0.770 | 0/7 (0%) | 0% | 3/50 (6%) | 0/15 (0%) | 0/1 (0%) | 0/5 (0%) | 1.00 | — | 1/3 (33%) |
| number-line | 1 | — | — | 1/1 (100%) | 0% | 1/4 (25%) | — | — | 0/1 (0%) | — | — | 1/1 (100%) |
| plot-multi | 1 | — | — | 1/1 (100%) | 0% | 2/8 (25%) | — | 0/1 (0%) | 0/1 (0%) | — | — | 1/1 (100%) |
| rectangle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| sequence-diagram | 2 | — | — | 2/2 (100%) | 0% | 10/16 (63%) | 2/10 (20%) | 2/7 (29%) | 0/2 (0%) | -1.00 | — | 2/2 (100%) |
| square | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| state-machine | 4 | — | — | 4/4 (100%) | 0% | 22/34 (65%) | 7/19 (37%) | 7/9 (78%) | — | — | — | 3/4 (75%) |
| table | 2 | — | — | 0/2 (0%) | 45% | 0/20 (0%) | — | — | 0/2 (0%) | — | — | 2/2 (100%) |
| timeline | 1 | — | — | 1/1 (100%) | 0% | 3/10 (30%) | 0/4 (0%) | — | 0/1 (0%) | 1.00 | — | 0/1 (0%) |
| tree | 1 | — | — | 1/1 (100%) | 0% | 5/6 (83%) | 3/5 (60%) | 3/3 (100%) | — | — | — | 1/1 (100%) |
| tree-deep | 1 | — | — | 0/1 (0%) | 0% | 4/11 (36%) | 2/10 (20%) | 2/4 (50%) | — | — | — | 0/1 (0%) |
| triangle | 1 | — | — | 1/1 (100%) | 0% | — | — | — | — | — | — | 1/1 (100%) |
| triangle-labelled | 2 | — | — | 2/2 (100%) | 0% | 7/13 (54%) | — | — | — | — | — | 2/2 (100%) |
| unit-circle | 2 | — | — | 2/2 (100%) | 0% | 8/10 (80%) | — | 0/3 (0%) | — | — | — | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 0/8 (0%) | — | 0/2 (0%) | — | — | 0/6 (0%) | 1/2 (50%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order in the caption, τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs stated in the caption · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
