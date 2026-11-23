/**
 * AirCanvas type definitions
 */

export type GestureType =
  | 'draw'    // Index finger extended (Write)
  | 'erase'   // Open palm (Erase)
  | 'cursor'  // Two fingers extended (Pointer)
  | 'pause'   // Closed fist (Hold)
  | 'none';

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface FingerState {
  isExtended: boolean;
  distanceToWrist: number;
  distanceToMcp: number;
}

export interface HandDetectionResult {
  gesture: GestureType;
  confidence: number;
  indexTip: LandmarkPoint | null;
  palmCenter: LandmarkPoint | null;
  landmarks: LandmarkPoint[] | null;
  dominantHand: 'Left' | 'Right' | 'Unknown';
}

export type StrokeTool = 'pen' | 'eraser';

export interface StrokePoint {
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
  timestamp: number;
}

export interface Stroke {
  id: string;
  tool: StrokeTool;
  color: string;
  size: number;
  points: StrokePoint[];
}

export type GridStyle = 'dots' | 'grid' | 'blank' | 'blueprint' | 'ruled';

export interface CanvasSettings {
  gridStyle: GridStyle;
  smoothing: 'low' | 'medium' | 'high';
  eraserRadius: number;
  brushSize: number;
  brushColor: string;
  soundEnabled: boolean;
  showWebcamHUD: boolean;
  hudMode: 'card' | 'bubble' | 'hidden';
  webcamOpacity: number;
  mirrorTracking: boolean;
  autoConnectCamera: boolean;
  showGestureCoach: boolean;
  targetFps: 30 | 35 | 45 | 50;
  skeletonOnlyMode: boolean; // Hide camera video, trace hand only in clean area
}

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error' | 'unsupported';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'info' | 'success' | 'warning';
}
