<!-- page 1 -->
<!-- notes-complex #131: pipeline: plan → build → test → ship; table day, am, pm -->
# RLHF overview
the pipeline below feeds the chart
fig 1
fig 2
see fig 1 for the numbers
- loss = -log p(y|x)
- alpha-beta prunes dead branches

```json figures
{ "kind": "notes-complex", "seed": 131, "messiness": "normal", "links": [{"from":"fig1","to":"fig2"}], "figures": [
  {"id":"fig1","type":"timeline","description":"pipeline: plan → build → test → ship","labels":["plan","1","build","2","test","3","ship","4"],"nodes":["plan","build","test","ship"],"edges":[{"from":"plan","to":"build"},{"from":"build","to":"test"},{"from":"test","to":"ship"}],"sequence":["plan","build","test","ship"],"bbox":{"left":82,"top":261,"right":458,"bottom":320},"strokeIds":["s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87","s88","s89","s90","s91","s92","s93","s94","s95","s96","s97","s98","s99","s100","s101","s102","s103","s104","s105","s106","s107","s108","s109","s110","s111","s112","s113","s114","s115","s116","s117","s118"]},
  {"id":"fig2","type":"table","description":"table day, am, pm","labels":["day","am","pm","mon","gym","work","tue","read","code"],"sequence":["day","am","pm"],"bbox":{"left":567,"top":266,"right":953,"bottom":391},"strokeIds":["s126","s127","s128","s129","s130","s131","s132","s133","s134","s135","s136","s137","s138","s139","s140","s141","s142","s143","s144","s145","s146","s147","s148","s149","s150","s151","s152","s153","s154","s155","s156","s157","s158","s159","s160","s161","s162","s163","s164","s165","s166","s167","s168","s169","s170","s171","s172","s173","s174","s175","s176","s177","s178","s179","s180","s181","s182","s183","s184","s185","s186","s187","s188","s189"]}
] }
```

<!-- page 2 -->
<!-- notes-complex #132 (messy): graph on P, Q, R, S; table day, am, pm; pipeline: plan → build → test → ship -->
# Attention recap
overview first, then detail
fig 1
fig 2
fig 3
see fig 1 for the states
- learning rate decays over time
- PPO keeps the KL penalty small

```json figures
{ "kind": "notes-complex", "seed": 132, "messiness": "messy", "links": [{"from":"fig1","to":"fig2"},{"from":"fig2","to":"fig3"}], "figures": [
  {"id":"fig1","type":"graph-crossing","description":"graph on P, Q, R, S","labels":["P","Q","R","S"],"nodes":["P","Q","R","S"],"edges":[{"from":"P","to":"S"},{"from":"Q","to":"R"},{"from":"P","to":"Q"},{"from":"R","to":"S"}],"bbox":{"left":105,"top":235,"right":391,"bottom":519},"strokeIds":["s67","s68","s69","s70","s71","s72","s73","s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87"]},
  {"id":"fig2","type":"table","description":"table day, am, pm","labels":["day","am","pm","mon","gym","work","tue","read","code"],"sequence":["day","am","pm"],"bbox":{"left":546,"top":250,"right":935,"bottom":389},"strokeIds":["s95","s96","s97","s98","s99","s100","s101","s102","s103","s104","s105","s106","s107","s108","s109","s110","s111","s112","s113","s114","s115","s116","s117","s118","s119","s120","s121","s122","s123","s124","s125","s126","s127","s128","s129","s130","s131","s132","s133","s134","s135","s136","s137","s138","s139","s140","s141","s142","s143","s144","s145","s146","s147","s148","s149","s150","s151","s152","s153","s154","s155","s156","s157","s158"]},
  {"id":"fig3","type":"timeline","description":"pipeline: plan → build → test → ship","labels":["plan","1","build","2","test","3","ship","4"],"nodes":["plan","build","test","ship"],"edges":[{"from":"plan","to":"build"},{"from":"build","to":"test"},{"from":"test","to":"ship"}],"sequence":["plan","build","test","ship"],"bbox":{"left":280,"top":682,"right":717,"bottom":754},"strokeIds":["s166","s167","s168","s169","s170","s171","s172","s173","s174","s175","s176","s177","s178","s179","s180","s181","s182","s183","s184","s185","s186","s187","s188","s189","s190","s191","s192","s193","s194","s195","s196","s197","s198","s199","s200","s201","s202","s203","s204","s205","s206","s207","s208","s209","s210","s211","s212","s213","s214","s215","s216","s217","s218","s219","s220"]}
] }
```

