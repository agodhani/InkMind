# Synthetic shape suite — after-3b

5 dataset(s): tables-mindmaps, nested, state-machines, sequences, trees-graphs · 2026-11-16T02:01:41.088Z

## By dataset

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `tables-mindmaps` | 4 | — | — | 4/4 (100%) | 0% | 20/38 (53%) | 1/16 (6%) | 1/16 (6%) | 0/2 (0%) | — | — | 4/4 (100%) |
| `nested` | 4 | — | — | 4/4 (100%) | 0% | 8/17 (47%) | — | 0/13 (0%) | — | — | 3/13 (23%) | 4/4 (100%) |
| `state-machines` | 4 | — | — | 4/4 (100%) | 0% | 22/34 (65%) | 10/19 (53%) | 10/18 (56%) | — | — | — | 4/4 (100%) |
| `sequences` | 4 | — | — | 4/4 (100%) | 0% | 24/38 (63%) | 14/19 (74%) | 14/18 (78%) | 3/4 (75%) | 1.00 | — | 4/4 (100%) |
| `trees-graphs` | 4 | — | — | 4/4 (100%) | 0% | 22/29 (76%) | 22/29 (76%) | 22/28 (79%) | — | — | — | 4/4 (100%) |
| *legacy five* | 0 | — | — | — | — | — | — | — | — | — | — | — |
| *wave 2* | 20 | — | — | 20/20 (100%) | 0% | 96/156 (62%) | 47/83 (57%) | 47/93 (51%) | 3/6 (50%) | 1.00 | 3/13 (23%) | 20/20 (100%) |
| **total** | 20 | — | — | 20/20 (100%) | 0% | 96/156 (62%) | 47/83 (57%) | 47/93 (51%) | 3/6 (50%) | 1.00 | 3/13 (23%) | 20/20 (100%) |

## By scene kind

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 10/10 (100%) | 10/10 (100%) | — | — | — | 2/2 (100%) |
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 16/18 (89%) | 1/16 (6%) | 1/16 (6%) | — | — | — | 2/2 (100%) |
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 4/9 (44%) | — | 0/7 (0%) | — | — | 1/7 (14%) | 2/2 (100%) |
| sequence-diagram | 2 | — | — | 2/2 (100%) | 0% | 11/16 (69%) | 6/10 (60%) | 6/10 (60%) | 1/2 (50%) | 1.00 | — | 2/2 (100%) |
| state-machine | 4 | — | — | 4/4 (100%) | 0% | 22/34 (65%) | 10/19 (53%) | 10/18 (56%) | — | — | — | 4/4 (100%) |
| table | 2 | — | — | 2/2 (100%) | 0% | 4/20 (20%) | — | — | 0/2 (0%) | — | — | 2/2 (100%) |
| timeline | 2 | — | — | 2/2 (100%) | 0% | 13/22 (59%) | 8/9 (89%) | 8/8 (100%) | 2/2 (100%) | 1.00 | — | 2/2 (100%) |
| tree-deep | 2 | — | — | 2/2 (100%) | 0% | 14/21 (67%) | 12/19 (63%) | 12/18 (67%) | — | — | — | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 4/8 (50%) | — | 0/6 (0%) | — | — | 2/6 (33%) | 2/2 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
