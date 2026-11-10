<!-- page 1 -->
<!-- mixed-notes #41: tree with root loss -->
# Gradient descent
- softmax over the keys
- sample N rollouts per prompt
the baseline* reduces variance

* baseline = mean reward over the batch

```json figures
{ "figures": [
  {"id":"fig1","type":"tree","description":"tree with root loss","labels":["loss","CE","KL","MSE"],"bbox":{"left":215,"top":304,"right":569,"bottom":649},"strokeIds":["s99","s100","s101","s102","s103","s104","s105","s106","s107","s108","s109","s110","s111","s112","s113","s114","s115","s116","s117","s118","s119","s120","s121","s122","s123","s124","s125","s126","s127","s128","s129","s130","s131"]}
] }
```

<!-- page 2 -->
<!-- mixed-notes #42: tree with root loss -->
# Minimax search
- value head predicts the return
- sample N rollouts per prompt
KL term* keeps the policy close

* KL = divergence from the SFT model

```json figures
{ "figures": [
  {"id":"fig1","type":"tree","description":"tree with root loss","labels":["loss","CE","KL","MSE"],"bbox":{"left":217,"top":304,"right":564,"bottom":650},"strokeIds":["s113","s114","s115","s116","s117","s118","s119","s120","s121","s122","s123","s124","s125","s126","s127","s128","s129","s130","s131","s132","s133","s134","s135","s136","s137","s138","s139","s140","s141","s142"]}
] }
```

<!-- page 3 -->
<!-- mixed-notes #43: flowchart: input → ok? → output -->
# Gradient descent
- clip the ratio at 0.2
- value head predicts the return
- softmax over the keys
KL term* keeps the policy close

* KL = divergence from the SFT model

```json figures
{ "figures": [
  {"id":"fig1","type":"flowchart","description":"flowchart: input → ok? → output","labels":["input","ok?","output","yes"],"bbox":{"left":107,"top":382,"right":900,"bottom":462},"strokeIds":["s130","s131","s132","s133","s134","s135","s136","s137","s138","s139","s140","s141","s142","s143","s144","s145","s146","s147","s148","s149","s150","s151","s152","s153","s154","s155","s156","s157","s158","s159","s160","s161","s162","s163","s164","s165","s166","s167","s168","s169","s170","s171","s172","s173","s174","s175"]}
] }
```
