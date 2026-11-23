# Toy RLHF + RLVR laboratory

Implement nine small NumPy functions to connect backprop knowledge to preference
learning, policy optimization and verifiable rewards. Budget **5 hours**, including
experiments. Python **3.10+**, NumPy, a laptop CPU; no GPU, torch, pytest, model
downloads or network calls during training.

## Run

From this directory, optionally create a virtual environment:

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install numpy
python -m unittest -v
```

Windows activation: `.venv\Scripts\activate`. All tests use standard-library
`unittest`; the default implementation is `starter/core.py`. Initially tests
error with `NotImplementedError`: that is intentional. Implement the TODOs, then
repeat the same command. You can run one exercise at a time:

```sh
python -m unittest tests.test_lab.CoreTests.test_bradley_terry_loss_and_gradient -v
python -m unittest tests.test_lab.IntegrationTests -v
```

Maintainers with the separate reference solution can run:

```sh
INKMIND_IMPL=solution python -m unittest -v
```

In PowerShell set `$env:INKMIND_IMPL="solution"` first. Learner exports deliberately
do not include that package; the default command works without it.

## Environment and limitations

The "language model" is a categorical softmax over five complete, short token
sequences, not a transformer. Each sequence is one policy action. The supplied
reference distribution stands in for an SFT model: fitting SFT is not an exercise.
The reward model sees two features: helpfulness and number of polite words.
Synthetic humans like helpfulness and modest politeness, but dislike spam.
Training comparisons only contain the first four responses. The fifth response,
twelve repetitions of "please", is out of the reward model's training distribution.

`starter/lab.py` provides fixed-seed data generation, sampling, training loops and
evaluation. Do not change the human scorer, verifier, seeds or thresholds to pass
the tests. A held-out preference set uses independent noisy comparisons of the
same four in-distribution responses, not unseen response types. Human choices
are stochastic, so perfect held-out accuracy is not expected.

RLHF samples policy actions, subtracts a batch reward baseline, and ascends the
learned reward. Its first epoch uses REINFORCE; three further epochs reuse that
batch through the PPO clipped surrogate. Each epoch subtracts the exact
categorical KL gradient against the frozen reference. This is **PPO-style**:
there is no learned critic, temporal credit assignment or GAE.
Both runs start from a temperature-2 copy of the reference so that the rare spam
answer is explored, rather than being missed before the policy collapses onto a
local optimum. The KL anchor itself remains the unsoftened reference.

RLVR uses sixteen addition prompts with digits 0–3 and seven one-token answers
0–6. Each prompt has its own trainable logits. Sample 32 answers per prompt,
compute programmatic 0/1 rewards, normalize within the group and take two clipped
policy updates with fixed old log probabilities. This is **GRPO-style**, without
a critic or KL term. It deliberately omits the token-level details of production
GRPO. Tabular training memorizes these prompts; no generalization claim is made.
Accuracy is the exact probability of sampling the correct answer, averaged over
prompts, not an argmax metric that could conceal low confidence.

## Suggested TODO order and hints

Implement only `starter/core.py` first; its signatures/docstrings match the
reference API. All inputs are NumPy arrays unless noted. Do not mutate inputs.

1. **bradley_terry_loss_grad**: difference winner and loser features, then compute
   mean negative log-sigmoid and its weight gradient. Use `np.logaddexp` for
   numerical stability. Reject an empty preference batch with `ValueError`.
2. **reward_model_step**: a gradient-*descent* step on that loss.
3. **log_prob_and_grad**: stable log-softmax for one logits vector and a batch of
   integer actions. Return log probabilities shape `(B,)` and score-function
   gradients shape `(B, A)`. Hint: one-hot minus policy probability.
4. **reinforce_gradient**: average `(reward - baseline) * score_gradient`.
   Treat the baseline as fixed, not something to differentiate through.
5. **kl_penalty**: exact `KL(policy || reference)`, plus its logits gradient.
   Differentiate through the softmax; the reference is fixed.
6. **clipped_surrogate**: mean `min(ratio*A, clip(ratio)*A)` and derivative
   with respect to each current log probability. Include division by batch size.
   Think separately about positive and negative advantages. Use the unclipped
   branch at an exact boundary; old log probabilities and advantages are fixed.
7. **verifier_reward**: return a float 1 or 0 for an integer answer to `(a, b)`.
8. **group_advantages**: subtract group mean and divide by population standard
   deviation, floored at `1e-8`. Constant/singleton groups give zeros. An empty
   group is invalid and must raise `ValueError`.
9. **grpo_update**: compose group advantages, the clipped surrogate and
   log-probability gradients into one logits ascent step. No reward model/critic.

The tests include finite-difference gradient checks, clipping in both directions,
KL direction, constant groups and fixed-seed end-to-end thresholds.

## Experiments and reward hacking

```sh
python -m unittest tests.test_lab.IntegrationTests.test_reward_model_held_out_preferences -v
python -m unittest tests.test_lab.IntegrationTests.test_rlhf_and_reward_hacking -v
python -m unittest tests.test_lab.IntegrationTests.test_rlvr_accuracy -v
```

The RLHF test runs otherwise identical training twice, with `beta=2` and
`beta=0`. It requires the anchored policy's **true human score** to rise by more
than 0.5, while no-KL training produces over 80% spam and scores worse than the
reference, despite higher learned reward. This demonstrates a learned linear
reward's extrapolation flaw, not that KL universally prevents hacking. Try
changing beta after the original tests pass and inspect both reward signals.

The reward model must exceed 70% on independent held-out noisy comparisons.
RLVR starts at chance (1/7) and must exceed 95% sampled-answer accuracy.
The toy environment intentionally makes these outcomes fast and reproducible.

## InkMind path concepts

These are exactly the manifest's exercised concepts:

- `policy-gradient` — Policy gradient
- `reinforce` — REINFORCE
- `baseline` — Baselines and variance reduction
- `advantage-function` — Advantage function
- `kl-divergence` — KL divergence
- `kl-penalty` — KL penalty to a reference model
- `human-preferences` — Preference data
- `bradley-terry` — Bradley-Terry model
- `reward-model` — Reward models
- `rl-finetuning` — RL fine-tuning of language models
- `reward-hacking` — Reward hacking
- `rlhf` — Reinforcement learning from human feedback
- `verifiable-rewards` — Verifiable rewards
- `grpo` — Group relative policy optimization
- `rlvr` — Reinforcement learning with verifiable rewards
- `ppo` — Proximal policy optimization

Here "advantage" is a baseline-subtracted return estimate, not an exact learned
state-value difference. The tests exercise the core algorithms at toy scale,
not mastery of production LLM training.

A trusted InkMind test runner can turn a completed learner test run into
`{projectId: "rlhf-rlvr-toy", concepts: [...manifest.concepts], passed: true}`.
This supplies separate project evidence to `matchNotes`, not declarations or
notes. Note evidence takes precedence; project evidence remains attached.
Failed tests supply no knowledge evidence. Running the reference solution is
maintainer verification, **not** evidence that a learner completed the exercise.

## Export contract

Copy only the manifest's `files`, retaining relative paths. They include this
README, starter environment/core, and tests. No solution imports are needed for
default execution. `solutionFiles` are separate and must never enter a learner
zip. The manifest itself and maintainer verification notes are not needed to
run the exported exercise.
