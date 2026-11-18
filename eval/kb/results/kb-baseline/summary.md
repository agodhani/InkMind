# Knowledge-base evaluation

| Notebook | Concept P / R | Edge P / R | Duplicates | False merges | Provenance | Idempotent |
|---|---|---|---|---|---|---|
| backprop | 100.0% / 100.0% | 100.0% / 92.3% | 0 (0.0%) | 0 | 22/23 | 1/1 |
| edits | 100.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 6/6 | 1/1 |
| minimax | 75.0% / 100.0% | 81.8% / 100.0% | 0 (0.0%) | 0 | 15/15 | 1/1 |
| ppo | 90.0% / 81.8% | 81.8% / 75.0% | 0 (0.0%) | 0 | 17/18 | 1/1 |
| rl-basics | 100.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 20/20 | 1/1 |
| rlhf-rlvr | 100.0% / 91.7% | 100.0% / 92.9% | 0 (0.0%) | 0 | 23/24 | 1/1 |
| **total** | 94.4% / 94.4% | 93.2% / 91.7% | 0 (0.0%) | 0 | 103/106 | 6/6 |

### backprop
- Provenance mismatch: concept Backpropagation; expected ["p1/b1","p1/b2","p2/b2"]; got ["p1/b1"]
- Missing edge: gradient descent —mentions→ Backpropagation

### edits
- No misses, extras, or provenance mismatches.

### minimax
- Extra concept: guarantee (c_guarantee)
- Extra concept: opponent (c_opponent)
- Extra edge: Adversarial search —mentions→ opponent
- Extra edge: Minimax —mentions→ Expectimax

### ppo
- Provenance mismatch: concept Proximal Policy Optimization; expected ["p1/b1","p1/b2","p2/b4"]; got ["p1/b1","p1/b2","p1/b4","p2/b4"]
- Missing concept: KL penalty
- Missing concept: advantage
- Extra concept: Advantages (c_advantage)
- Missing edge: Proximal Policy Optimization —mentions→ KL penalty
- Missing edge: Proximal Policy Optimization —mentions→ advantage
- Missing edge: Advantage function —mentions→ advantage
- Extra edge: Advantage function —mentions→ Advantages
- Extra edge: PPO —mentions→ Advantages

### rl-basics
- No misses, extras, or provenance mismatches.

### rlhf-rlvr
- Provenance mismatch: concept Reinforcement Learning from Human Feedback; expected ["p1/b1","p2/b3"]; got ["p1/b1","p1/b2","p2/b3"]
- Missing concept: Reward hacking
- Missing edge: RLHF —mentions→ Reward hacking
