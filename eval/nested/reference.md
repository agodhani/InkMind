<!-- page 1 -->
<!-- nested-boxes #91: nested shapes: outer containing inner -->


```json figures
{ "kind": "nested-boxes", "seed": 91, "messiness": "normal", "figures": [
  {"id":"fig1","type":"nested-boxes","description":"nested shapes: outer containing inner","labels":["outer","inner","core"],"nodes":["outer","inner","core"],"contains":[{"outer":"outer","inner":"inner"},{"outer":"inner","inner":"core"}],"bbox":{"left":56,"top":41,"right":743,"bottom":511},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28"]}
] }
```

<!-- page 2 -->
<!-- nested-boxes #92 (messy): nested shapes: system containing frontend, backend -->


```json figures
{ "kind": "nested-boxes", "seed": 92, "messiness": "messy", "figures": [
  {"id":"fig1","type":"nested-boxes","description":"nested shapes: system containing frontend, backend","labels":["system","frontend","ui","backend","api","db"],"nodes":["system","frontend","ui","backend","api","db"],"contains":[{"outer":"system","inner":"frontend"},{"outer":"frontend","inner":"ui"},{"outer":"system","inner":"backend"},{"outer":"backend","inner":"api"},{"outer":"backend","inner":"db"}],"bbox":{"left":43,"top":38,"right":757,"bottom":523},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36","s37","s38","s39","s40","s41","s42","s43","s44","s45","s46","s47","s48","s49","s50","s51","s52","s53","s54","s55","s56","s57","s58","s59","s60","s61","s62","s63","s64"]}
] }
```

<!-- page 3 -->
<!-- venn #93: Venn diagram of A, B with "A∩B" in the overlap -->


```json figures
{ "kind": "venn", "seed": 93, "messiness": "normal", "figures": [
  {"id":"fig1","type":"venn","description":"Venn diagram of A, B with \"A∩B\" in the overlap","labels":["A","B","A∩B"],"nodes":["A","B"],"contains":[{"outer":"A","inner":"A∩B"},{"outer":"B","inner":"A∩B"}],"bbox":{"left":47,"top":68,"right":698,"bottom":491},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14"]}
] }
```

<!-- page 4 -->
<!-- venn #94 (messy): Venn diagram of cats, dogs with "pets" in the overlap -->


```json figures
{ "kind": "venn", "seed": 94, "messiness": "messy", "figures": [
  {"id":"fig1","type":"venn","description":"Venn diagram of cats, dogs with \"pets\" in the overlap","labels":["cats","fur","dogs","bark","pets"],"nodes":["cats","dogs"],"contains":[{"outer":"cats","inner":"fur"},{"outer":"dogs","inner":"bark"},{"outer":"cats","inner":"pets"},{"outer":"dogs","inner":"pets"}],"bbox":{"left":67,"top":59,"right":706,"bottom":497},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36"]}
] }
```
