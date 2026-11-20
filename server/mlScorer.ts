import type { HeldOutEvaluationResult, HeldOutRow, PolicyConfig } from '../src/shared/types.ts';
import { evaluateCostBenefitGate } from './costGate.ts';

export interface WinScorerFeatures {
  ipMatch: boolean;
  deviceMatch: boolean;
  threeDsAuthenticated: boolean;
  accountAgeDays: number;
  priorUndisputedOrders: number;
  podSignatureValid: boolean;
  deliveryAddressMatched: boolean;
  chatReceiptConfirmed: boolean;
}

// Deterministic Mulberry32 PRNG for reproducible 200-case dataset
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDataset(): { train: HeldOutRow[]; test: HeldOutRow[] } {
  const rng = createRng(20261117);
  const allRows: HeldOutRow[] = [];

  // Exact archetype distribution across 200 rows:
  // 90 Friendly Fraud (45%), 60 True Fraud ATO (30%), 30 Micro-Disputes (15%), 20 Ambiguous (10%)
  const buildArchetypes = (count: number, prefix: string): HeldOutRow[] => {
    const rows: HeldOutRow[] = [];
    const friendlyCount = Math.round(count * 0.45);
    const trueFraudCount = Math.round(count * 0.30);
    const microCount = Math.round(count * 0.15);
    const ambiguousCount = count - friendlyCount - trueFraudCount - microCount;

    const specs: Array<{ archetype: HeldOutRow['archetype']; n: number }> = [
      { archetype: 'friendly_fraud', n: friendlyCount },
      { archetype: 'true_fraud', n: trueFraudCount },
      { archetype: 'micro_dispute', n: microCount },
      { archetype: 'ambiguous', n: ambiguousCount },
    ];

    let idx = 1;
    for (const spec of specs) {
      for (let i = 0; i < spec.n; i++) {
        const id = `${prefix}_${String(idx++).padStart(3, '0')}`;
        if (spec.archetype === 'friendly_fraud') {
          const slightNoise = rng() < 0.08;
          rows.push({
            id,
            archetype: 'friendly_fraud',
            amountInr: Math.round(1400 + rng() * 14000),
            ipMatch: slightNoise ? false : true,
            deviceMatch: true,
            threeDsAuthenticated: true,
            accountAgeDays: Math.round(120 + rng() * 900),
            priorUndisputedOrders: Math.round(2 + rng() * 14),
            podSignatureValid: true,
            deliveryAddressMatched: true,
            chatReceiptConfirmed: rng() > 0.15,
            groundTruthWinnable: 1,
          });
        } else if (spec.archetype === 'true_fraud') {
          const hardCase = rng() < 0.1; // occasional noisy signal
          rows.push({
            id,
            archetype: 'true_fraud',
            amountInr: Math.round(2500 + rng() * 22000),
            ipMatch: hardCase,
            deviceMatch: false,
            threeDsAuthenticated: false,
            accountAgeDays: Math.round(1 + rng() * 18),
            priorUndisputedOrders: 0,
            podSignatureValid: rng() < 0.12,
            deliveryAddressMatched: false,
            chatReceiptConfirmed: false,
            groundTruthWinnable: 0,
          });
        } else if (spec.archetype === 'micro_dispute') {
          rows.push({
            id,
            archetype: 'micro_dispute',
            amountInr: Math.round(150 + rng() * 410), // always < ₹600
            ipMatch: rng() > 0.3,
            deviceMatch: rng() > 0.3,
            threeDsAuthenticated: rng() > 0.4,
            accountAgeDays: Math.round(30 + rng() * 300),
            priorUndisputedOrders: Math.round(rng() * 5),
            podSignatureValid: rng() > 0.4,
            deliveryAddressMatched: rng() > 0.3,
            chatReceiptConfirmed: false,
            groundTruthWinnable: rng() > 0.5 ? 1 : 0,
          });
        } else {
          // Edge / ambiguous: delivered, but customer complained or partial signal
          const winnable: 0 | 1 = rng() > 0.45 ? 1 : 0;
          rows.push({
            id,
            archetype: 'ambiguous',
            amountInr: Math.round(1200 + rng() * 6000),
            ipMatch: winnable === 1 ? true : rng() > 0.5,
            deviceMatch: rng() > 0.35,
            threeDsAuthenticated: winnable === 1 ? true : rng() > 0.6,
            accountAgeDays: Math.round(25 + rng() * 180),
            priorUndisputedOrders: winnable === 1 ? Math.round(1 + rng() * 3) : 0,
            podSignatureValid: winnable === 1 ? true : false,
            deliveryAddressMatched: true,
            chatReceiptConfirmed: false,
            groundTruthWinnable: winnable,
          });
        }
      }
    }
    return rows;
  };

  const train = buildArchetypes(140, 'TRN');
  const test = buildArchetypes(60, 'TST');
  allRows.push(...train, ...test);
  return { train, test };
}

const DATASET = generateDataset();
export const TRAIN_DISPUTES: HeldOutRow[] = DATASET.train;
export const HELD_OUT_TEST_DISPUTES: HeldOutRow[] = DATASET.test;

