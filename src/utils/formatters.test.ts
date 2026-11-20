import test from 'node:test';
import assert from 'node:assert/strict';
import { formatInrFromPaise, formatLatency, formatPercent, getStatusMeta } from './formatters.ts';

test('formatters output Indian rupee formatting and crisp latency strings', () => {
  assert.equal(formatInrFromPaise(480000), '₹4,800');
  assert.equal(formatInrFromPaise(1250000), '₹12,500');
  assert.equal(formatPercent(0.884), '88.4%');
  assert.equal(formatLatency(420), '420ms');
  assert.equal(formatLatency(3840), '3.84s');
});

test('status meta returns explicit human labels for every state', () => {
  assert.equal(getStatusMeta('READY_TO_CONTEST').label, 'Ready to Contest');
  assert.equal(getStatusMeta('AUTO_ACCEPT_LOSS').label, 'Micro-Blocked');
  assert.equal(getStatusMeta('HUMAN_REVIEW').label, 'Human Review');
  assert.equal(getStatusMeta('RECOMMEND_ACCEPT').label, 'Fraud Blocked');
});
