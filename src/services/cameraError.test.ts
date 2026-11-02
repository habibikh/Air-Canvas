import { test } from 'node:test';
import assert from 'node:assert';

export function classifyCameraError(err: unknown): { status: 'denied' | 'unsupported' | 'error'; message: string; isDenied: boolean } {
  const error = err as Error;
  const name = error?.name || '';
  const msg = error?.message || '';

  const isDenied =
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    msg.toLowerCase().includes('permission denied') ||
    msg.toLowerCase().includes('permission') ||
    msg.toLowerCase().includes('not allowed');

  const isNotFound =
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    msg.toLowerCase().includes('not found') ||
    msg.toLowerCase().includes('device');

  if (isDenied) {
    return {
      status: 'denied',
      message: 'Camera permission denied. Allow access in your browser address bar to use gestures.',
      isDenied: true,
    };
  }

  if (isNotFound) {
    return {
      status: 'unsupported',
      message: 'No camera hardware detected on device.',
      isDenied: false,
    };
  }

  return {
    status: 'error',
    message: msg || 'Unable to access camera.',
    isDenied: false,
  };
}

test('classifyCameraError correctly identifies NotAllowedError as denied', () => {
  const err = new Error('Permission denied');
  err.name = 'NotAllowedError';
  const res = classifyCameraError(err);
  assert.strictEqual(res.status, 'denied');
  assert.strictEqual(res.isDenied, true);
  assert.match(res.message, /permission denied/i);
});

test('classifyCameraError identifies string Permission denied without specific error name', () => {
  const err = new Error('Camera or MediaPipe initialization failed: Permission denied');
  const res = classifyCameraError(err);
  assert.strictEqual(res.status, 'denied');
  assert.strictEqual(res.isDenied, true);
});

test('classifyCameraError identifies NotFoundError as unsupported', () => {
  const err = new Error('Requested device not found');
  err.name = 'NotFoundError';
  const res = classifyCameraError(err);
  assert.strictEqual(res.status, 'unsupported');
  assert.strictEqual(res.isDenied, false);
});