function toFeatureVector(f: WinScorerFeatures): number[] {
  return [
    1, // bias
    f.ipMatch ? 1 : 0,
    f.deviceMatch ? 1 : 0,
    f.threeDsAuthenticated ? 1 : 0,
    Math.min(f.accountAgeDays, 365) / 365,
    Math.min(f.priorUndisputedOrders, 10) / 10,
    f.podSignatureValid ? 1 : 0,
    f.deliveryAddressMatched ? 1 : 0,
    f.chatReceiptConfirmed ? 1 : 0,
  ];
}

function sigmoid(z: number): number {
  if (z > 20) return 1 - 1e-9;
  if (z < -20) return 1e-9;
  return 1 / (1 + Math.exp(-z));
}

// Train L2-regularized calibrated logistic model on 140 training cases at module load
function trainCalibratedWeights(rows: HeldOutRow[]): number[] {
  const numFeatures = 9;
  const weights = new Array<number>(numFeatures).fill(0);
  const lr = 0.25;
  const l2 = 0.015;
  const epochs = 450;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const grads = new Array<number>(numFeatures).fill(0);
    for (const row of rows) {
      const x = toFeatureVector(row);
      let z = 0;
      for (let j = 0; j < numFeatures; j++) z += weights[j] * x[j];
      const pred = sigmoid(z);
      const err = pred - row.groundTruthWinnable;
      for (let j = 0; j < numFeatures; j++) {
        grads[j] += err * x[j];
      }
    }
    for (let j = 0; j < numFeatures; j++) {
      const reg = j === 0 ? 0 : l2 * weights[j];
      weights[j] -= lr * (grads[j] / rows.length + reg);
    }
  }
  return weights;
}

const TRAINED_WEIGHTS = trainCalibratedWeights(TRAIN_DISPUTES);

/**
 * Predicts calibrated win probability in [0.01, 0.99] using trained weights.
 */
export function predictWinProbability(features: WinScorerFeatures): number {
  const x = toFeatureVector(features);
  let z = 0;
  for (let j = 0; j < TRAINED_WEIGHTS.length; j++) {
    z += TRAINED_WEIGHTS[j] * x[j];
  }
  const prob = sigmoid(z);
  return Math.round(Math.min(0.985, Math.max(0.015, prob)) * 1000) / 1000;
}

function computeConfusionAtThreshold(
  threshold: number,
  policy: Pick<PolicyConfig, 'gatewayDisputeFeeInr' | 'internalOpsCostInr'>
) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let blockedByCostGate = 0;
  let grossRecoveredInr = 0;
  let wonFeeCostInr = 0;

  for (const row of HELD_OUT_TEST_DISPUTES) {
    const gate = evaluateCostBenefitGate(row.amountInr * 100, policy);
    let predictedContest = false;
    if (!gate.shouldContest) {
      blockedByCostGate++;
      predictedContest = false;
    } else {
      const prob = predictWinProbability(row);
      predictedContest = prob >= threshold;
    }

    if (predictedContest && row.groundTruthWinnable === 1) {
      tp++;
      grossRecoveredInr += row.amountInr;
      wonFeeCostInr += policy.internalOpsCostInr;
    } else if (predictedContest && row.groundTruthWinnable === 0) {
      fp++;
    } else if (!predictedContest && row.groundTruthWinnable === 0) {
      tn++;
    } else {
      fn++;
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositivePenaltyPerCaseInr = policy.gatewayDisputeFeeInr;
  const falsePositiveCostInr = fp * falsePositivePenaltyPerCaseInr;
  const netRecoveredInr = Math.round(grossRecoveredInr - falsePositiveCostInr - wonFeeCostInr);

  return {
    blockedByCostGate,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1Score: Math.round(f1Score * 1000) / 1000,
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    falsePositivePenaltyPerCaseInr,
    falsePositiveCostInr,
    grossRecoveredInr: Math.round(grossRecoveredInr),
    netRecoveredInr,
  };
}

/**
 * Evaluates all 60 unseen held-out test rows across the requested threshold + threshold curve.
 */
export function evaluateHeldOutTestSet(
  threshold: number = 0.75,
  policy: Pick<PolicyConfig, 'gatewayDisputeFeeInr' | 'internalOpsCostInr'> = {
    gatewayDisputeFeeInr: 500,
    internalOpsCostInr: 100,
  }
): HeldOutEvaluationResult {
  const clampedThreshold = Math.min(0.95, Math.max(0.5, Math.round(threshold * 100) / 100));
  const summary = computeConfusionAtThreshold(clampedThreshold, policy);

  const curve: HeldOutEvaluationResult['curve'] = [];
  for (let t = 50; t <= 95; t += 5) {
    const th = t / 100;
    const point = computeConfusionAtThreshold(th, policy);
    curve.push({
      threshold: th,
      precision: Math.round(point.precision * 1000) / 10,
      recall: Math.round(point.recall * 1000) / 10,
      falsePositiveCostInr: point.falsePositiveCostInr,
      netRecoveredInr: point.netRecoveredInr,
    });
  }

  return {
    threshold: clampedThreshold,
    totalCases: HELD_OUT_TEST_DISPUTES.length,
    ...summary,
    curve,
  };
}
