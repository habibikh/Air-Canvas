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
  startCamera: (videoElement: HTMLVideoElement) => Promise<void>;
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

  const lastGestureRef = useRef<GestureType>('none');
  const lastMetricsUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Register status listener
    handTrackingService.setStatusCallback((status, err) => {
      setCameraStatus(status);
      setErrorMessage(err || null);
    });

    // Frame listener for state syncing (throttled to avoid 60fps React re-renders)
    const unsubscribe = handTrackingService.onFrame((result) => {
      const hasHand = result.landmarks !== null;
      const gesture = result.gesture;

      // Update gesture immediately if changed
      if (gesture !== lastGestureRef.current) {
        lastGestureRef.current = gesture;
        setCurrentGesture(gesture);
      }

      // Throttle metric updates to 10 FPS (100ms) for UI stability
      const now = performance.now();
      if (now - lastMetricsUpdateRef.current > 100) {
        lastMetricsUpdateRef.current = now;
        setIsHandDetected(hasHand);
        setConfidence(result.confidence);
        setDominantHand(result.dominantHand);
        setFps(handTrackingService.getFps());
      }
    });

    return () => {
      unsubscribe();
      handTrackingService.stopCamera();
    };
  }, []);

  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    setErrorMessage(null);
    try {
      await handTrackingService.startCamera(videoElement);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Unable to access camera.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    handTrackingService.stopCamera();
    setCurrentGesture('none');
    setIsHandDetected(false);
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
    startCamera,
    stopCamera,
    registerFrameListener,
  };
}
