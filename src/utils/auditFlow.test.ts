import test from 'node:test';
import assert from 'node:assert/strict';
import type { AuditLogEntry } from '../shared/types';
import {
  computeAuditFlowSummary,
  formatPayloadJson,
  getAuditNodeVisualMeta,
  getLatencySharePercent,
} from './auditFlow.ts';

const SAMPLE_LOGS: AuditLogEntry[] = [
  {
    id: 'step_1',
    disputeId: 'disp_1',
    stepNumber: 1,
    nodeName: 'Webhook HMAC Verified',
    decisionType: 'DETERMINISTIC',
    status: 'PASSED',
    summary: 'Verified signature',
    payloadJson: '{"ok":true}',
    latencyMs: 10,
    timestamp: '2026-11-18T00:00:00Z',
  },
  {
    id: 'step_2',
    disputeId: 'disp_1',
    stepNumber: 2,
    nodeName: 'Parallel Evidence Fetch',
    decisionType: 'FALLBACK',
    status: 'WARNING',
    summary: 'Courier timeout fallback',
    payloadJson: '{"fallback":true}',
    latencyMs: 3000,
    timestamp: '2026-11-18T00:00:03Z',
  },
  {
    id: 'step_3',
    disputeId: 'disp_1',
    stepNumber: 3,
    nodeName: 'Cost-Benefit Gate',
    decisionType: 'DETERMINISTIC',
    status: 'BLOCKED',
    summary: 'Micro dispute blocked',
    payloadJson: '{"blocked":true}',
    latencyMs: 20,
    timestamp: '2026-11-18T00:00:03Z',
  },
];

test('computeAuditFlowSummary aggregates latency, counts, and slowest node', () => {
  const summary = computeAuditFlowSummary(SAMPLE_LOGS);
  assert.equal(summary.totalLatencyMs, 3030);
  assert.equal(summary.passedCount, 1);
  assert.equal(summary.warningCount, 1);
  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.slowestStepId, 'step_2');
});

test('getLatencySharePercent clamps percentages cleanly', () => {
  assert.equal(getLatencySharePercent(3000, 3030), 99);
  assert.equal(getLatencySharePercent(10, 3030), 2);
  assert.equal(getLatencySharePercent(10, 0), 0);
});

test('getAuditNodeVisualMeta returns explicit labels for every status', () => {
  assert.equal(getAuditNodeVisualMeta('PASSED', 'ML_MODEL').statusLabel, 'PASSED');
  assert.equal(getAuditNodeVisualMeta('WARNING', 'FALLBACK').statusLabel, 'WARNING');
  assert.equal(getAuditNodeVisualMeta('BLOCKED', 'DETERMINISTIC').statusLabel, 'BLOCKED');
});

test('formatPayloadJson pretty-prints valid JSON and preserves fallback strings', () => {
  assert.equal(formatPayloadJson('{"a":1}'), '{\n  "a": 1\n}');
  assert.equal(formatPayloadJson('raw-text'), 'raw-text');
});
