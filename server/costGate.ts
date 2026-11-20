import type { DisputeStatus, PolicyConfig } from '../src/shared/types.ts';

export interface CostGateEvaluation {
  shouldContest: boolean;
  amountInr: number;
  totalDisputeCostInr: number;
  breakEvenThresholdInr: number;
  netIfWonInr: number;
  reason: string;
}

/**
 * Deterministic Cost-Benefit Gate (Zero LLM tokens spent if fighting loses money).
 */
export function evaluateCostBenefitGate(
  amountPaise: number,
  policy: Pick<PolicyConfig, 'gatewayDisputeFeeInr' | 'internalOpsCostInr'>
): CostGateEvaluation {
  const amountInr = Math.round((amountPaise / 100) * 100) / 100;
  const totalDisputeCostInr = policy.gatewayDisputeFeeInr + policy.internalOpsCostInr;
  const netIfWonInr = Math.round((amountInr - totalDisputeCostInr) * 100) / 100;
  const shouldContest = amountInr > totalDisputeCostInr;

  return {
    shouldContest,
    amountInr,
    totalDisputeCostInr,
    breakEvenThresholdInr: totalDisputeCostInr,
    netIfWonInr,
    reason: shouldContest
      ? `Dispute value ₹${amountInr.toLocaleString('en-IN')} exceeds total contest cost ₹${totalDisputeCostInr.toLocaleString('en-IN')} (Gateway ₹${policy.gatewayDisputeFeeInr} + Ops ₹${policy.internalOpsCostInr}). Proceeding to evidence gathering.`
      : `Micro-dispute ₹${amountInr.toLocaleString('en-IN')} is at or below total contest cost ₹${totalDisputeCostInr.toLocaleString('en-IN')} (Gateway ₹${policy.gatewayDisputeFeeInr} + Ops ₹${policy.internalOpsCostInr}). Auto-accepting loss to prevent negative ROI and penalty fees.`,
  };
}

/**
 * Bounded Action Decision Gate based on calibrated win_probability and policy thresholds.
 */
export function evaluateBoundedDecision(
  winProbability: number,
  amountPaise: number,
  policy: Pick<PolicyConfig, 'autoContestThreshold' | 'humanReviewFloor' | 'gatewayDisputeFeeInr' | 'internalOpsCostInr'>
): {
  status: Extract<DisputeStatus, 'READY_TO_CONTEST' | 'HUMAN_REVIEW' | 'RECOMMEND_ACCEPT'>;
  netExpectedValuePaise: number;
  falsePositiveSavedPaise: number;
} {
  const costInr = policy.gatewayDisputeFeeInr + policy.internalOpsCostInr;
  const amountInr = amountPaise / 100;

  // Expected Value = P(win) * amount - (1 - P(win)) * gatewayFee - opsCost
  const evInr =
    winProbability * amountInr -
    (1 - winProbability) * policy.gatewayDisputeFeeInr -
    policy.internalOpsCostInr;
  const netExpectedValuePaise = Math.round(evInr * 100);

  if (winProbability < policy.humanReviewFloor) {
    return {
      status: 'RECOMMEND_ACCEPT',
      netExpectedValuePaise,
      // Avoided contesting a likely lost dispute (gateway fee ₹500 + ops ₹100)
      falsePositiveSavedPaise: costInr * 100,
    };
  }

  if (winProbability < policy.autoContestThreshold) {
    return {
      status: 'HUMAN_REVIEW',
      netExpectedValuePaise,
      falsePositiveSavedPaise: 0,
    };
  }

  return {
    status: 'READY_TO_CONTEST',
    netExpectedValuePaise,
    falsePositiveSavedPaise: 0,
  };
}
