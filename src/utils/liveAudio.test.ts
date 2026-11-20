import test from 'node:test';
import assert from 'node:assert/strict';
import { base64Int16ToFloat32, computeRmsLevel, float32ToInt16Base64 } from './liveAudio.ts';

test('float32ToInt16Base64 round-trips cleanly via base64Int16ToFloat32', () => {
  const input = new Float32Array([0, 0.5, -0.5, 1, -1, 0.25]);
  const encoded = float32ToInt16Base64(input);
  const decoded = base64Int16ToFloat32(encoded);

  assert.equal(decoded.length, input.length);
  for (let i = 0; i < input.length; i++) {
    assert.ok(Math.abs(decoded[i] - input[i]) < 0.001, `Sample ${i} drifted`);
  }
});

test('float32ToInt16Base64 clamps out-of-range samples safely', () => {
  const input = new Float32Array([2.5, -3.2]);
  const encoded = float32ToInt16Base64(input);
  const decoded = base64Int16ToFloat32(encoded);

  assert.ok(decoded[0] <= 1 && decoded[0] > 0.99);
  assert.ok(decoded[1] >= -1 && decoded[1] < -0.99);
});

test('computeRmsLevel handles silent and active buffers deterministically', () => {
  assert.equal(computeRmsLevel(new Float32Array(0)), 0);
  assert.equal(computeRmsLevel(new Float32Array([0, 0, 0, 0])), 0);
  const active = computeRmsLevel(new Float32Array([0.3, -0.3, 0.3, -0.3]));
  assert.ok(active > 0.5 && active <= 1);
});
