import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDisputeDossierPdf } from './pdfGenerator.ts';
import type { AuditLogEntry, DisputeRecord, OrderRecord } from '../src/shared/types.ts';

test('generateDisputeDossierPdf compiles valid PDF bytes even when logs contain ₹ and Unicode symbols', async () => {
  const order: OrderRecord = {
    orderId: 'ord_TEST_001',
    paymentId: 'pay_TEST_001',
    amountPaise: 480000,
    customerName: 'Test Customer',
    customerEmail: 'customer@test.local',
    customerIp: '49.36.142.88',
    billingIp: '49.36.142.88',
    city: 'Bengaluru',
    deliveryAddress: 'Bengaluru 560038',
    gpsCoordinates: '12.9716 N, 77.6412 E',
    deliveredAt: '2026-11-18 10:00 UTC',
    deviceFingerprint: 'dfp_test_1',
    knownDeviceFingerprint: 'dfp_test_1',
    threeDsEci: '05',
    threeDsAuthenticated: true,
    accountAgeDays: 400,
    priorUndisputedOrders: 8,
    awbNumber: 'DLV774120988',
    courierPartner: 'Delhivery',
    courierDelivered: true,
    podImageUrl: '/api/pods/ord_TEST_001.png',
    supportChatLog: 'Delivered and confirmed.',
  };

  const dispute: DisputeRecord = {
    disputeId: 'disp_TEST_001',
    paymentId: 'pay_TEST_001',
    orderId: 'ord_TEST_001',
    amountPaise: 480000,
    reasonCode: '10.4',
    network: 'Visa',
    status: 'READY_TO_CONTEST',
    winProbability: 0.914,
    courierFallbackUsed: false,
    netExpectedValuePaise: 424400,
    falsePositiveSavedPaise: 0,
    hmacVerified: true,
    hmacSignaturePreview: '9e8c41f7b2...d04a18e',
    mttdMs: 2200,
    dossierPdfUrl: '/api/dossiers/disp_TEST_001/pdf',
    rebuttalText: 'Merchant contests ₹4,800 Visa 10.4 chargeback — ECI 05 + matching telemetry.',
    extractedProof: {
      podSignatureValid: true,
      deliveryAddressMatched: true,
      addressMatchScore: 98,
      chatReceiptConfirmed: true,
      verbatimChatQuote: 'Package delivered intact.',
      extractionSource: 'GEMINI_VISION',
      notes: 'Verified POD signature and address.',
    },
    createdAt: '2026-11-18T10:00:00.000Z',
  };

  const logs: AuditLogEntry[] = [
    {
      id: 'disp_TEST_001_1',
      disputeId: 'disp_TEST_001',
      stepNumber: 1,
      nodeName: 'Cost-Benefit Gate',
      decisionType: 'DETERMINISTIC',
      status: 'PASSED',
      summary: 'Amount ₹4,800 >= ₹600 threshold → CLEARED.',
      payloadJson: '{"cleared":true}',
      latencyMs: 11,
      timestamp: '2026-11-18T10:00:00.000Z',
    },
  ];

  const pdfBytes = await generateDisputeDossierPdf(dispute, order, logs);
  assert.ok(pdfBytes.length > 2000);
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
  assert.equal(header, '%PDF-');
});
