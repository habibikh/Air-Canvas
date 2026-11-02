import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGesture,
  isFingerExtended,
  isFingerFolded,
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
    indexFolded: false,
    middleFolded: true,
    ringFolded: true,
    pinkyFolded: true,
    handScale: 0.2,
  };
  assert.equal(classifyGesture(drawFingers), 'draw');

  // Draw with thumb out
  const drawWithThumb: FingerAnalysis = {
    index: true,
    middle: false,
    ring: false,
    pinky: false,
    thumb: true,
    indexFolded: false,
    middleFolded: true,
    ringFolded: true,
    pinkyFolded: true,
    handScale: 0.2,
  };
  assert.equal(classifyGesture(drawWithThumb), 'draw');

  // Natural drawing grip: pinky slightly relaxed but middle & ring folded
  const drawRelaxedPinky: FingerAnalysis = {
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

  // Gesture B: Erase (all 4 main fingers extended)
  const eraseFingers: FingerAnalysis = {
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

  // Gesture C: Pause (all 4 folded into fist)
  const pauseFingers: FingerAnalysis = {
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
  assert.equal(classifyGesture(pauseFingers), 'pause');

  // Gesture D: Cursor (index and middle extended, ring & pinky folded)
  const cursorFingers: FingerAnalysis = {
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
  assert.equal(classifyGesture(cursorFingers), 'cursor');

  // Mixed invalid/unrecognized
  const invalidFingers: FingerAnalysis = {
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

  const extended = isFingerExtended(tipExtended, dip, pip, mcp, wrist, DEFAULT_THRESHOLDS, 0.3);
  assert.equal(extended, true);

  const curled = isFingerExtended(tipCurled, dip, pip, mcp, wrist, DEFAULT_THRESHOLDS, 0.3);
  assert.equal(curled, false);
});

test('isFingerFolded reliably flags curled finger', () => {
  const wrist: LandmarkPoint = { x: 0.5, y: 0.9, z: 0 };
  const mcp: LandmarkPoint = { x: 0.5, y: 0.6, z: 0 };
  const pip: LandmarkPoint = { x: 0.5, y: 0.45, z: 0 };
  const tipCurled: LandmarkPoint = { x: 0.5, y: 0.62, z: 0 }; // curled right next to palm

  const folded = isFingerFolded(tipCurled, pip, mcp, wrist, 0.3);
  assert.equal(folded, true);
});

test('GestureStabilizer debounces rapid transitions and provides active-stroke grace', () => {
  const stabilizer = new GestureStabilizer({
    ...DEFAULT_THRESHOLDS,
    debounceFrames: 2,
    graceFrames: 2,
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

  // Single glitch frame to none is protected by grace period
  const glitch = stabilizer.process('none');
  assert.equal(glitch, 'draw');

  // Second glitch frame still held
  const glitch2 = stabilizer.process('none');
  assert.equal(glitch2, 'draw');

  // Third glitch frame releases to none
  const glitch3 = stabilizer.process('none');
  assert.equal(glitch3, 'none');
});
