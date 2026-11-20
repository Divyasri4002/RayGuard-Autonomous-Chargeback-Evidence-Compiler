import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBoundedDecision, evaluateCostBenefitGate } from './costGate.ts';

const DEFAULT_POLICY = {
  gatewayDisputeFeeInr: 500,
  internalOpsCostInr: 100,
  autoContestThreshold: 0.75,
  humanReviewFloor: 0.4,
};

test('cost-benefit gate blocks micro-disputes at or below ₹600 break-even', () => {
  const micro = evaluateCostBenefitGate(42000, DEFAULT_POLICY);
  assert.equal(micro.shouldContest, false);
  assert.equal(micro.amountInr, 420);
  assert.equal(micro.totalDisputeCostInr, 600);

  const breakEven = evaluateCostBenefitGate(60000, DEFAULT_POLICY);
  assert.equal(breakEven.shouldContest, false);
});

test('cost-benefit gate clears disputes above ₹600 break-even', () => {
  const valid = evaluateCostBenefitGate(480000, DEFAULT_POLICY);
  assert.equal(valid.shouldContest, true);
  assert.equal(valid.amountInr, 4800);
  assert.equal(valid.netIfWonInr, 4200);
});

test('bounded decision routes probabilities to correct action bands', () => {
  const high = evaluateBoundedDecision(0.89, 480000, DEFAULT_POLICY);
  assert.equal(high.status, 'READY_TO_CONTEST');
  assert.equal(high.falsePositiveSavedPaise, 0);

  const mid = evaluateBoundedDecision(0.58, 325000, DEFAULT_POLICY);
  assert.equal(mid.status, 'HUMAN_REVIEW');

  const low = evaluateBoundedDecision(0.12, 1250000, DEFAULT_POLICY);
  assert.equal(low.status, 'RECOMMEND_ACCEPT');
  assert.equal(low.falsePositiveSavedPaise, 60000);
});
