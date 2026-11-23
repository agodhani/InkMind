import importlib
import os
import unittest

import numpy as np

from starter import lab

IMPLEMENTATION = os.environ.get("INKMIND_IMPL", "starter")
if IMPLEMENTATION not in ("starter", "solution"):
    raise ValueError("INKMIND_IMPL must be starter or solution")
core = importlib.import_module(IMPLEMENTATION + ".core")


def numerical_gradient(function, x, epsilon=1e-5):
    gradient = np.zeros_like(x, dtype=float)
    for i in range(len(x)):
        upper, lower = x.copy(), x.copy()
        upper[i] += epsilon
        lower[i] -= epsilon
        gradient[i] = (function(upper) - function(lower)) / (2 * epsilon)
    return gradient


class CoreTests(unittest.TestCase):
    def test_bradley_terry_loss_and_gradient(self):
        weights = np.array([0.2, -0.3])
        winners = np.array([[1., 0.], [1., 2.]])
        losers = np.array([[0., 1.], [1., 0.]])
        loss, gradient = core.bradley_terry_loss_grad(weights, winners, losers)
        self.assertAlmostEqual(core.bradley_terry_loss_grad(np.zeros(2), winners, losers)[0], np.log(2))
        self.assertGreater(loss, 0)
        np.testing.assert_allclose(gradient, numerical_gradient(lambda w: core.bradley_terry_loss_grad(w, winners, losers)[0], weights), atol=1e-7)

    def test_bradley_terry_extreme_margins_are_finite(self):
        loss, gradient = core.bradley_terry_loss_grad(np.array([-1000.]), np.ones((1, 1)), np.zeros((1, 1)))
        self.assertTrue(np.isfinite(loss))
        np.testing.assert_allclose(gradient, [-1.])

    def test_bradley_terry_rejects_empty_pairs(self):
        with self.assertRaises(ValueError):
            core.bradley_terry_loss_grad(np.zeros(2), np.empty((0, 2)), np.empty((0, 2)))

    def test_reward_model_step_reduces_loss(self):
        winners, losers = lab.preference_pairs(17, 128)
        weights = np.zeros(2)
        updated = core.reward_model_step(weights, winners, losers, 0.1)
        np.testing.assert_array_equal(weights, np.zeros(2))
        self.assertLess(core.bradley_terry_loss_grad(updated, winners, losers)[0], core.bradley_terry_loss_grad(weights, winners, losers)[0])

    def test_log_probability_and_score_gradient(self):
        logits = np.array([0.4, -0.2, 1.1])
        actions = np.array([0, 2])
        log_probs, gradient = core.log_prob_and_grad(logits, actions)
        np.testing.assert_allclose(log_probs, np.log(lab.probabilities(logits)[actions]))
        for i in range(2):
            np.testing.assert_allclose(gradient[i], numerical_gradient(lambda w: core.log_prob_and_grad(w, actions)[0][i], logits), atol=1e-7)
        np.testing.assert_allclose(gradient.sum(axis=1), 0, atol=1e-12)

    def test_log_probabilities_are_shift_invariant(self):
        logits, actions = np.array([0., 1.]), np.array([0, 1])
        actual = core.log_prob_and_grad(logits + 1000, actions)
        expected = core.log_prob_and_grad(logits, actions)
        np.testing.assert_allclose(actual[0], expected[0])
        np.testing.assert_allclose(actual[1], expected[1])

    def test_reinforce_uses_advantages_and_baseline(self):
        logits = np.zeros(2)
        actions, rewards = np.array([0, 0, 1, 1]), np.array([1., 1., 0., 0.])
        gradient = core.reinforce_gradient(logits, actions, rewards, 0.5)
        np.testing.assert_allclose(gradient, [0.25, -0.25])
        np.testing.assert_allclose(gradient, core.reinforce_gradient(logits, actions, rewards, 4.0))
        np.testing.assert_allclose(core.reinforce_gradient(logits, actions, np.ones(4), 1.), 0)

    def test_kl_penalty_gradient(self):
        logits, reference = np.array([0.3, -0.4, 0.1]), np.array([0.1, 0.8, -0.2])
        value, gradient = core.kl_penalty(logits, reference)
        self.assertGreater(value, 0)
        np.testing.assert_allclose(gradient, numerical_gradient(lambda w: core.kl_penalty(w, reference)[0], logits), atol=1e-7)
        self.assertLess(core.kl_penalty(logits - 0.1 * gradient, reference)[0], value)

    def test_kl_is_zero_at_reference(self):
        reference = np.array([-1., 2.])
        value, gradient = core.kl_penalty(reference, reference)
        self.assertAlmostEqual(value, 0)
        np.testing.assert_allclose(gradient, 0)

    def test_clipped_surrogate_positive_and_negative_advantages(self):
        log_probs = np.log([1.5, 0.5, 1.5, 0.5])
        old = np.zeros(4)
        advantages = np.array([1., 1., -1., -1.])
        value, derivative = core.clipped_surrogate(log_probs, old, advantages)
        self.assertAlmostEqual(value, -0.15)
        np.testing.assert_allclose(derivative, np.array([0., 0.5, -1.5, 0.]) / 4)
        np.testing.assert_allclose(derivative, numerical_gradient(lambda w: core.clipped_surrogate(w, old, advantages)[0], log_probs), atol=1e-7)

    def test_clipped_surrogate_at_old_policy(self):
        old = np.log([0.2, 0.8])
        value, derivative = core.clipped_surrogate(old, old, np.array([2., -1.]))
        self.assertAlmostEqual(value, 0.5)
        np.testing.assert_allclose(derivative, [1., -0.5])

    def test_verifier(self):
        self.assertEqual(core.verifier_reward((2, 3), 5), 1.)
        self.assertEqual(core.verifier_reward((2, 3), 4), 0.)
        self.assertEqual(core.verifier_reward((0, 0), 0), 1.)
        self.assertEqual(core.verifier_reward((3, 3), -1), 0.)

    def test_group_relative_advantages(self):
        actual = core.group_advantages(np.array([0., 0., 1., 1.]))
        np.testing.assert_allclose(actual, [-1., -1., 1., 1.])
        self.assertAlmostEqual(actual.mean(), 0)
        self.assertAlmostEqual(actual.std(), 1)

    def test_constant_and_singleton_groups(self):
        np.testing.assert_array_equal(core.group_advantages(np.ones(5)), np.zeros(5))
        np.testing.assert_array_equal(core.group_advantages(np.zeros(1)), np.zeros(1))

    def test_empty_group_is_invalid(self):
        with self.assertRaises(ValueError):
            core.group_advantages(np.array([]))

    def test_grpo_update_increases_correct_answer_probability(self):
        logits = np.zeros(2)
        actions, rewards = np.array([0, 1, 0, 1]), np.array([0., 1., 0., 1.])
        old, _ = core.log_prob_and_grad(logits, actions)
        updated = core.grpo_update(logits, actions, rewards, old, 0.3)
        self.assertGreater(lab.probabilities(updated)[1], 0.5)
        np.testing.assert_array_equal(logits, np.zeros(2))
        np.testing.assert_allclose(core.grpo_update(logits, actions, np.ones(4), old, 0.3), logits)


