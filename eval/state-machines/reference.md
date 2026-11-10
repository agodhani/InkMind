<!-- page 1 -->
<!-- state-machine #61: state machine with states S0, S1, S2, S3; start S0, accepting S3 -->


```json figures
{ "kind": "state-machine", "seed": 61, "messiness": "normal", "figures": [
  {"id":"fig1","type":"state-machine","description":"state machine with states S0, S1, S2, S3; start S0, accepting S3","labels":["S0","S1","S2","S3","0","1","1","0","0"],"nodes":["S0","S1","S2","S3"],"edges":[{"from":"S0","to":"S1","label":"0"},{"from":"S0","to":"S0","label":"1"},{"from":"S1","to":"S2","label":"1"},{"from":"S2","to":"S3","label":"0"},{"from":"S3","to":"S1","label":"0"}],"bbox":{"left":58,"top":202,"right":757,"bottom":316},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33"]}
] }
```

<!-- page 2 -->
<!-- state-machine #62 (messy): state machine with states q0, q1, q2; start q0, accepting q2 -->


```json figures
{ "kind": "state-machine", "seed": 62, "messiness": "messy", "figures": [
  {"id":"fig1","type":"state-machine","description":"state machine with states q0, q1, q2; start q0, accepting q2","labels":["q0","q1","q2","a","b","a","c"],"nodes":["q0","q1","q2"],"edges":[{"from":"q0","to":"q1","label":"a"},{"from":"q1","to":"q2","label":"b"},{"from":"q1","to":"q1","label":"a"},{"from":"q2","to":"q0","label":"c"}],"bbox":{"left":51,"top":194,"right":753,"bottom":334},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35"]}
] }
```

<!-- page 3 -->
<!-- state-machine #63: state machine with states S0, S1, S2, S3; start S0, accepting S3 -->


```json figures
{ "kind": "state-machine", "seed": 63, "messiness": "normal", "figures": [
  {"id":"fig1","type":"state-machine","description":"state machine with states S0, S1, S2, S3; start S0, accepting S3","labels":["S0","S1","S2","S3","0","1","1","0","0"],"nodes":["S0","S1","S2","S3"],"edges":[{"from":"S0","to":"S1","label":"0"},{"from":"S0","to":"S0","label":"1"},{"from":"S1","to":"S2","label":"1"},{"from":"S2","to":"S3","label":"0"},{"from":"S3","to":"S1","label":"0"}],"bbox":{"left":57,"top":200,"right":758,"bottom":315},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31"]}
] }
```

<!-- page 4 -->
<!-- state-machine #64 (messy): state machine with states idle, run, wait, done; start idle, accepting done -->


```json figures
{ "kind": "state-machine", "seed": 64, "messiness": "messy", "figures": [
  {"id":"fig1","type":"state-machine","description":"state machine with states idle, run, wait, done; start idle, accepting done","labels":["idle","run","wait","done","start","io","ready","exit","tick"],"nodes":["idle","run","wait","done"],"edges":[{"from":"idle","to":"run","label":"start"},{"from":"run","to":"wait","label":"io"},{"from":"wait","to":"run","label":"ready"},{"from":"run","to":"done","label":"exit"},{"from":"run","to":"run","label":"tick"}],"bbox":{"left":57,"top":194,"right":761,"bottom":348},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36","s37","s38","s39","s40","s41","s42","s43","s44","s45","s46","s47","s48","s49","s50","s51","s52","s53","s54","s55","s56","s57","s58","s59","s60","s61","s62","s63","s64","s65","s66","s67","s68","s69","s70","s71","s72","s73","s74","s75","s76","s77","s78","s79","s80","s81","s82","s83"]}
] }
```
