# Resource ranking evaluation

## after-rl-basics
- PASS 1. {"type":"pathTopExcludes","ids":["rl-intro","rl-algorithms"]} — path top all: intro-llms, build-gpt, illustrating-rlhf, deepseek-r1, ppo-guide, build-tokenizer, gae-paper, dpo-paper
- PASS 2. {"type":"pathTopIncludesAny","k":10,"ids":["gae-paper","ppo-guide","hf-ppo","policy-gradient-algorithms"]} — path top 10: intro-llms, build-gpt, illustrating-rlhf, deepseek-r1, ppo-guide, build-tokenizer, gae-paper, dpo-paper
- Deterministic: true

## goal-known
- PASS 1. {"type":"emptyRanking"} — path=0, per-step=0, projects=0
- Deterministic: true

## project-passed
- PASS 1. {"type":"stepsDone","ids":["bradley-terry","reward-model","grpo","rlvr","rlhf"],"reasonIncludes":"passed the project"} — all requested steps done with matching reasons
- PASS 2. {"type":"pathTopExcludes","ids":["deepseek-r1","deepseekmath","trl-grpo"]} — path top all: build-gpt, rl-intro, intro-llms, makemore, gae-paper, build-tokenizer, ppo-guide, probability
- PASS 3. {"type":"projectNotRanked","id":"rlhf-rlvr-toy"} — rlhf-rlvr-toy: not ranked
- Deterministic: true

## time-limited
- PASS 1. {"type":"pathTopMaxMinutes","k":3,"minutes":60,"atLeast":2} — 2 of top 3 take <=60 minutes; required >=2
- PASS 2. {"type":"stepTopIncludesAny","step":"rlhf","k":1,"ids":["illustrating-rlhf","intro-llms"]} — rlhf: illustrating-rlhf
- Deterministic: true

## user-papers
- PASS 1. {"type":"pathTopIncludesAny","k":3,"ids":["instructgpt"]} — path top 3: instructgpt, rl-intro, attention-paper
- FAIL 2. {"type":"stepTopIncludesAny","step":"ppo","k":2,"ids":["ppo-paper"]} — ppo: policy-gradient-algorithms, ppo-guide
- FAIL 3. {"type":"stepTopIncludesAny","step":"grpo","k":2,"ids":["deepseekmath"]} — grpo: deepseek-r1, trl-grpo
- PASS 4. {"type":"stepTopIncludesAny","step":"rlhf","k":2,"ids":["instructgpt","summarization-feedback","human-preferences-paper"]} — rlhf: instructgpt, illustrating-rlhf
- Deterministic: true

## user-video
- PASS 1. {"type":"pathTopIncludesAny","k":5,"ids":["build-gpt"]} — path top 5: intro-llms, build-gpt, rl-intro, rl-policy-gradient, illustrating-rlhf
- PASS 2. {"type":"pathTopIncludesAny","k":10,"ids":["rl-intro","silver-rl-course"]} — path top 10: intro-llms, build-gpt, rl-intro, rl-policy-gradient, illustrating-rlhf, deepseek-r1, gae-paper, ppo-guide, build-tokenizer, probability
- PASS 3. {"type":"pathTopIncludesAny","k":10,"ids":["illustrating-rlhf","instructgpt","human-preferences-paper"]} — path top 10: intro-llms, build-gpt, rl-intro, rl-policy-gradient, illustrating-rlhf, deepseek-r1, gae-paper, ppo-guide, build-tokenizer, probability
- PASS 4. {"type":"pathTopIncludesAny","k":10,"ids":["deepseekmath","deepseek-r1","tulu-3","trl-grpo"]} — path top 10: intro-llms, build-gpt, rl-intro, rl-policy-gradient, illustrating-rlhf, deepseek-r1, gae-paper, ppo-guide, build-tokenizer, probability
- PASS 5. {"type":"pathTopIncludesAny","k":10,"ids":["ppo-guide","hf-ppo","ppo-paper","policy-gradient-algorithms"]} — path top 10: intro-llms, build-gpt, rl-intro, rl-policy-gradient, illustrating-rlhf, deepseek-r1, gae-paper, ppo-guide, build-tokenizer, probability
- PASS 6. {"type":"pathTopExcludes","k":10,"ids":["zero-to-hero","makemore-mlp","micrograd","backpropagation-visual","gradient-descent-visual","trpo-paper","trpo-guide"]} — path top 10: intro-llms, build-gpt, rl-intro, rl-policy-gradient, illustrating-rlhf, deepseek-r1, gae-paper, ppo-guide, build-tokenizer, probability
- PASS 7. {"type":"pathCoverageAtLeast","k":10,"steps":38} — coverage 40, required >=38
- PASS 8. {"type":"stepTop1","step":"tokenization","id":"build-tokenizer"} — tokenization: build-tokenizer
- PASS 9. {"type":"stepTop1","step":"gae","id":"gae-paper"} — gae: gae-paper
- PASS 10. {"type":"stepTopIncludesAny","step":"ppo","k":2,"ids":["ppo-guide","hf-ppo","ppo-paper"]} — ppo: policy-gradient-algorithms, ppo-guide
- PASS 11. {"type":"stepTopIncludesAny","step":"rlvr","k":2,"ids":["tulu-3","deepseek-r1"]} — rlvr: deepseek-r1, tulu-3
- PASS 12. {"type":"stepTopIncludesAny","step":"bradley-terry","k":2,"ids":["instructgpt"]} — bradley-terry: instructgpt, dpo-paper
- PASS 13. {"type":"stepTopIncludesAny","step":"attention","k":2,"ids":["attention-visual","build-gpt"]} — attention: build-gpt, attention-paper
- PASS 14. {"type":"stepTopIncludesAny","step":"reward-model","k":2,"ids":["illustrating-rlhf","instructgpt"]} — reward-model: illustrating-rlhf, instructgpt
- PASS 15. {"type":"pathReasonsMatch","pattern":"^covers \\d+ of your \\d+ remaining steps"} — all path reasons match
- PASS 16. {"type":"projectRanked","id":"rlhf-rlvr-toy","coveredCount":16} — rlhf-rlvr-toy: 16 covered, expected 16
- Deterministic: true

## Validation


## Map concepts with no resource
- linear-algebra
- calculus
- partial-derivatives
- sgd
- optimizers
- cnn
- rnn
- search
- game-trees
- minimax
- alpha-beta
- expectimax
- dqn
- peft

resources-total {"catalogResources":39,"catalogErrors":0,"projectErrors":0,"pathConcepts":41,"pathConceptsCovered":41,"cases":6,"checks":28,"checksOk":26,"deterministic":6}
