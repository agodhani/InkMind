# Synthetic shape suite — fix-1

5 dataset(s): tables-mindmaps, nested, state-machines, sequences, trees-graphs · 2026-11-16T01:38:16.181Z

## By dataset

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `tables-mindmaps` | 4 | — | — | 4/4 (100%) | 0% | 35/38 (92%) | 16/16 (100%) | 16/16 (100%) | 2/2 (100%) | 1.00 | — | 4/4 (100%) |
| `nested` | 4 | — | — | 4/4 (100%) | 0% | 16/17 (94%) | — | 0/1 (0%) | — | — | 8/13 (62%) | 4/4 (100%) |
| `state-machines` | 4 | — | — | 4/4 (100%) | 2% | 33/34 (97%) | 13/19 (68%) | 13/20 (65%) | — | — | — | 4/4 (100%) |
| `sequences` | 4 | — | — | 4/4 (100%) | 0% | 38/38 (100%) | 17/19 (89%) | 19/19 (100%) | 4/4 (100%) | 1.00 | — | 4/4 (100%) |
| `trees-graphs` | 4 | — | — | 4/4 (100%) | 0% | 27/29 (93%) | 26/29 (90%) | 26/30 (87%) | — | — | — | 4/4 (100%) |
| *legacy five* | 0 | — | — | — | — | — | — | — | — | — | — | — |
| *wave 2* | 20 | — | — | 20/20 (100%) | 0% | 149/156 (96%) | 72/83 (87%) | 74/86 (86%) | 6/6 (100%) | 1.00 | 8/13 (62%) | 20/20 (100%) |
| **total** | 20 | — | — | 20/20 (100%) | 0% | 149/156 (96%) | 72/83 (87%) | 74/86 (86%) | 6/6 (100%) | 1.00 | 8/13 (62%) | 20/20 (100%) |

## By scene kind

| scope | pages | WER | CER | figures found | text leak | labels found | edge recall | edge precision | sequence exact | τ | nesting | figure count ok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| graph-crossing | 2 | — | — | 2/2 (100%) | 0% | 8/8 (100%) | 10/10 (100%) | 10/10 (100%) | — | — | — | 2/2 (100%) |
| mind-map | 2 | — | — | 2/2 (100%) | 0% | 18/18 (100%) | 16/16 (100%) | 16/16 (100%) | — | — | — | 2/2 (100%) |
| nested-boxes | 2 | — | — | 2/2 (100%) | 0% | 9/9 (100%) | — | 0/1 (0%) | — | — | 6/7 (86%) | 2/2 (100%) |
| sequence-diagram | 2 | — | — | 2/2 (100%) | 0% | 16/16 (100%) | 8/10 (80%) | 10/10 (100%) | 2/2 (100%) | 1.00 | — | 2/2 (100%) |
| state-machine | 4 | — | — | 4/4 (100%) | 2% | 33/34 (97%) | 13/19 (68%) | 13/20 (65%) | — | — | — | 4/4 (100%) |
| table | 2 | — | — | 2/2 (100%) | 0% | 17/20 (85%) | — | — | 2/2 (100%) | 1.00 | — | 2/2 (100%) |
| timeline | 2 | — | — | 2/2 (100%) | 0% | 22/22 (100%) | 9/9 (100%) | 9/9 (100%) | 2/2 (100%) | 1.00 | — | 2/2 (100%) |
| tree-deep | 2 | — | — | 2/2 (100%) | 0% | 19/21 (90%) | 16/19 (84%) | 16/20 (80%) | — | — | — | 2/2 (100%) |
| venn | 2 | — | — | 2/2 (100%) | 0% | 7/8 (88%) | — | — | — | — | 2/6 (33%) | 2/2 (100%) |

figures found = a `diagram` block covers ≥80 % of the figure's strokes with ≤20 % foreign strokes · text leak = figure strokes that ended up in text blocks · labels found = expected labels present in the diagram caption (case-insensitive) · edge recall/precision = expected relations `{from,to}` vs the relations the blocks claim (`figure.edges`, else `A → B` in the caption), matched by endpoint label, case-insensitive, `->` == `→`, either direction for undirected figures · sequence exact = ordered step lists reproduced completely and in order (in the structured `figure.sequence`, else in the caption), τ = mean Kendall tau of the steps found · nesting = expected "inner inside outer" pairs vs structured `figure.nodes` parents (else caption phrases) · figure count ok = pages whose number of `diagram` blocks equals the number of expected figures. WER/CER cover the text parts only.
