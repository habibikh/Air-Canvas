/**
 * High-Precision Hand Gesture Recognition Engine for AirCanvas
 * Robust 3D scale-invariant analysis for rock-solid detection across angles & tilts
 */

import { GestureType, HandDetectionResult, LandmarkPoint } from '../types';
import { euclideanDistance } from './coordinateMapping';

export interface GestureThresholds {
  fingerExtensionRatio: number; // Ratio between tip-wrist distance and pip-wrist distance
  fingerMcpRatio: number;       // Ratio between tip-mcp distance and pip-mcp distance
  debounceFrames: number;       // Frames required to confirm gesture transition
  graceFrames: number;          // Frames to hold active draw stroke through momentary tracking noise
}

export const DEFAULT_THRESHOLDS: GestureThresholds = {
  fingerExtensionRatio: 1.08,
  fingerMcpRatio: 1.15,
  debounceFrames: 2,
  graceFrames: 2,
};

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
}

/**
 * Calculates anatomically normalized hand scale (distance from wrist to middle MCP)
 */
export function calculateHandScale(landmarks: LandmarkPoint[]): number {
  if (!landmarks || landmarks.length < 21) return 0.2;
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const scale = euclideanDistance(wrist, middleMcp);
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
  const distTipWrist = euclideanDistance(tip, wrist);
  const distPipWrist = euclideanDistance(pip, wrist);

  const distTipMcp = euclideanDistance(tip, mcp);
  const distPipMcp = euclideanDistance(pip, mcp);
  const distDipMcp = euclideanDistance(dip, mcp);

  // 1. Tip is farther from wrist than PIP
  const wristExtended = distTipWrist > distPipWrist * thresholds.fingerExtensionRatio;

  // 2. Tip is farther from MCP than PIP is from MCP
  const mcpExtended = distTipMcp > distPipMcp * thresholds.fingerMcpRatio;

  // 3. Scale-normalized check: extended finger tip is typically > 0.65 * handScale from MCP
  const scaleExtended = distTipMcp > handScale * 0.62;

  // 4. Uncurled check: tip is farther or equal from MCP compared to DIP
  const uncurled = distTipMcp >= distDipMcp * 0.95;

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
  const distTipMcp = euclideanDistance(tip, mcp);
  const distTipWrist = euclideanDistance(tip, wrist);
  const distPipWrist = euclideanDistance(pip, wrist);
  const distPipMcp = euclideanDistance(pip, mcp);

  // Folded finger has tip close to palm/MCP or tucked inside PIP relative to wrist
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
  const distTipPinky = euclideanDistance(tip, pinkyMcp);
  const distIpPinky = euclideanDistance(ip, pinkyMcp);
  const distTipWrist = euclideanDistance(tip, wrist);
  const distMcpWrist = euclideanDistance(mcp, wrist);

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
  };
}

/**
 * Classifies raw gesture from finger analysis with human ergonomics tolerances
 */
export function classifyGesture(fingers: FingerAnalysis): GestureType {
  const { index, middle, ring, pinky, middleFolded, ringFolded, pinkyFolded } = fingers;

  // Count total extended fingers (excluding thumb)
  const extendedCount = (index ? 1 : 0) + (middle ? 1 : 0) + (ring ? 1 : 0) + (pinky ? 1 : 0);

  // Gesture B: Open Palm Eraser
  // 4 fingers extended, or 3 fingers extended including index & middle with fingers spread
  if (extendedCount >= 4 || (extendedCount === 3 && index && middle && !ringFolded && !pinkyFolded)) {
    return 'erase';
  }

  // Gesture C: Fist / Pause
  // All four fingers folded or 0 extended
  if (extendedCount === 0 || (!index && middleFolded && ringFolded && pinkyFolded)) {
    return 'pause';
  }

  // Gesture D: Two-Finger Cursor Mode
  // Index and middle extended, ring and pinky folded
  if (index && middle && !ring && !pinky) {
    return 'cursor';
  }

  // Gesture A: Writing / Drawing
  // Standard: Index extended, middle, ring, pinky folded
  if (index && !middle && !ring && !pinky) {
    return 'draw';
  }

  // Ergonomic tolerance for natural drawing grip:
  // When users point index, middle and ring are curled, but pinky may be slightly relaxed
  if (index && middleFolded && ringFolded && !middle) {
    return 'draw';
  }

  // Fallback for transition/unrecognized hand postures
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
    // 1. Same gesture: refresh candidate and maintain
    if (rawGesture === this.currentGesture) {
      this.candidateGesture = rawGesture;
      this.candidateCount = 0;
      this.graceFramesRemaining = this.thresholds.graceFrames;
      return this.currentGesture;
    }

    // 2. Active stroke grace period:
    // If we are currently in 'draw' or 'erase' mode and get a momentary 'none' or dropped frame,
    // hold the active gesture for graceFrames so drawing lines do not stutter or break!
    if ((this.currentGesture === 'draw' || this.currentGesture === 'erase') && rawGesture === 'none') {
      if (this.graceFramesRemaining > 0) {
        this.graceFramesRemaining--;
        return this.currentGesture;
      }
      // Grace period exhausted: release cleanly to 'none'
      this.currentGesture = 'none';
      this.candidateGesture = 'none';
      this.candidateCount = 0;
      return 'none';
    }

    // 3. Fast-path transition into 'pause'
    if (rawGesture === 'pause') {
      this.currentGesture = 'pause';
      this.candidateGesture = 'pause';
      this.candidateCount = 0;
      this.graceFramesRemaining = 0;
      return 'pause';
    }

    // 4. Multi-frame debounce for other transitions
    if (rawGesture === this.candidateGesture) {
      this.candidateCount++;
      const requiredFrames = this.thresholds.debounceFrames;

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
