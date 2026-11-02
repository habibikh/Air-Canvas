/**
 * AirCanvas type definitions
 */

export type GestureType = 'draw' | 'erase' | 'pause' | 'cursor' | 'none';

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

export type StrokeTool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'rectangle' | 'circle';

export interface StrokePoint {
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
  pressure?: number;
  timestamp: number;
}

export interface Stroke {
  id: string;
  tool: StrokeTool;
  color: string;
  size: number; // size in normalized or base pixels
  points: StrokePoint[];
  opacity?: number;
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
  showCursorTrail: boolean;
  targetFps: 30 | 35 | 45 | 50;
  skeletonOnlyMode: boolean; // Hide camera video, trace hand only in blank/clean area
}

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error' | 'unsupported';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'info' | 'success' | 'warning';
}

export interface StickyNote {
  id: string;
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
  width: number;
  height: number;
  color: string;
  text: string;
}
