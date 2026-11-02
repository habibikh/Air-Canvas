/**
 * Coordinate mapping, smoothing, and geometric utilities
 */

import { LandmarkPoint } from '../types';

export interface SmoothingConfig {
  factor: number; // 0 to 1, higher = faster response, lower = smoother
}

export class PointFilter {
  private lastX: number | null = null;
  private lastY: number | null = null;
  private smoothingFactor: number;

  constructor(smoothingLevel: 'low' | 'medium' | 'high' = 'medium') {
    this.smoothingFactor = this.getFactorForLevel(smoothingLevel);
  }

  public setLevel(level: 'low' | 'medium' | 'high') {
    this.smoothingFactor = this.getFactorForLevel(level);
  }

  private getFactorForLevel(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low':
        return 0.75; // Snappier, less smoothing
      case 'medium':
        return 0.55; // Balanced
      case 'high':
        return 0.35; // Very smooth, slightly more drag
    }
  }

  public filter(rawX: number, rawY: number): { x: number; y: number } {
    if (this.lastX === null || this.lastY === null) {
      this.lastX = rawX;
      this.lastY = rawY;
      return { x: rawX, y: rawY };
    }

    // Adaptive smoothing: if distance is very large (e.g., fast flick), increase factor to catch up
    const dx = rawX - this.lastX;
    const dy = rawY - this.lastY;
    const dist = Math.hypot(dx, dy);

    // Boost responsiveness during fast movements
    const dynamicFactor = Math.min(1.0, this.smoothingFactor + Math.min(0.4, dist * 2.0));

    const smoothedX = this.lastX + dx * dynamicFactor;
    const smoothedY = this.lastY + dy * dynamicFactor;

    this.lastX = smoothedX;
    this.lastY = smoothedY;

    return { x: smoothedX, y: smoothedY };
  }

  public reset() {
    this.lastX = null;
    this.lastY = null;
  }
}

/**
 * Maps a MediaPipe normalized landmark point to mirrored canvas coordinates
 */
export function mapLandmarkToCanvas(
  point: LandmarkPoint,
  canvasWidth: number,
  canvasHeight: number,
  mirror: boolean = true
): { x: number; y: number; normX: number; normY: number } {
  // Mirroring horizontally so moving hand right moves cursor right
  const normX = mirror ? Math.max(0, Math.min(1, 1 - point.x)) : Math.max(0, Math.min(1, point.x));
  const normY = Math.max(0, Math.min(1, point.y));

  return {
    x: normX * canvasWidth,
    y: normY * canvasHeight,
    normX,
    normY,
  };
}

/**
 * Calculate Euclidean distance between two points
 */
export function euclideanDistance(p1: LandmarkPoint, p2: LandmarkPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate midpoint between two 2D points
 */
export function getMidpoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}
