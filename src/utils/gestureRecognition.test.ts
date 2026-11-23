import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGesture,
  isFingerExtended,
  isFingerFolded,
  GestureStabilizer,
  LandmarkSmoother,
  DEFAULT_THRESHOLDS,
  FingerAnalysis,
} from './gestureRecognition';
import { LandmarkPoint } from '../types';

test('classifyGesture maps core 4 gestures (Write, Erase, Pointer, Hold) accurately', () => {
  // 1. Write (draw): only index extended
  const drawFingers: Partial<FingerAnalysis> = {
    index: true,
    middle: false,
    ring: false,
    pinky: false,
    thumb: false,
    indexFolded: false,
    middleFolded: true,
    ringFolded: true,
    pinkyFolded: true,
    handScale: 0.2,
  };
  assert.equal(classifyGesture(drawFingers), 'draw');

  // Write with relaxed pinky
  const drawRelaxedPinky: Partial<FingerAnalysis> = {
    index: true,
    middle: false,
    ring: false,
    pinky: false,
    thumb: false,
    indexFolded: false,
    middleFolded: true,
    ringFolded: true,
    pinkyFolded: false,
    handScale: 0.2,
  };
  assert.equal(classifyGesture(drawRelaxedPinky), 'draw');

  // 2. Erase: Open palm (all 4 main fingers extended)
  const eraseFingers: Partial<FingerAnalysis> = {
    index: true,
    middle: true,
    ring: true,
    pinky: true,
    thumb: true,
    indexFolded: false,
    middleFolded: false,
    ringFolded: false,
    pinkyFolded: false,
    handScale: 0.2,
  };
  assert.equal(classifyGesture(eraseFingers), 'erase');

  // 3. Pointer (cursor): 2 fingers up (index + middle extended, ring & pinky folded)
  const pointerFingers: Partial<FingerAnalysis> = {
    index: true,
    middle: true,
    ring: false,
    pinky: false,
    thumb: false,
    indexFolded: false,
    middleFolded: false,
    ringFolded: true,
    pinkyFolded: true,
    handScale: 0.2,
  };
  assert.equal(classifyGesture(pointerFingers), 'cursor');

  // 4. Hold (pause): Closed fist (all 4 folded)
  const holdFingers: Partial<FingerAnalysis> = {
    index: false,
    middle: false,
    ring: false,
    pinky: false,
    thumb: false,
    indexFolded: true,
    middleFolded: true,
    ringFolded: true,
    pinkyFolded: true,
    handScale: 0.2,
  };
  assert.equal(classifyGesture(holdFingers), 'pause');

  // Mixed unrecognized posture
  const invalidFingers: Partial<FingerAnalysis> = {
    index: false,
    middle: true,
    ring: false,
    pinky: true,
    thumb: false,
    indexFolded: true,
    middleFolded: false,
    ringFolded: true,
    pinkyFolded: false,
    handScale: 0.2,
  };
  assert.equal(classifyGesture(invalidFingers), 'none');
});

test('isFingerExtended detects extended vs curled finger coordinates', () => {
  const wrist: LandmarkPoint = { x: 0.5, y: 0.9, z: 0 };
  const mcp: LandmarkPoint = { x: 0.5, y: 0.6, z: 0 };
  const pip: LandmarkPoint = { x: 0.5, y: 0.45, z: 0 };
  const dip: LandmarkPoint = { x: 0.5, y: 0.35, z: 0 };
  const tipExtended: LandmarkPoint = { x: 0.5, y: 0.2, z: 0 };
  const tipCurled: LandmarkPoint = { x: 0.5, y: 0.55, z: 0 };

  assert.equal(isFingerExtended(tipExtended, dip, pip, mcp, wrist, DEFAULT_THRESHOLDS, 0.3), true);
  assert.equal(isFingerExtended(tipCurled, dip, pip, mcp, wrist, DEFAULT_THRESHOLDS, 0.3), false);
});

