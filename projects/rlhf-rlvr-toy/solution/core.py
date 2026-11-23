"""Learning core. All gradients are ascent directions except reward-model loss gradients."""
import numpy as np


def bradley_terry_loss_grad(weights, winners, losers):
    """Mean -log sigmoid((winner-loser) @ weights), and gradient w.r.t. weights."""
    diff = np.asarray(winners) - np.asarray(losers)
    if len(diff) == 0:
        raise ValueError("At least one preference pair is required")
    margins = diff @ weights
    loss = np.logaddexp(0.0, -margins).mean()
    probability_wrong = np.exp(-np.logaddexp(0.0, margins))
    return float(loss), -(probability_wrong[:, None] * diff).mean(axis=0)


def reward_model_step(weights, winners, losers, learning_rate):
    """One gradient-descent step on Bradley-Terry negative log likelihood."""
    _, gradient = bradley_terry_loss_grad(weights, winners, losers)
    return weights - learning_rate * gradient


def log_prob_and_grad(logits, actions):
    """For one categorical policy, return log p(action) and score gradients (B, A)."""
    logits = np.asarray(logits, dtype=float)
    log_probs = logits - np.logaddexp.reduce(logits)
    actions = np.asarray(actions, dtype=int)
    gradient = np.eye(len(logits))[actions] - np.exp(log_probs)
    return log_probs[actions], gradient


def reinforce_gradient(logits, actions, rewards, baseline):
    """Mean (reward - fixed baseline) * grad log p(action); one policy row."""
    _, score_gradient = log_prob_and_grad(logits, actions)
    return ((np.asarray(rewards) - baseline)[:, None] * score_gradient).mean(axis=0)


def kl_penalty(logits, reference_logits):
    """Exact categorical KL(policy || reference), and its gradient w.r.t. logits."""
    log_p = logits - np.logaddexp.reduce(logits)
    log_q = reference_logits - np.logaddexp.reduce(reference_logits)
    p = np.exp(log_p)
    kl = float(np.sum(p * (log_p - log_q)))
    return kl, p * (log_p - log_q - kl)


def clipped_surrogate(log_probs, old_log_probs, advantages, epsilon=0.2):
    """Mean PPO min(r*A, clip(r)*A), and derivative w.r.t. each log probability.

    At the clipping boundary use the unclipped branch. Old probabilities and
    advantages are fixed; the returned derivative includes division by batch size.
    """
    ratio = np.exp(log_probs - old_log_probs)
    clipped = np.clip(ratio, 1 - epsilon, 1 + epsilon)
    advantages = np.asarray(advantages)
    objective = np.minimum(ratio * advantages, clipped * advantages)
    active = ((advantages >= 0) & (ratio <= 1 + epsilon)) | ((advantages < 0) & (ratio >= 1 - epsilon))
    return float(objective.mean()), np.where(active, ratio * advantages, 0.0) / advantages.size


def verifier_reward(prompt, answer):
    """Exact 0/1 reward for a one-token answer to a two-digit addition prompt."""
    return float(answer == prompt[0] + prompt[1])


def group_advantages(rewards):
    """Normalize one prompt's group with population std; constant groups give zero."""
    rewards = np.asarray(rewards, dtype=float)
    if rewards.size == 0:
        raise ValueError("A group must contain at least one reward")
    centered = rewards - rewards.mean()
    return centered / max(float(rewards.std()), 1e-8)


def grpo_update(logits, actions, rewards, old_log_probs, learning_rate, epsilon=0.2):
    """One GRPO-style ascent update: group-relative advantages, clipped ratios, no critic."""
    advantages = group_advantages(rewards)
    log_probs, score_gradient = log_prob_and_grad(logits, actions)
    _, derivative = clipped_surrogate(log_probs, old_log_probs, advantages, epsilon)
    return logits + learning_rate * np.sum(derivative[:, None] * score_gradient, axis=0)
