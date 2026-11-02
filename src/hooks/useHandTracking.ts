/**
 * Reusable hook for webcam and MediaPipe hand tracking lifecycle
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraStatus, GestureType, HandDetectionResult } from '../types';
import { handTrackingService, HandFrameCallback } from '../services/handTrackingService';

export interface UseHandTrackingReturn {
  cameraStatus: CameraStatus;
  errorMessage: string | null;
  currentGesture: GestureType;
  confidence: number;
  fps: number;
  isHandDetected: boolean;
  dominantHand: 'Left' | 'Right' | 'Unknown';
  isSimulationMode: boolean;
  startCamera: (videoElement: HTMLVideoElement) => Promise<{ success: boolean; error?: string; isDenied?: boolean }>;
  startDemoSimulation: () => void;
  stopCamera: () => void;
  registerFrameListener: (cb: HandFrameCallback) => () => void;
}

export function useHandTracking(): UseHandTrackingReturn {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentGesture, setCurrentGesture] = useState<GestureType>('none');
  const [confidence, setConfidence] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [isHandDetected, setIsHandDetected] = useState<boolean>(false);
  const [dominantHand, setDominantHand] = useState<'Left' | 'Right' | 'Unknown'>('Unknown');
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);

  const lastGestureRef = useRef<GestureType>('none');
  const lastMetricsUpdateRef = useRef<number>(0);
  const lastHasHandRef = useRef<boolean>(false);

  useEffect(() => {
    // Register status listener
    handTrackingService.setStatusCallback((status, err) => {
      setCameraStatus(status);
      setErrorMessage(err || null);
      setIsSimulationMode(handTrackingService.isSimulationMode());
    });

    // Frame listener for state syncing (throttled to avoid React re-renders)
    const unsubscribe = handTrackingService.onFrame((result) => {
      const hasHand = result.landmarks !== null && result.landmarks.length > 0;
      const gesture = result.gesture;

      // Update gesture when changed
      if (gesture !== lastGestureRef.current) {
        lastGestureRef.current = gesture;
        setCurrentGesture(gesture);
      }

      // Only update hand presence boolean when changed
      if (hasHand !== lastHasHandRef.current) {
        lastHasHandRef.current = hasHand;
        setIsHandDetected(hasHand);
      }

      // Throttle telemetry metric updates (FPS, confidence, dominantHand) to 1000ms for high performance
      const now = performance.now();
      if (now - lastMetricsUpdateRef.current > 1000) {
        lastMetricsUpdateRef.current = now;
        setConfidence(result.confidence);
        setDominantHand(result.dominantHand);
        setFps(handTrackingService.getFps());
        setIsSimulationMode(handTrackingService.isSimulationMode());
      }
    });

    return () => {
      unsubscribe();
      handTrackingService.stopCamera();
    };
  }, []);

  const startCamera = useCallback(async (videoElement: HTMLVideoElement): Promise<{ success: boolean; error?: string; isDenied?: boolean }> => {
    setErrorMessage(null);
    try {
      await handTrackingService.startCamera(videoElement);
      setIsSimulationMode(false);
      return { success: true };
    } catch (err: unknown) {
      const error = err as Error;
      const name = error?.name || '';
      const msg = error?.message || 'Unable to access camera.';
      const isDenied =
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('not allowed');

      const friendlyMsg = isDenied
        ? 'Camera permission denied. Allow access in your browser address bar to use gestures.'
        : msg;

      setErrorMessage(friendlyMsg);
      return { success: false, error: friendlyMsg, isDenied };
    }
  }, []);

  const startDemoSimulation = useCallback(() => {
    handTrackingService.startDemoSimulation();
    setIsSimulationMode(true);
    setCurrentGesture('draw');
    setIsHandDetected(true);
  }, []);

  const stopCamera = useCallback(() => {
    handTrackingService.stopCamera();
    setCurrentGesture('none');
    setIsHandDetected(false);
    setIsSimulationMode(false);
  }, []);

  const registerFrameListener = useCallback((cb: HandFrameCallback) => {
    return handTrackingService.onFrame(cb);
  }, []);

  return {
    cameraStatus,
    errorMessage,
    currentGesture,
    confidence,
    fps,
    isHandDetected,
    dominantHand,
    isSimulationMode,
    startCamera,
    startDemoSimulation,
    stopCamera,
    registerFrameListener,
  };
}
