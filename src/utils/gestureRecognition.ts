/**
 * High-Precision Hand Gesture Recognition Engine for AirCanvas
 * Supports the 4 core spatial gestures:
 * 1. Write (draw): Index finger extended
 * 2. Erase (erase): Open palm
 * 3. Pointer (cursor): Index + middle fingers extended
 * 4. Hold (pause): Closed fist
 */

import { GestureType, LandmarkPoint } from '../types';

export interface GestureThresholds {
  fingerExtensionRatio: number; // Ratio between tip-wrist distance and pip-wrist distance
  fingerMcpRatio: number;       // Ratio between tip-mcp distance and pip-mcp distance
  debounceFrames: number;       // Frames required to confirm gesture transition
  graceFrames: number;          // Frames to hold active stroke through momentary tracking noise
}

export const DEFAULT_THRESHOLDS: GestureThresholds = {
  fingerExtensionRatio: 1.05,
  fingerMcpRatio: 1.10,
  debounceFrames: 3,
  graceFrames: 3,
};

/**
 * Computes 3D distance with damped Z-axis weight so noisy monocular webcam depth
 * does not cause finger extension/folding flicker.
 */
function fingerDistance(p1: LandmarkPoint, p2: LandmarkPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = ((p1.z || 0) - (p2.z || 0)) * 0.45;
  return Math.hypot(dx, dy, dz);
}

/**
 * Adaptive temporal smoother for all 21 MediaPipe hand landmarks.
 * Eliminates micro-tremor when steady and follows fast motion immediately.
 */
export class LandmarkSmoother {
  private prev: LandmarkPoint[] | null = null;

  public smooth(rawLandmarks: LandmarkPoint[]): LandmarkPoint[] {
    if (!rawLandmarks || rawLandmarks.length === 0) {
      return rawLandmarks;
    }

    if (!this.prev || this.prev.length !== rawLandmarks.length) {
      this.prev = rawLandmarks.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z || 0 }));
      return this.prev;
    }

    const smoothed: LandmarkPoint[] = new Array(rawLandmarks.length);
    for (let i = 0; i < rawLandmarks.length; i++) {
      const curr = rawLandmarks[i];
      const p = this.prev[i];
      const dx = curr.x - p.x;
      const dy = curr.y - p.y;
      const move = Math.hypot(dx, dy);

      // Deadband tiny sub-pixel sensor shimmer, accelerate smoothly during real motion
      const alphaXY = move < 0.002 ? 0.32 : Math.min(0.92, 0.48 + move * 14.0);
      const alphaZ = 0.30; // Stronger damping on noisy depth estimate

      const nx = p.x + dx * alphaXY;
      const ny = p.y + dy * alphaXY;
      const nz = (p.z || 0) + ((curr.z || 0) - (p.z || 0)) * alphaZ;

      const pt = { x: nx, y: ny, z: nz };
      this.prev[i] = pt;
      smoothed[i] = pt;
    }

    return smoothed;
  }

  public reset() {
    this.prev = null;
  }
}

export interface FingerAnalysis {
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  thumb: boolean;
  indexFolded: boolean;
  middleFolded: boolean;
  ringFolded: boolean;
  pinkyFolded: boolean;
  handScale: number;
  extendedCount: number;
}

/**
 * Calculates anatomically normalized hand scale (distance from wrist to middle MCP)
 */
export function calculateHandScale(landmarks: LandmarkPoint[]): number {
  if (!landmarks || landmarks.length < 21) return 0.2;
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const scale = fingerDistance(wrist, middleMcp);
  return Math.max(0.05, Math.min(0.8, scale));
}

/**
 * Checks if a non-thumb finger is extended using multi-criteria 3D geometry
 */
