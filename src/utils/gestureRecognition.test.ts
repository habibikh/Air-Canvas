import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeFingers,
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

test('analyzeFingers + classifyGesture recognize naturally tilted/curved index finger as Write, not Hold', () => {
  // Hand landmark skeleton (21 pts) with middle/ring/pinky folded into palm,
  // and index finger angled/curved (~35 deg) as during natural fast handwriting
  const landmarks: LandmarkPoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.65, z: 0 }));
  landmarks[0] = { x: 0.5, y: 0.90, z: 0 };  // Wrist
  landmarks[2] = { x: 0.44, y: 0.78, z: 0 }; // Thumb MCP
  landmarks[3] = { x: 0.45, y: 0.72, z: 0 }; // Thumb IP
  landmarks[4] = { x: 0.47, y: 0.69, z: 0 }; // Thumb tip (tucked)

  // Index tilted forward/sideways (not ramrod straight)
  landmarks[5] = { x: 0.46, y: 0.62, z: 0 };
  landmarks[6] = { x: 0.43, y: 0.51, z: -0.02 };
  landmarks[7] = { x: 0.46, y: 0.46, z: -0.05 };
  landmarks[8] = { x: 0.50, y: 0.45, z: -0.07 };

  // Middle, ring, pinky curled tight
  landmarks[9] = { x: 0.50, y: 0.62, z: 0 };
  landmarks[10] = { x: 0.50, y: 0.57, z: 0 };
  landmarks[12] = { x: 0.50, y: 0.66, z: 0 };

  landmarks[13] = { x: 0.54, y: 0.63, z: 0 };
  landmarks[14] = { x: 0.54, y: 0.58, z: 0 };
  landmarks[16] = { x: 0.54, y: 0.67, z: 0 };

  landmarks[17] = { x: 0.58, y: 0.65, z: 0 };
  landmarks[18] = { x: 0.58, y: 0.61, z: 0 };
  landmarks[20] = { x: 0.58, y: 0.69, z: 0 };

  const analysis = analyzeFingers(landmarks);
  assert.ok(analysis !== null);
  assert.equal(classifyGesture(analysis), 'draw');
});

test('GestureStabilizer default graceFrames keeps active Write stroke alive across 5 motion-blur frames', () => {
  const stabilizer = new GestureStabilizer(DEFAULT_THRESHOLDS);
  assert.equal(stabilizer.process('draw'), 'none');
  assert.equal(stabilizer.process('draw'), 'draw');

  for (let i = 0; i < DEFAULT_THRESHOLDS.graceFrames; i++) {
    assert.equal(stabilizer.process('none'), 'draw');
  }
  assert.equal(stabilizer.process('none'), 'none');
});