<!-- page 3 -->
<!-- notes-complex #133: bar chart "runtime s" with values; graph on 1, 2, 3, 4, 5 -->
# Gradient descent
overview first, then detail
fig 1
fig 2
see fig 1 for the steps
- sample N rollouts per prompt
- alpha-beta prunes dead branches

```json figures
{ "kind": "notes-complex", "seed": 133, "messiness": "normal", "links": [{"from":"fig1","to":"fig2"}], "figures": [
  {"id":"fig1","type":"bar-values","description":"bar chart \"runtime s\" with values","labels":["3","A","7","B","5","C","runtime s"],"sequence":["A","B","C"],"bbox":{"left":84,"top":238,"right":471,"bottom":535},"strokeIds":["s67","s68","s69","s70","s71","s72","s73","s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87","s88","s89","s90","s91","s92","s93","s94","s95","s96","s97"]},
  {"id":"fig2","type":"graph-crossing","description":"graph on 1, 2, 3, 4, 5","labels":["1","2","3","4","5"],"nodes":["1","2","3","4","5"],"edges":[{"from":"1","to":"3"},{"from":"3","to":"5"},{"from":"5","to":"2"},{"from":"2","to":"4"},{"from":"4","to":"1"}],"directed":false,"bbox":{"left":620,"top":275,"right":907,"bottom":538},"strokeIds":["s105","s106","s107","s108","s109","s110","s111","s112","s113","s114","s115","s116","s117","s118","s119","s120"]}
] }
```

<!-- page 4 -->
<!-- notes-complex #134 (messy): pipeline: plan → build → test → ship; tree rooted at 8 -->
# RLHF overview
the pipeline below feeds the chart
fig 1
fig 2
fig 1 feeds into fig 2
- sample N rollouts per prompt
- softmax over the keys

```json figures
{ "kind": "notes-complex", "seed": 134, "messiness": "messy", "links": [{"from":"fig1","to":"fig2"}], "figures": [
  {"id":"fig1","type":"timeline","description":"pipeline: plan → build → test → ship","labels":["plan","1","build","2","test","3","ship","4"],"nodes":["plan","build","test","ship"],"edges":[{"from":"plan","to":"build"},{"from":"build","to":"test"},{"from":"test","to":"ship"}],"sequence":["plan","build","test","ship"],"bbox":{"left":84,"top":259,"right":456,"bottom":325},"strokeIds":["s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87","s88","s89","s90","s91","s92","s93","s94","s95","s96","s97","s98","s99","s100","s101","s102","s103","s104","s105","s106","s107","s108","s109","s110","s111","s112","s113","s114","s115","s116","s117","s118","s119","s120","s121","s122","s123","s124"]},
  {"id":"fig2","type":"tree-deep","description":"tree rooted at 8","labels":["8","3","1","6","4","7","10","14","13"],"nodes":["8","3","1","6","4","7","10","14","13"],"edges":[{"from":"3","to":"1"},{"from":"6","to":"4"},{"from":"6","to":"7"},{"from":"3","to":"6"},{"from":"8","to":"3"},{"from":"14","to":"13"},{"from":"10","to":"14"},{"from":"8","to":"10"}],"directed":false,"bbox":{"left":576,"top":252,"right":931,"bottom":574},"strokeIds":["s132","s133","s134","s135","s136","s137","s138","s139","s140","s141","s142","s143","s144","s145","s146","s147","s148","s149","s150","s151","s152","s153","s154","s155","s156","s157","s158","s159","s160","s161","s162","s163","s164","s165","s166","s167"]}
] }
```
