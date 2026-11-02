/**
 * Hand gesture recognition engine for AirCanvas
 */

import { GestureType, HandDetectionResult, LandmarkPoint } from '../types';
import { euclideanDistance } from './coordinateMapping';

export interface GestureThresholds {
  fingerExtensionRatio: number; // Ratio between tip-wrist distance and pip-wrist distance
  fingerMcpRatio: number;       // Ratio between tip-mcp distance and pip-mcp distance
  debounceFrames: number;       // Frames required to confirm gesture transition
}

export const DEFAULT_THRESHOLDS: GestureThresholds = {
  fingerExtensionRatio: 1.15,
  fingerMcpRatio: 1.20,
  debounceFrames: 2,
};

export interface FingerAnalysis {
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  thumb: boolean;
}

/**
 * Checks if a non-thumb finger is extended based on joint distances
 */
export function isFingerExtended(
  tip: LandmarkPoint,
  dip: LandmarkPoint,
  pip: LandmarkPoint,
  mcp: LandmarkPoint,
  wrist: LandmarkPoint,
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS
): boolean {
  const distTipWrist = euclideanDistance(tip, wrist);
  const distPipWrist = euclideanDistance(pip, wrist);

  const distTipMcp = euclideanDistance(tip, mcp);
  const distPipMcp = euclideanDistance(pip, mcp);

  // Extended finger has tip farther from wrist and MCP than PIP
  const wristExtended = distTipWrist > distPipWrist * thresholds.fingerExtensionRatio;
  const mcpExtended = distTipMcp > distPipMcp * thresholds.fingerMcpRatio;

  // Also check that tip is farther from MCP than DIP is from MCP
  const distDipMcp = euclideanDistance(dip, mcp);
  const uncurled = distTipMcp >= distDipMcp;

  return (wristExtended && mcpExtended) || (wristExtended && uncurled);
}

/**
 * Checks if thumb is extended away from palm
 */
export function isThumbExtended(
  tip: LandmarkPoint,
  ip: LandmarkPoint,
  mcp: LandmarkPoint,
  wrist: LandmarkPoint,
  pinkyMcp: LandmarkPoint
): boolean {
  const distTipPinky = euclideanDistance(tip, pinkyMcp);
  const distIpPinky = euclideanDistance(ip, pinkyMcp);
  const distTipWrist = euclideanDistance(tip, wrist);
  const distMcpWrist = euclideanDistance(mcp, wrist);

  return distTipPinky > distIpPinky * 1.05 && distTipWrist > distMcpWrist * 1.05;
}

/**
 * Analyzes state of all five fingers
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

  const thumb = isThumbExtended(landmarks[4], landmarks[3], landmarks[2], wrist, pinkyMcp);
  const index = isFingerExtended(landmarks[8], landmarks[7], landmarks[6], landmarks[5], wrist, thresholds);
  const middle = isFingerExtended(landmarks[12], landmarks[11], landmarks[10], landmarks[9], wrist, thresholds);
  const ring = isFingerExtended(landmarks[16], landmarks[15], landmarks[14], landmarks[13], wrist, thresholds);
  const pinky = isFingerExtended(landmarks[20], landmarks[19], landmarks[18], landmarks[17], wrist, thresholds);

  return { index, middle, ring, pinky, thumb };
}

/**
 * Classifies raw gesture from finger analysis
 */
export function classifyGesture(fingers: FingerAnalysis): GestureType {
  const { index, middle, ring, pinky, thumb } = fingers;

  // Gesture B: Open Palm Eraser
  // Index, middle, ring, and pinky are all extended (open palm)
  if (index && middle && ring && pinky) {
    return 'erase';
  }

  // Gesture C: Fist / Pause
  // All four fingers folded
  if (!index && !middle && !ring && !pinky) {
    return 'pause';
  }

  // Gesture A: Writing / Drawing
  // Index extended, middle, ring, pinky folded. Thumb position does not interfere.
  if (index && !middle && !ring && !pinky) {
    return 'draw';
  }

  // Gesture D: Two-Finger Cursor Mode
  // Index and middle extended, ring and pinky folded
  if (index && middle && !ring && !pinky) {
    return 'cursor';
  }

  // Fallback for partially folded/unrecognized gesture
  return 'none';
}

/**
 * Computes palm center from key landmarks (MCP joints and wrist)
 */
export function calculatePalmCenter(landmarks: LandmarkPoint[]): LandmarkPoint {
  if (!landmarks || landmarks.length < 21) {
    return { x: 0.5, y: 0.5, z: 0 };
  }

  // Palm center approximation: average of wrist (0), index MCP (5), and pinky MCP (17)
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
 * Stateful gesture stabilizer with temporal hysteresis / debouncing
 */
export class GestureStabilizer {
  private currentGesture: GestureType = 'none';
  private candidateGesture: GestureType = 'none';
  private candidateCount: number = 0;
  private thresholds: GestureThresholds;

  constructor(thresholds: GestureThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  public process(rawGesture: GestureType): GestureType {
    if (rawGesture === this.currentGesture) {
      this.candidateGesture = rawGesture;
      this.candidateCount = 0;
      return this.currentGesture;
    }

    if (rawGesture === this.candidateGesture) {
      this.candidateCount++;
      // Immediate switch for high-intent gestures like 'pause' or if count reaches debounce threshold
      const requiredFrames = rawGesture === 'pause' ? 1 : this.thresholds.debounceFrames;

      if (this.candidateCount >= requiredFrames) {
        this.currentGesture = rawGesture;
        this.candidateCount = 0;
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
  }
}