test('isFingerFolded reliably flags curled finger', () => {
  const wrist: LandmarkPoint = { x: 0.5, y: 0.9, z: 0 };
  const mcp: LandmarkPoint = { x: 0.5, y: 0.6, z: 0 };
  const pip: LandmarkPoint = { x: 0.5, y: 0.45, z: 0 };
  const tipCurled: LandmarkPoint = { x: 0.5, y: 0.62, z: 0 };

  assert.equal(isFingerFolded(tipCurled, pip, mcp, wrist, 0.3), true);
});

test('GestureStabilizer debounces rapid transitions and provides active-stroke grace', () => {
  const stabilizer = new GestureStabilizer({
    ...DEFAULT_THRESHOLDS,
    debounceFrames: 2,
    graceFrames: 2,
  });

  assert.equal(stabilizer.getCurrent(), 'none');
  assert.equal(stabilizer.process('draw'), 'none');
  assert.equal(stabilizer.process('draw'), 'draw');
  assert.equal(stabilizer.process('draw'), 'draw');

  // Single and double glitch frames held by grace period
  assert.equal(stabilizer.process('none'), 'draw');
  assert.equal(stabilizer.process('none'), 'draw');
  assert.equal(stabilizer.process('none'), 'none');
});

test('GestureStabilizer protects active drawing from single-frame pause or pointer twitch', () => {
  const stabilizer = new GestureStabilizer({
    ...DEFAULT_THRESHOLDS,
    debounceFrames: 2,
    graceFrames: 2,
  });

  stabilizer.process('draw');
  stabilizer.process('draw');
  assert.equal(stabilizer.getCurrent(), 'draw');

  assert.equal(stabilizer.process('pause'), 'draw');
  assert.equal(stabilizer.process('cursor'), 'draw');
  assert.equal(stabilizer.process('draw'), 'draw');
});

test('isFingerExtended detects straight finger even under foreshortened Z-perspective', () => {
  const wrist: LandmarkPoint = { x: 0.5, y: 0.9, z: 0 };
  const mcp: LandmarkPoint = { x: 0.5, y: 0.6, z: 0 };
  const pip: LandmarkPoint = { x: 0.5, y: 0.52, z: 0.08 };
  const dip: LandmarkPoint = { x: 0.5, y: 0.46, z: 0.15 };
  const tipForeshortened: LandmarkPoint = { x: 0.5, y: 0.40, z: 0.22 };

  assert.equal(isFingerExtended(tipForeshortened, dip, pip, mcp, wrist, DEFAULT_THRESHOLDS, 0.3), true);
});

test('GestureStabilizer shields active Write stroke from 2-frame accidental flickers', () => {
  const stabilizer = new GestureStabilizer({
    ...DEFAULT_THRESHOLDS,
    debounceFrames: 2,
    graceFrames: 2,
  });

  stabilizer.process('draw');
  stabilizer.process('draw');
  assert.equal(stabilizer.getCurrent(), 'draw');

  // Exiting active drawing requires debounceFrames + 1 (3 frames)
  assert.equal(stabilizer.process('cursor'), 'draw');
  assert.equal(stabilizer.process('cursor'), 'draw');
  assert.equal(stabilizer.process('cursor'), 'cursor');
});

test('LandmarkSmoother dampens micro-jitter and Z-depth noise while resetting cleanly', () => {
  const smoother = new LandmarkSmoother();
  const base = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0.0 }));

  const first = smoother.smooth(base);
  assert.equal(first[8].x, 0.5);

  // Small XY tremor + large Z spike
  const noisy = base.map((pt, i) =>
    i === 8 ? { x: 0.5015, y: 0.5015, z: 0.1 } : pt
  );
  const smoothed = smoother.smooth(noisy);
  assert.ok(smoothed[8].x < 0.501, `Expected micro-tremor damped, got ${smoothed[8].x}`);
  assert.ok((smoothed[8].z ?? 0) < 0.04, `Expected Z spike damped, got ${smoothed[8].z}`);

  smoother.reset();
  const afterReset = smoother.smooth(noisy);
  assert.equal(afterReset[8].x, 0.5015);
});
