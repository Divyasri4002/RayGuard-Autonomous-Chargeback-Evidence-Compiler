import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOverviewMetrics, createEmptyStoreState, DEFAULT_POLICY } from './store.ts';
import type { DisputeRecord } from '../src/shared/types.ts';

test('empty store initializes with zero fake orders or disputes', () => {
  const empty = createEmptyStoreState();
  assert.equal(Object.keys(empty.orders).length, 0);
  assert.equal(Object.keys(empty.disputes).length, 0);
  assert.equal(Object.keys(empty.auditLogs).length, 0);
  assert.equal(empty.processedEventIds.length, 0);
});

test('computeOverviewMetrics returns zeroed metrics when store has no disputes', () => {
  const metrics = computeOverviewMetrics([], DEFAULT_POLICY);
  assert.equal(metrics.totalDisputes, 0);
  assert.equal(metrics.netRevenueRecoveredInr, 0);
  assert.equal(metrics.falsePositivePenaltyAvoidedInr, 0);
  assert.equal(metrics.meanTimeToDossierSec, 0);
  assert.equal(metrics.sparklines.recovery.length, 0);
  assert.equal(metrics.sparklines.avoided.length, 0);
  assert.equal(metrics.sparklines.mttd.length, 0);
});

test('computeOverviewMetrics calculates live aggregates strictly from provided disputes', () => {
  const sampleDisputes: DisputeRecord[] = [
    {
      disputeId: 'disp_LIVE_001',
      paymentId: 'pay_LIVE_001',
      orderId: 'ord_LIVE_001',
      amountPaise: 500000,
      reasonCode: '10.4',
      network: 'Visa',
      status: 'READY_TO_CONTEST',
      winProbability: 0.91,
      courierFallbackUsed: false,
      netExpectedValuePaise: 440000,
      falsePositiveSavedPaise: 0,
      hmacVerified: true,
      hmacSignaturePreview: 'abc123',
      mttdMs: 2400,
      dossierPdfUrl: '/api/dossiers/disp_LIVE_001/pdf',
      rebuttalText: 'Rebuttal statement',
      extractedProof: null,
      createdAt: '2026-11-18T10:00:00.000Z',
    },
    {
      disputeId: 'disp_LIVE_002',
      paymentId: 'pay_LIVE_002',
      orderId: 'ord_LIVE_002',
      amountPaise: 40000,
      reasonCode: '4837',
      network: 'Mastercard',
      status: 'AUTO_ACCEPT_LOSS',
      winProbability: 0,
      courierFallbackUsed: false,
      netExpectedValuePaise: -20000,
      falsePositiveSavedPaise: 60000,
      hmacVerified: true,
      hmacSignaturePreview: 'def456',
      mttdMs: 400,
      dossierPdfUrl: '/api/dossiers/disp_LIVE_002/pdf',
      rebuttalText: 'Blocked by cost gate',
      extractedProof: null,
      createdAt: '2026-11-18T10:05:00.000Z',
    },
  ];

  const metrics = computeOverviewMetrics(sampleDisputes, DEFAULT_POLICY);
  assert.equal(metrics.totalDisputes, 2);
  assert.equal(metrics.contestedCount, 1);
  assert.equal(metrics.blockedLossCount, 1);
  assert.equal(metrics.grossWonVolumeInr, 5000);
  assert.equal(metrics.netRevenueRecoveredInr, 4900);
  assert.equal(metrics.falsePositivePenaltyAvoidedInr, 600);
  assert.equal(metrics.meanTimeToDossierSec, 1.4);
  assert.equal(metrics.sparklines.recovery.length, 2);
});