export function isFingerExtended(
  tip: LandmarkPoint,
  dip: LandmarkPoint,
  pip: LandmarkPoint,
  mcp: LandmarkPoint,
  wrist: LandmarkPoint,
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS,
  handScale: number = 0.2
): boolean {
  const distTipWrist = fingerDistance(tip, wrist);
  const distPipWrist = fingerDistance(pip, wrist);

  const distTipMcp = fingerDistance(tip, mcp);
  const distPipMcp = fingerDistance(pip, mcp);
  const distDipMcp = fingerDistance(dip, mcp);

  const v1x = pip.x - mcp.x;
  const v1y = pip.y - mcp.y;
  const v1z = ((pip.z || 0) - (mcp.z || 0)) * 0.45;
  const len1 = Math.hypot(v1x, v1y, v1z);

  const v2x = tip.x - pip.x;
  const v2y = tip.y - pip.y;
  const v2z = ((tip.z || 0) - (pip.z || 0)) * 0.45;
  const len2 = Math.hypot(v2x, v2y, v2z);

  const isStraight = len1 > 0 && len2 > 0 && ((v1x * v2x + v1y * v2y + v1z * v2z) / (len1 * len2) > 0.42);

  const wristExtended = distTipWrist > distPipWrist * thresholds.fingerExtensionRatio;
  const mcpExtended = distTipMcp > distPipMcp * thresholds.fingerMcpRatio;
  const scaleExtended = distTipMcp > handScale * 0.58;
  const uncurled = distTipMcp >= distDipMcp * 0.92;

  if (isStraight && (distTipMcp > distPipMcp * 1.05 || scaleExtended)) {
    return true;
  }

  return (wristExtended && mcpExtended) || (wristExtended && scaleExtended && uncurled);
}

/**
 * Checks if a non-thumb finger is folded tight into the palm
 */
export function isFingerFolded(
  tip: LandmarkPoint,
  pip: LandmarkPoint,
  mcp: LandmarkPoint,
  wrist: LandmarkPoint,
  handScale: number = 0.2
): boolean {
  const distTipMcp = fingerDistance(tip, mcp);
  const distTipWrist = fingerDistance(tip, wrist);
  const distPipWrist = fingerDistance(pip, wrist);
  const distPipMcp = fingerDistance(pip, mcp);

  const tipNearPalm = distTipMcp < handScale * 0.55;
  const tipTucked = distTipWrist < distPipWrist * 1.05;
  const curledUnder = distTipMcp < distPipMcp * 1.05;

  return tipNearPalm || (tipTucked && curledUnder);
}

/**
 * Checks if thumb is extended away from palm
 */
export function isThumbExtended(
  tip: LandmarkPoint,
  ip: LandmarkPoint,
  mcp: LandmarkPoint,
  wrist: LandmarkPoint,
  pinkyMcp: LandmarkPoint,
  handScale: number = 0.2
): boolean {
  const distTipPinky = fingerDistance(tip, pinkyMcp);
  const distIpPinky = fingerDistance(ip, pinkyMcp);
  const distTipWrist = fingerDistance(tip, wrist);
  const distMcpWrist = fingerDistance(mcp, wrist);

  const awayFromPalm = distTipPinky > distIpPinky * 1.04;
  const awayFromWrist = distTipWrist > distMcpWrist * 1.04;
  const radialReach = distTipPinky > handScale * 0.55;

  return (awayFromPalm && awayFromWrist) || radialReach;
}

/**
 * Analyzes state of all five fingers with scale invariance
 */
export function analyzeFingers(
  landmarks: LandmarkPoint[],
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS
): FingerAnalysis | null {
  if (!landmarks || landmarks.length < 21) {
    return null;
  }

  const wrist = landmarks[0];
  const pinkyMcp = landmarks[17];
  const handScale = calculateHandScale(landmarks);

  const thumb = isThumbExtended(landmarks[4], landmarks[3], landmarks[2], wrist, pinkyMcp, handScale);

  const index = isFingerExtended(landmarks[8], landmarks[7], landmarks[6], landmarks[5], wrist, thresholds, handScale);
  const middle = isFingerExtended(landmarks[12], landmarks[11], landmarks[10], landmarks[9], wrist, thresholds, handScale);
  const ring = isFingerExtended(landmarks[16], landmarks[15], landmarks[14], landmarks[13], wrist, thresholds, handScale);
  const pinky = isFingerExtended(landmarks[20], landmarks[19], landmarks[18], landmarks[17], wrist, thresholds, handScale);

  const indexFolded = isFingerFolded(landmarks[8], landmarks[6], landmarks[5], wrist, handScale);
  const middleFolded = isFingerFolded(landmarks[12], landmarks[10], landmarks[9], wrist, handScale);
  const ringFolded = isFingerFolded(landmarks[16], landmarks[14], landmarks[13], wrist, handScale);
  const pinkyFolded = isFingerFolded(landmarks[20], landmarks[18], landmarks[17], wrist, handScale);

  const extendedCount = (index ? 1 : 0) + (middle ? 1 : 0) + (ring ? 1 : 0) + (pinky ? 1 : 0);

  return {
    index,
    middle,
    ring,
    pinky,
    thumb,
    indexFolded,
    middleFolded,
    ringFolded,
    pinkyFolded,
    handScale,
    extendedCount,
  };
}

