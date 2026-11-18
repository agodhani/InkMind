# Knowledge-base evaluation

## Deterministic only

| Notebook | Concept P / R | Edge P / R | Duplicates | False merges | Provenance | Idempotent |
|---|---|---|---|---|---|---|
| backprop | 100.0% / 100.0% | 100.0% / 92.3% | 0 (0.0%) | 0 | 22/23 | 1/1 |
| edits | 100.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 6/6 | 1/1 |
| minimax | 100.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 16/16 | 1/1 |
| ppo | 100.0% / 90.9% | 100.0% / 91.7% | 0 (0.0%) | 0 | 21/21 | 1/1 |
| rl-basics | 100.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 21/21 | 1/1 |
| rlhf-rlvr | 100.0% / 91.7% | 100.0% / 93.3% | 0 (0.0%) | 0 | 25/25 | 1/1 |
| Causal inference across pages | 100.0% / 16.7% | 100.0% / 0.0% | 0 (0.0%) | 0 | 1/1 | 1/1 |
| Retrieval practice in prose | 100.0% / 0.0% | 100.0% / 0.0% | 0 (0.0%) | 0 | 0/0 | 1/1 |
| **total** | 100.0% / 81.5% | 100.0% / 83.3% | 0 (0.0%) | 0 | 112/113 | 8/8 |

### backprop
- Provenance mismatch: concept Backpropagation; expected ["p1/b1","p1/b2","p2/b2"]; got ["p1/b1"]
- Missing edge: gradient descent —mentions→ Backpropagation

### edits
- No misses, extras, or provenance mismatches.

### minimax
- No misses, extras, or provenance mismatches.

### ppo
- Missing concept: KL penalty
- Missing edge: Proximal Policy Optimization —mentions→ KL penalty

### rl-basics
- No misses, extras, or provenance mismatches.

### rlhf-rlvr
- Missing concept: Reward hacking
- Missing edge: RLHF —mentions→ Reward hacking

### Causal inference across pages
- Missing concept: Common cause
- Missing concept: Confounding
- Missing concept: Collider
- Missing concept: Selection bias
- Missing concept: Random assignment
- Missing edge: Causal inference —mentions→ Common cause
- Missing edge: Causal inference —mentions→ Confounding
- Missing edge: Causal inference —mentions→ Collider
- Missing edge: Causal inference —mentions→ Selection bias
- Missing edge: Common cause —follows→ Confounding
- Missing edge: Collider —follows→ Selection bias

### Retrieval practice in prose
- Missing concept: Retrieval practice
- Missing concept: Spaced repetition
- Missing concept: Interleaving
- Missing concept: Blocked practice
- Missing concept: Desirable difficulty
- Missing edge: Spaced repetition —supports→ Retrieval practice
- Missing edge: Interleaving —mentions→ Blocked practice
- Missing edge: Desirable difficulty —contains→ Retrieval practice

## Deterministic + model (ollama:qwen2.5:3b)

| Notebook | Concept P / R | Edge P / R | Duplicates | False merges | Provenance | Idempotent |
|---|---|---|---|---|---|---|
| backprop | 91.7% / 100.0% | 92.3% / 92.3% | 0 (0.0%) | 0 | 20/23 | 1/1 |
| edits | 66.7% / 100.0% | 66.7% / 100.0% | 0 (0.0%) | 0 | 6/6 | 1/1 |
| minimax | 75.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 16/16 | 1/1 |
| ppo | 100.0% / 90.9% | 78.6% / 91.7% | 0 (0.0%) | 0 | 21/21 | 1/1 |
| rl-basics | 83.3% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 21/21 | 1/1 |
| rlhf-rlvr | 78.6% / 91.7% | 93.3% / 93.3% | 0 (0.0%) | 0 | 25/25 | 1/1 |
| Causal inference across pages | 50.0% / 50.0% | 100.0% / 33.3% | 0 (0.0%) | 0 | 3/5 | 1/1 |
| Retrieval practice in prose | 50.0% / 60.0% | 100.0% / 0.0% | 0 (0.0%) | 0 | 2/3 | 1/1 |
| **total** | 78.4% / 89.2% | 91.2% / 86.1% | 0 (0.0%) | 0 | 114/120 | 8/8 |

### backprop
- Provenance mismatch: concept Backpropagation; expected ["p1/b1","p1/b2","p2/b2"]; got ["p1/b1","p1/b2"]
- Provenance mismatch: concept gradient; expected ["p1/b2","p2/b2"]; got ["p1/b2","p2/b1","p2/b2"]
- Extra concept: training loop (c_training-loop)
- Provenance mismatch: edge gradient descent —mentions→ gradient; expected ["p2/b2"]; got ["p2/b1","p2/b2"]
- Missing edge: gradient descent —mentions→ Backpropagation
- Extra edge: Computational graph —mentions→ training loop