class IntegrationTests(unittest.TestCase):
    def test_reward_model_held_out_preferences(self):
        weights = lab.train_reward_model(core)
        accuracy = lab.preference_accuracy(weights)
        print(f"held-out preference accuracy={accuracy:.4f} (required >0.70)")
        self.assertGreater(accuracy, 0.70)

    def test_rlhf_and_reward_hacking(self):
        weights = lab.train_reward_model(core)
        anchored = lab.train_rlhf(core, weights)
        unanchored = lab.train_rlhf(core, weights, beta=0.)
        before = lab.true_policy_score(lab.REFERENCE_LOGITS)
        initial = lab.true_policy_score(0.5 * lab.REFERENCE_LOGITS)
        after = lab.true_policy_score(anchored)
        hacked = lab.true_policy_score(unanchored)
        anchored_spam = lab.probabilities(anchored)[-1]
        hacked_spam = lab.probabilities(unanchored)[-1]
        predicted_anchor = float(lab.probabilities(anchored) @ (lab.FEATURES @ weights))
        predicted_hack = float(lab.probabilities(unanchored) @ (lab.FEATURES @ weights))
        print(f"RLHF true score: reference={before:.4f}, initial={initial:.4f}, KL={after:.4f}, no-KL={hacked:.4f}; spam probability: KL={anchored_spam:.4f}, no-KL={hacked_spam:.4f}; learned reward: KL={predicted_anchor:.4f}, no-KL={predicted_hack:.4f}")
        self.assertGreater(after, before + 0.5)
        self.assertGreater(after, initial)
        self.assertLess(anchored_spam, 0.05)
        self.assertGreater(hacked_spam, 0.8)
        self.assertLess(hacked, before - 1.)
        self.assertGreater(predicted_hack, predicted_anchor)

    def test_rlvr_accuracy(self):
        initial = lab.arithmetic_accuracy(np.zeros((len(lab.PROMPTS), 7)))
        trained = lab.train_rlvr(core)
        final = lab.arithmetic_accuracy(trained)
        print(f"RLVR sampled-answer accuracy: before={initial:.4f}, after={final:.4f} (required >0.95)")
        self.assertAlmostEqual(initial, 1 / 7)
        self.assertGreater(final, 0.95)
        self.assertTrue(np.isfinite(trained).all())


if __name__ == "__main__":
    unittest.main()
