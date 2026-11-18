# Knowledge-base evaluation

| Notebook | Concept P / R | Edge P / R | Duplicates | False merges | Provenance | Idempotent |
|---|---|---|---|---|---|---|
| backprop | 100.0% / 100.0% | 100.0% / 92.3% | 0 (0.0%) | 0 | 22/23 | 1/1 |
| edits | 100.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 6/6 | 1/1 |
| minimax | 100.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 16/16 | 1/1 |
| ppo | 100.0% / 90.9% | 100.0% / 91.7% | 0 (0.0%) | 0 | 21/21 | 1/1 |
| rl-basics | 100.0% / 100.0% | 100.0% / 100.0% | 0 (0.0%) | 0 | 21/21 | 1/1 |
| rlhf-rlvr | 100.0% / 91.7% | 100.0% / 93.3% | 0 (0.0%) | 0 | 25/25 | 1/1 |
| **total** | 100.0% / 96.3% | 100.0% / 95.2% | 0 (0.0%) | 0 | 111/112 | 6/6 |

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
