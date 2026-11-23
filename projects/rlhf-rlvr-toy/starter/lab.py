"""Provided environments, sampling and training loops. No autograd or model downloads."""
import numpy as np


ANSWERS = ("unclear", "useful", "useful please", "useful please please", " ".join(["please"] * 12))
FEATURES = np.array([[0, 0], [1, 0], [1, 1], [1, 2], [0, 12]], dtype=float)
REFERENCE_LOGITS = np.log([0.60, 0.25, 0.10, 0.049, 0.001])
PROMPTS = tuple((a, b) for a in range(4) for b in range(4))


def probabilities(logits):
    return np.exp(logits - np.logaddexp.reduce(logits, axis=-1, keepdims=True))


def human_score(features):
    """Hidden synthetic preference: helpfulness, modest politeness, no spam."""
    quality, politeness = np.asarray(features).T
    return 2 * quality + 0.4 * np.minimum(politeness, 2) - np.maximum(politeness - 2, 0)


def preference_pairs(seed, count=2048):
    """Independent noisy human comparisons, deliberately excluding the spam answer."""
    rng = np.random.default_rng(seed)
    left = rng.integers(0, 4, count)
    right = (left + rng.integers(1, 4, count)) % 4
    margin = human_score(FEATURES[left]) - human_score(FEATURES[right])
    choose_left = rng.random(count) < 1 / (1 + np.exp(-margin))
    return FEATURES[np.where(choose_left, left, right)], FEATURES[np.where(choose_left, right, left)]


def train_reward_model(core, seed=7):
    winners, losers = preference_pairs(seed)
    weights = np.zeros(FEATURES.shape[1])
    for _ in range(400):
        weights = core.reward_model_step(weights, winners, losers, 0.15)
    return weights


def preference_accuracy(weights, seed=101):
    winners, losers = preference_pairs(seed, 4096)
    return float(np.mean((winners - losers) @ weights > 0))


def true_policy_score(logits):
    return float(probabilities(logits) @ human_score(FEATURES))


def train_rlhf(core, weights, beta=2.0, seed=11, iterations=1200):
    """A frozen SFT/reference policy, sampled REINFORCE then PPO-style reuse + exact KL.

    The reference is supplied as a table of SFT-like probabilities, not fitted here.
    Reward-model features never expose the nonlinear human score to optimization.
    """
    rng = np.random.default_rng(seed)
    logits = 0.5 * REFERENCE_LOGITS
    learned_rewards = FEATURES @ weights
    for _ in range(iterations):
        actions = rng.choice(len(ANSWERS), size=128, p=probabilities(logits))
        old_log_probs, _ = core.log_prob_and_grad(logits, actions)
        rewards = learned_rewards[actions]
        baseline = float(rewards.mean())
        advantages = rewards - baseline
        for epoch in range(4):
            if epoch == 0:
                gradient = core.reinforce_gradient(logits, actions, rewards, baseline)
            else:
                log_probs, score_gradient = core.log_prob_and_grad(logits, actions)
                _, derivative = core.clipped_surrogate(log_probs, old_log_probs, advantages)
                gradient = np.sum(derivative[:, None] * score_gradient, axis=0)
            _, kl_gradient = core.kl_penalty(logits, REFERENCE_LOGITS)
            logits += 0.15 * (gradient - beta * kl_gradient)
    return logits


def arithmetic_accuracy(logits):
    targets = np.array([a + b for a, b in PROMPTS])
    return float(probabilities(logits)[np.arange(len(PROMPTS)), targets].mean())


def train_rlvr(core, seed=23, iterations=100):
    """One independent answer distribution per prompt; GRPO-style groups, no critic."""
    rng = np.random.default_rng(seed)
    logits = np.zeros((len(PROMPTS), 7))
    for _ in range(iterations):
        for i, prompt in enumerate(PROMPTS):
            actions = rng.choice(7, size=32, p=probabilities(logits[i]))
            rewards = np.array([core.verifier_reward(prompt, int(action)) for action in actions])
            old_log_probs, _ = core.log_prob_and_grad(logits[i], actions)
            for _ in range(2):
                logits[i] = core.grpo_update(logits[i], actions, rewards, old_log_probs, 0.3)
    return logits
