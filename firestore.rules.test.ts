import test from 'node:test';
import assert from 'node:assert/strict';

const VALID_ID_RE = /^[a-zA-Z0-9_\-]+$/;

function validateDisputeNotePayload(payload: Record<string, unknown>, authUid: string): boolean {
  const required = ['uid', 'disputeId', 'note', 'decisionOverride', 'createdAt', 'updatedAt'];
  const keys = Object.keys(payload);
  if (!required.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => required.includes(k))) return false;
  if (typeof payload.uid !== 'string' || !VALID_ID_RE.test(payload.uid) || payload.uid !== authUid) return false;
  if (typeof payload.disputeId !== 'string' || !VALID_ID_RE.test(payload.disputeId) || payload.disputeId.length > 64) {
    return false;
  }
  if (typeof payload.note !== 'string' || payload.note.length < 1 || payload.note.length > 2000) return false;
  if (!['NONE', 'CONTEST', 'ACCEPT', 'ESCALATE'].includes(String(payload.decisionOverride))) return false;
  return true;
}

test('Firestore schema contract accepts valid DisputeNote payload and rejects Dirty Dozen payloads', () => {
  assert.equal(
    validateDisputeNotePayload(
      {
        uid: 'user_abc123',
        disputeId: 'disp_RF991024',
        note: 'Verified 3DS2 ECI 05 and security desk delivery confirmation.',
        decisionOverride: 'CONTEST',
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      },
      'user_abc123'
    ),
    true
  );

  // Reject UID spoofing
  assert.equal(
    validateDisputeNotePayload(
      {
        uid: 'victim_uid',
        disputeId: 'disp_RF991024',
        note: 'Spoofed author',
        decisionOverride: 'CONTEST',
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      },
      'attacker_uid'
    ),
    false
  );

  // Reject mass assignment extra key
  assert.equal(
    validateDisputeNotePayload(
      {
        uid: 'user_abc123',
        disputeId: 'disp_RF991024',
        note: 'Note',
        decisionOverride: 'NONE',
        isAdmin: true,
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      },
      'user_abc123'
    ),
    false
  );

  // Reject oversized note (>2000 chars)
  assert.equal(
    validateDisputeNotePayload(
      {
        uid: 'user_abc123',
        disputeId: 'disp_RF991024',
        note: 'x'.repeat(2001),
        decisionOverride: 'NONE',
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      },
      'user_abc123'
    ),
    false
  );

  // Reject path traversal in disputeId
  assert.equal(
    validateDisputeNotePayload(
      {
        uid: 'user_abc123',
        disputeId: '../admin',
        note: 'Valid note',
        decisionOverride: 'NONE',
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      },
      'user_abc123'
    ),
    false
  );
});