### edits
- Extra concept: Sigmoid saturates for large |x| and outputs lie in (0, 1). (c_sigmoid-saturate-for-large-x-and-output-lie-in-0-1)
- Extra concept: zero-centred (c_zero-centred)
- Extra edge: Activation functions —mentions→ zero-centred

### minimax
- Extra concept: Minimax and Maximin are the same (c_minimax-and-maximin-are-the-same)
- Extra concept: Minimax assumes an optimal opponent (c_minimax-assume-an-optimal-opponent)

### ppo
- Missing concept: KL penalty
- Missing edge: Proximal Policy Optimization —mentions→ KL penalty
- Extra edge: advantage —supports→ Generalized Advantage Estimation
- Extra edge: Generalized Advantage Estimation —follows→ advantage
- Extra edge: PPO —follows→ actor-critic

### rl-basics
- Extra concept: A policy is a mapping from states to actions (c_a-policy-is-a-mapping-from-state-to-action)
- Extra concept: REINFORCE uses a policy gradient method (c_reinforce-use-a-policy-gradient-method)

### rlhf-rlvr
- Missing concept: Reward hacking
- Extra concept: A verifier can be used to replace the learned reward model in RLVR (c_a-verifier-can-be-used-to-replace-the-learned-reward-model-in-rlvr)
- Extra concept: A verifier returns 1 if the answer checks out, else 0 (c_a-verifier-return-1-if-the-answer-check-out-else-0)
- Extra concept: programmatic verifier (c_programmatic-verifier)
- Missing edge: RLHF —mentions→ Reward hacking
- Extra edge: Reinforcement Learning with Verifiable Rewards —mentions→ programmatic verifier

### Causal inference across pages
- Missing concept: Common cause
- Provenance mismatch: concept Confounding; expected ["p1/b2","p1/b3","p2/b1"]; got ["p1/b2"]
- Missing concept: Collider
- Missing concept: Random assignment
- Extra concept: A common cause can produce confounding even when treatment has no effect. (c_a-common-cause-can-produce-confounding-even-when-treatment-has-no-effect)
- Extra concept: Conditioning on a collider creates selection bias between its causes rather than removing confounding. (c_conditioning-on-a-collider-create-selection-bia-between-its-cause-rather-than-removing-confounding)
- Extra concept: Random assignment does not repair selection bias. (c_random-assignment-doe-not-repair-selection-bia)
- Missing edge: Causal inference —mentions→ Common cause
- Provenance mismatch: edge Causal inference —mentions→ Confounding; expected ["p1/b2","p1/b3"]; got ["p1/b2"]
- Missing edge: Causal inference —mentions→ Collider
- Missing edge: Common cause —follows→ Confounding
- Missing edge: Collider —follows→ Selection bias

### Retrieval practice in prose
- Provenance mismatch: concept Retrieval practice; expected ["p1/b1","p1/b3"]; got ["p1/b1"]
- Missing concept: Spaced repetition
- Missing concept: Blocked practice
- Extra concept: Desirable difficulty makes attempts feel harder. (c_desirable-difficulty-make-attempt-feel-harder)
- Extra concept: Interleaving requires deciding on the method. (c_interleaving-require-deciding-on-the-method)
- Extra concept: Retrieval practice makes recall stronger. (c_retrieval-practice-make-recall-stronger)
- Missing edge: Spaced repetition —supports→ Retrieval practice
- Missing edge: Interleaving —mentions→ Blocked practice
- Missing edge: Desirable difficulty —contains→ Retrieval practice

## Live model latency

- backprop/p1 (step 0, 1 batch(es)): 32.69 s
- backprop/p2 (step 1, 1 batch(es)): 20.27 s
- edits/p1 (step 0, 1 batch(es)): 13.44 s
- edits/p2 (step 1, 1 batch(es)): 10.38 s
- edits/p3 (step 2, 1 batch(es)): 8.18 s
- edits/p1 (step 3, 1 batch(es)): 14.57 s
- minimax/p1 (step 0, 1 batch(es)): 18.05 s
- minimax/p2 (step 1, 1 batch(es)): 16.56 s
- ppo/p1 (step 0, 1 batch(es)): 24.95 s
- ppo/p2 (step 1, 1 batch(es)): 12.13 s
- rl-basics/p1 (step 0, 1 batch(es)): 12.69 s
- rl-basics/p2 (step 1, 1 batch(es)): 15.53 s
- rlhf-rlvr/p1 (step 0, 1 batch(es)): 11.22 s
- rlhf-rlvr/p2 (step 1, 1 batch(es)): 17.55 s
- causal-inference/p1 (step 0, 1 batch(es)): 15.64 s
- causal-inference/p2 (step 1, 1 batch(es)): 7.36 s
- retrieval-practice/p1 (step 0, 1 batch(es)): 21.36 s
