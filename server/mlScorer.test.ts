import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HELD_OUT_TEST_DISPUTES,
  TRAIN_DISPUTES,
  evaluateHeldOutTestSet,
  predictWinProbability,
} from './mlScorer.ts';

test('dataset split matches 140 training and 60 held-out test rows', () => {
  assert.equal(TRAIN_DISPUTES.length, 140);
  assert.equal(HELD_OUT_TEST_DISPUTES.length, 60);
});

test('predictWinProbability strongly separates friendly fraud from account takeover', () => {
  const friendlyProb = predictWinProbability({
    ipMatch: true,
    deviceMatch: true,
    threeDsAuthenticated: true,
    accountAgeDays: 420,
    priorUndisputedOrders: 8,
    podSignatureValid: true,
    deliveryAddressMatched: true,
    chatReceiptConfirmed: true,
  });
  const atoProb = predictWinProbability({
    ipMatch: false,
    deviceMatch: false,
    threeDsAuthenticated: false,
    accountAgeDays: 3,
    priorUndisputedOrders: 0,
    podSignatureValid: false,
    deliveryAddressMatched: false,
    chatReceiptConfirmed: false,
  });

  assert.ok(friendlyProb >= 0.85, `Expected friendlyProb >= 0.85, got ${friendlyProb}`);
  assert.ok(atoProb <= 0.15, `Expected atoProb <= 0.15, got ${atoProb}`);
});

test('held-out test set achieves > 90% precision at 0.75 threshold', () => {
  const res = evaluateHeldOutTestSet(0.75);
  assert.equal(res.totalCases, 60);
  assert.ok(res.precision >= 0.9, `Expected precision >= 0.90, got ${res.precision}`);
  assert.ok(res.recall >= 0.75, `Expected recall >= 0.75, got ${res.recall}`);
  assert.equal(res.falsePositiveCostInr, res.falsePositives * 500);
  assert.ok(res.curve.length >= 9);
});