/**
 * Classifies raw gesture from finger analysis:
 * - Open palm (4+ fingers extended): erase (Erase)
 * - 2 Fingers (Index + Middle extended): cursor (Pointer)
 * - Closed Fist (0 fingers extended / all folded): pause (Hold)
 * - 1 Finger (Index extended): draw (Write)
 */
export function classifyGesture(fingers: Partial<FingerAnalysis>): GestureType {
  const {
    index = false,
    middle = false,
    ring = false,
    pinky = false,
    middleFolded = false,
    ringFolded = false,
    pinkyFolded = false,
  } = fingers;

  const extendedCount = fingers.extendedCount !== undefined
    ? fingers.extendedCount
    : (index ? 1 : 0) + (middle ? 1 : 0) + (ring ? 1 : 0) + (pinky ? 1 : 0);

  // 1. Open Palm -> Erase
  if (extendedCount >= 4 || (extendedCount === 3 && index && middle && !ringFolded && !pinkyFolded && pinky)) {
    return 'erase';
  }

  // 2. Two Fingers (Index + Middle) -> Pointer
  if (index && middle && !ring && !pinky) {
    return 'cursor';
  }

  // 3. Closed Fist -> Hold / Pause
  if (extendedCount === 0 || (!index && middleFolded && ringFolded && pinkyFolded)) {
    return 'pause';
  }

  // 4. Index Finger Extended -> Write
  if (index && !middle && !ring && !pinky) {
    return 'draw';
  }

  // Ergonomic tolerance for natural pointing grip
  if (index && middleFolded && ringFolded && !middle) {
    return 'draw';
  }

  return 'none';
}

/**
 * Computes palm center from key landmarks (MCP joints and wrist)
 */
export function calculatePalmCenter(landmarks: LandmarkPoint[]): LandmarkPoint {
  if (!landmarks || landmarks.length < 21) {
    return { x: 0.5, y: 0.5, z: 0 };
  }

  const p0 = landmarks[0];
  const p5 = landmarks[5];
  const p9 = landmarks[9];
  const p17 = landmarks[17];

  return {
    x: (p0.x + p5.x + p9.x + p17.x) / 4,
    y: (p0.y + p5.y + p9.y + p17.y) / 4,
    z: ((p0.z || 0) + (p5.z || 0) + (p9.z || 0) + (p17.z || 0)) / 4,
  };
}

/**
 * Stateful gesture stabilizer with temporal hysteresis and active-stroke grace period
 */
export class GestureStabilizer {
  private currentGesture: GestureType = 'none';
  private candidateGesture: GestureType = 'none';
  private candidateCount: number = 0;
  private graceFramesRemaining: number = 0;
  private thresholds: GestureThresholds;

  constructor(thresholds: GestureThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  public process(rawGesture: GestureType): GestureType {
    if (rawGesture === this.currentGesture) {
      this.candidateGesture = rawGesture;
      this.candidateCount = 0;
      this.graceFramesRemaining = this.thresholds.graceFrames;
      return this.currentGesture;
    }

    const isActivelyDrawing = this.currentGesture === 'draw' || this.currentGesture === 'erase';

    // Hold active Write/Erase stroke steady across momentary detection dropouts
    if (isActivelyDrawing && rawGesture === 'none') {
      if (this.graceFramesRemaining > 0) {
        this.graceFramesRemaining--;
        return this.currentGesture;
      }
      this.currentGesture = 'none';
      this.candidateGesture = 'none';
      this.candidateCount = 0;
      return 'none';
    }

    // Multi-frame debounce with asymmetric stroke exit protection
    if (rawGesture === this.candidateGesture) {
      this.candidateCount++;
      const requiredFrames = isActivelyDrawing
        ? Math.max(3, this.thresholds.debounceFrames + 1)
        : this.thresholds.debounceFrames;

      if (this.candidateCount >= requiredFrames) {
        this.currentGesture = rawGesture;
        this.candidateCount = 0;
        this.graceFramesRemaining = this.thresholds.graceFrames;
      }
    } else {
      this.candidateGesture = rawGesture;
      this.candidateCount = 1;
    }

    return this.currentGesture;
  }

  public getCurrent(): GestureType {
    return this.currentGesture;
  }

  public reset() {
    this.currentGesture = 'none';
    this.candidateGesture = 'none';
    this.candidateCount = 0;
    this.graceFramesRemaining = 0;
  }
}
