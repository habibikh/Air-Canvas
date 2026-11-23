/**
 * Coordinate mapping, smoothing, and geometric utilities
 */

import { LandmarkPoint } from '../types';

export interface SmoothingConfig {
  minCutoff: number; // Minimum cutoff frequency in Hz (lower = smoother when slow/still)
  beta: number;      // Speed coefficient (higher = less lag during fast motion)
  dCutoff: number;   // Derivative cutoff frequency in Hz
}

/**
 * 1D One Euro Filter (Casiez et al., CHI 2012)
 * Eliminates micro-tremor when stationary while staying ultra-responsive at speed.
 */
export class OneEuroFilter1D {
  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  public filter(x: number, timestampMs: number, minCutoff: number, beta: number, dCutoff: number = 1.0): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = timestampMs;
      return x;
    }

    // Clamp dt to [1ms, 100ms] for numerical stability (e.g. synchronous test calls or tab switches)
    const rawDt = (timestampMs - this.tPrev) / 1000;
    const dt = rawDt > 0.0005 ? Math.min(0.1, rawDt) : 1 / 30;
    this.tPrev = timestampMs;

    const dx = (x - this.xPrev) / dt;
    const alphaD = this.smoothingFactor(dt, dCutoff);
    const edx = alphaD * dx + (1 - alphaD) * this.dxPrev;
    this.dxPrev = edx;

    const cutoff = minCutoff + beta * Math.abs(edx);
    const alpha = this.smoothingFactor(dt, cutoff);
    const xHat = alpha * x + (1 - alpha) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }

  private smoothingFactor(dt: number, cutoff: number): number {
    const r = 2 * Math.PI * cutoff * dt;
    return r / (r + 1);
  }

  public reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

export class PointFilter {
  private filterX = new OneEuroFilter1D();
  private filterY = new OneEuroFilter1D();
  private config: SmoothingConfig;

  constructor(smoothingLevel: 'low' | 'medium' | 'high' = 'medium') {
    this.config = this.getConfigForLevel(smoothingLevel);
  }

  public setLevel(level: 'low' | 'medium' | 'high') {
    this.config = this.getConfigForLevel(level);
  }

  private getConfigForLevel(level: 'low' | 'medium' | 'high'): SmoothingConfig {
    switch (level) {
      case 'low':
        return { minCutoff: 6.0, beta: 22.0, dCutoff: 2.5 }; // Ultra-fast raw speed
      case 'medium':
        return { minCutoff: 3.5, beta: 14.0, dCutoff: 2.0 }; // Crisp, lag-free writing with tremor damping
      case 'high':
        return { minCutoff: 2.0, beta: 7.5, dCutoff: 1.5 }; // Steady calligraphy stabilization
    }
  }

  public filter(rawX: number, rawY: number, timestampMs: number = performance.now()): { x: number; y: number } {
    const { minCutoff, beta, dCutoff } = this.config;
    return {
      x: this.filterX.filter(rawX, timestampMs, minCutoff, beta, dCutoff),
      y: this.filterY.filter(rawY, timestampMs, minCutoff, beta, dCutoff),
    };
  }

  public reset() {
    this.filterX.reset();
    this.filterY.reset();
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
