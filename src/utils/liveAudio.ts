/**
 * Pure audio conversion utilities for Gemini Live API 16kHz input / 24kHz output PCM streams.
 */

export function float32ToInt16Base64(float32: Float32Array): string {
  const byteLength = float32.length * 2;
  const bytes = new Uint8Array(byteLength);
  const view = new DataView(bytes.buffer);

  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    view.setInt16(i * 2, int16, true);
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64Int16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const sampleCount = Math.floor(bytes.length / 2);
  const float32 = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export function computeRmsLevel(float32: Float32Array): number {
  if (float32.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < float32.length; i++) {
    sumSq += float32[i] * float32[i];
  }
  return Math.min(1, Math.sqrt(sumSq / float32.length) * 3.5);
}
