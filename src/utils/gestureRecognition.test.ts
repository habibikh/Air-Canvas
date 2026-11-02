import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGesture,
  isFingerExtended,
  GestureStabilizer,
  DEFAULT_THRESHOLDS,
  FingerAnalysis,
} from './gestureRecognition';
import { LandmarkPoint } from '../types';

test('classifyGesture maps finger states accurately', () => {
  // Gesture A: Draw (only index extended)
  const drawFingers: FingerAnalysis = {
    index: true,
    middle: false,
    ring: false,
    pinky: false,
    thumb: false,
  };
  assert.equal(classifyGesture(drawFingers), 'draw');

  // Draw with thumb out
  const drawWithThumb: FingerAnalysis = {
    index: true,
    middle: false,
    ring: false,
    pinky: false,
    thumb: true,
  };
  assert.equal(classifyGesture(drawWithThumb), 'draw');

  // Gesture B: Erase (all 4 main fingers extended)
  const eraseFingers: FingerAnalysis = {
    index: true,
    middle: true,
    ring: true,
    pinky: true,
    thumb: true,
  };
  assert.equal(classifyGesture(eraseFingers), 'erase');

  // Gesture C: Pause (all 4 folded into fist)
  const pauseFingers: FingerAnalysis = {
    index: false,
    middle: false,
    ring: false,
    pinky: false,
    thumb: false,
  };
  assert.equal(classifyGesture(pauseFingers), 'pause');

  // Gesture D: Cursor (index and middle extended, ring & pinky folded)
  const cursorFingers: FingerAnalysis = {
    index: true,
    middle: true,
    ring: false,
    pinky: false,
    thumb: false,
  };
  assert.equal(classifyGesture(cursorFingers), 'cursor');

  // Mixed invalid/unrecognized
  const invalidFingers: FingerAnalysis = {
    index: false,
    middle: true,
    ring: false,
    pinky: true,
    thumb: false,
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

  const extended = isFingerExtended(tipExtended, dip, pip, mcp, wrist, DEFAULT_THRESHOLDS);
  assert.equal(extended, true);

  const curled = isFingerExtended(tipCurled, dip, pip, mcp, wrist, DEFAULT_THRESHOLDS);
  assert.equal(curled, false);
});

test('GestureStabilizer debounces rapid transitions', () => {
  const stabilizer = new GestureStabilizer({
    ...DEFAULT_THRESHOLDS,
    debounceFrames: 2,
  });

  assert.equal(stabilizer.getCurrent(), 'none');

  // Single frame of draw should not switch immediately if debounce is 2
  const frame1 = stabilizer.process('draw');
  assert.equal(frame1, 'none');

  // Second frame confirms draw
  const frame2 = stabilizer.process('draw');
  assert.equal(frame2, 'draw');

  // Steady draw remains draw
  const frame3 = stabilizer.process('draw');
  assert.equal(frame3, 'draw');

  // Single glitch frame to none is ignored
  const glitch = stabilizer.process('none');
  assert.equal(glitch, 'draw');
});
