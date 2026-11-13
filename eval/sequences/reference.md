<!-- page 1 -->
<!-- sequence-diagram #71: sequence diagram between user, app, api, cache with 6 numbered messages -->


```json figures
{ "kind": "sequence-diagram", "seed": 71, "messiness": "normal", "figures": [
  {"id":"fig1","type":"sequence-diagram","description":"sequence diagram between user, app, api, cache with 6 numbered messages","labels":["user","app","api","cache","open page","get key","miss","fetch","json","render"],"nodes":["user","app","api","cache"],"edges":[{"from":"user","to":"app","label":"open page"},{"from":"app","to":"cache","label":"get key"},{"from":"cache","to":"app","label":"miss"},{"from":"app","to":"api","label":"fetch"},{"from":"api","to":"app","label":"json"},{"from":"app","to":"user","label":"render"}],"sequence":["open page","get key","miss","fetch","json","render"],"bbox":{"left":104,"top":41,"right":821,"bottom":609},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36","s37","s38","s39","s40","s41","s42","s43","s44","s45","s46","s47","s48","s49","s50","s51","s52","s53","s54","s55","s56","s57","s58","s59","s60","s61","s62","s63","s64","s65","s66","s67","s68","s69","s70","s71","s72","s73","s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87","s88","s89","s90","s91","s92","s93","s94","s95","s96","s97","s98","s99","s100","s101","s102","s103","s104","s105","s106","s107","s108","s109","s110","s111","s112","s113","s114","s115","s116","s117","s118","s119","s120","s121","s122","s123","s124","s125","s126","s127","s128","s129","s130","s131","s132","s133","s134","s135","s136","s137","s138","s139","s140","s141","s142","s143","s144","s145","s146","s147","s148","s149","s150","s151","s152","s153","s154","s155","s156","s157","s158","s159","s160","s161","s162","s163","s164","s165","s166","s167","s168","s169","s170","s171","s172","s173","s174","s175","s176","s177","s178","s179","s180","s181","s182","s183","s184","s185","s186","s187","s188","s189","s190","s191","s192","s193","s194","s195","s196","s197","s198","s199","s200","s201","s202","s203","s204","s205","s206","s207","s208","s209","s210","s211","s212","s213"]}
] }
```

<!-- page 2 -->
<!-- sequence-diagram #72 (messy): sequence diagram between agent, env with 4 numbered messages -->


```json figures
{ "kind": "sequence-diagram", "seed": 72, "messiness": "messy", "figures": [
  {"id":"fig1","type":"sequence-diagram","description":"sequence diagram between agent, env with 4 numbered messages","labels":["agent","env","action","state","reward","reset"],"nodes":["agent","env"],"edges":[{"from":"agent","to":"env","label":"action"},{"from":"env","to":"agent","label":"state"},{"from":"env","to":"agent","label":"reward"},{"from":"agent","to":"env","label":"reset"}],"sequence":["action","state","reward","reset"],"bbox":{"left":146,"top":35,"right":545,"bottom":433},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36","s37","s38","s39","s40","s41","s42","s43","s44","s45","s46","s47","s48","s49","s50","s51","s52","s53","s54","s55","s56","s57","s58","s59","s60","s61","s62","s63","s64","s65","s66","s67","s68","s69","s70","s71","s72","s73","s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87","s88","s89","s90","s91","s92","s93","s94","s95","s96","s97","s98","s99","s100","s101","s102","s103","s104","s105","s106","s107","s108","s109","s110"]}
] }
```

<!-- page 3 -->
<!-- timeline #73: pipeline of 6 numbered steps: tokenize → embed → attend → MLP → norm → logits -->


```json figures
{ "kind": "timeline", "seed": 73, "messiness": "normal", "figures": [
  {"id":"fig1","type":"timeline","description":"pipeline of 6 numbered steps: tokenize → embed → attend → MLP → norm → logits","labels":["tokenize","1","embed","2","attend","3","MLP","4","norm","5","logits","6"],"nodes":["tokenize","embed","attend","MLP","norm","logits"],"edges":[{"from":"tokenize","to":"embed"},{"from":"embed","to":"attend"},{"from":"attend","to":"MLP"},{"from":"MLP","to":"norm"},{"from":"norm","to":"logits"}],"sequence":["tokenize","embed","attend","MLP","norm","logits"],"bbox":{"left":95,"top":127,"right":668,"bottom":355},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36","s37","s38","s39","s40","s41","s42","s43","s44","s45","s46","s47","s48","s49","s50","s51","s52","s53","s54","s55","s56","s57","s58","s59","s60","s61","s62","s63","s64","s65","s66","s67","s68","s69","s70","s71","s72","s73","s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87","s88","s89","s90","s91","s92","s93"]}
] }
```

<!-- page 4 -->
<!-- timeline #74 (messy): pipeline of 5 numbered steps: collect → clean → train → eval → deploy -->


```json figures
{ "kind": "timeline", "seed": 74, "messiness": "messy", "figures": [
  {"id":"fig1","type":"timeline","description":"pipeline of 5 numbered steps: collect → clean → train → eval → deploy","labels":["collect","1","clean","2","train","3","eval","4","deploy","5"],"nodes":["collect","clean","train","eval","deploy"],"edges":[{"from":"collect","to":"clean"},{"from":"clean","to":"train"},{"from":"train","to":"eval"},{"from":"eval","to":"deploy"}],"sequence":["collect","clean","train","eval","deploy"],"bbox":{"left":78,"top":107,"right":868,"bottom":187},"strokeIds":["s0","s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36","s37","s38","s39","s40","s41","s42","s43","s44","s45","s46","s47","s48","s49","s50","s51","s52","s53","s54","s55","s56","s57","s58","s59","s60","s61","s62","s63","s64"]}
] }
```
