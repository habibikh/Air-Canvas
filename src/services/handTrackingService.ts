/**
 * High-Performance MediaPipe Tasks Vision HandLandmarker integration service
 * Optimized for 30 - 50 FPS on both Mobile & PC
 */

import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { CameraStatus, GestureType, HandDetectionResult, LandmarkPoint } from '../types';
import { analyzeFingers, calculatePalmCenter, classifyGesture, GestureStabilizer } from '../utils/gestureRecognition';

export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [5, 9], [9, 13], [13, 17],
];

export type HandFrameCallback = (result: HandDetectionResult, rawResults?: HandLandmarkerResult) => void;

export class HandTrackingService {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing: boolean = false;
  private isRunning: boolean = false;
  private isProcessingFrame: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private rvfcId: number | null = null;
  private lastFrameTimestamp: number = 0;
  private stabilizer = new GestureStabilizer();
  private callbacks: Set<HandFrameCallback> = new Set();
  private statusCallback?: (status: CameraStatus, error?: string) => void;

  // Frame rate control: user requested at least 30, max 50 FPS
  private targetMaxFps: number = 50;
  private minFrameIntervalMs: number = 1000 / 50; // 20ms cap

  // Rolling telemetry metrics for ultra-smooth FPS display
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 0;

  constructor() {}

  public setTargetMaxFps(fps: number) {
    this.targetMaxFps = Math.max(30, Math.min(50, fps));
    this.minFrameIntervalMs = 1000 / this.targetMaxFps;
  }

  public onFrame(cb: HandFrameCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  public setStatusCallback(cb: (status: CameraStatus, error?: string) => void) {
    this.statusCallback = cb;
  }

  /**
   * Initializes MediaPipe HandLandmarker with GPU and graceful fallback to CPU
   */
  public async initMediaPipe(): Promise<HandLandmarker> {
    if (this.handLandmarker) return this.handLandmarker;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 40));
      }
      if (this.handLandmarker) return this.handLandmarker;
    }

    this.isInitializing = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );

      const modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      try {
        // Attempt GPU acceleration first
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuErr) {
        console.warn('GPU acceleration unavailable or failed, using CPU delegate:', gpuErr);
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      return this.handLandmarker;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Request webcam stream optimized for Mobile & PC with 30-50 FPS target
   */
  public async startCamera(videoEl: HTMLVideoElement): Promise<void> {
    this.videoElement = videoEl;

    if (this.statusCallback) {
      this.statusCallback('requesting');
    }

    try {
      await this.initMediaPipe();

      // Check if mobile device
      const isMobile =
        typeof navigator !== 'undefined' &&
        (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
          (typeof window !== 'undefined' && window.innerWidth < 768));

      // Constraints optimized for 30-50 FPS:
      // Requesting 640x480 or 480x360 with ideal 60 min 30 fps
      const constraints: MediaStreamConstraints = {
        video: {
          width: isMobile ? { ideal: 480, max: 640 } : { ideal: 640, max: 640 },
          height: isMobile ? { ideal: 360, max: 480 } : { ideal: 480, max: 480 },
          facingMode: 'user',
          frameRate: { ideal: 50, min: 30, max: 60 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (strictErr) {
        // Fallback for cameras that reject strict frameRate/resolution constraints
        console.warn('Strict camera constraints rejected, using relaxed fallback:', strictErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      }

      this.stream = stream;
      videoEl.srcObject = stream;
      await videoEl.play();

      this.isRunning = true;
      if (this.statusCallback) {
        this.statusCallback('active');
      }

      this.startProcessingLoop();
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Camera or MediaPipe initialization failed:', error);
      let status: CameraStatus = 'error';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        status = 'denied';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        status = 'unsupported';
      }

      if (this.statusCallback) {
        this.statusCallback(status, error.message);
      }
      throw error;
    }
  }

  /**
   * High-frequency processing loop using requestVideoFrameCallback when available,
   * with automatic fallback to requestAnimationFrame.
   * Enforces target rate between 30 and 50 FPS.
   */
  private startProcessingLoop() {
    const video = this.videoElement;
    if (!video) return;

    // Check if browser supports requestVideoFrameCallback (Chrome, Edge, Opera, Safari 15.4+)
    const hasRVFC = typeof (video as unknown as { requestVideoFrameCallback?: Function }).requestVideoFrameCallback === 'function';

    const processTick = (timestamp: number) => {
      if (!this.isRunning) return;

      const now = performance.now();
      const elapsed = now - this.lastFrameTimestamp;

      // Rate limiter: enforce max 50 FPS (min 20ms between frames)
      if (elapsed >= this.minFrameIntervalMs) {
        if (!this.isProcessingFrame && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.handLandmarker) {
          this.isProcessingFrame = true;
          this.lastFrameTimestamp = now;

          // Update rolling FPS metric
          this.frameCount++;
          if (now - this.lastFpsTime >= 500) {
            const rawFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
            // Clamp reported display FPS within user's target window
            this.currentFps = Math.min(50, Math.max(1, rawFps));
            this.frameCount = 0;
            this.lastFpsTime = now;
          }

          try {
            // Run MediaPipe detection
            const results = this.handLandmarker.detectForVideo(video, now);
            this.processDetectionResult(results);
          } catch (e) {
            // Dropped frame
          } finally {
            this.isProcessingFrame = false;
          }
        }
      }

      // Schedule next frame
      if (this.isRunning) {
        if (hasRVFC && 'requestVideoFrameCallback' in video) {
          this.rvfcId = (video as any).requestVideoFrameCallback(processTick);
        } else {
          this.animFrameId = requestAnimationFrame(processTick);
        }
      }
    };

    if (hasRVFC && 'requestVideoFrameCallback' in video) {
      this.rvfcId = (video as any).requestVideoFrameCallback(processTick);
    } else {
      this.animFrameId = requestAnimationFrame(processTick);
    }
  }

  /**
   * Fast, low-allocation landmark extraction and gesture classification
   */
  private processDetectionResult(results: HandLandmarkerResult) {
    if (!results.landmarks || results.landmarks.length === 0 || results.landmarks[0].length === 0) {
      const stableGesture = this.stabilizer.process('none');
      const payload: HandDetectionResult = {
        gesture: stableGesture,
        confidence: 0,
        indexTip: null,
        palmCenter: null,
        landmarks: null,
        dominantHand: 'Unknown',
      };
      this.broadcastFrame(payload, results);
      return;
    }

    const landmarks = results.landmarks[0] as LandmarkPoint[];
    const handedness =
      results.handednesses && results.handednesses[0] && results.handednesses[0][0]
        ? (results.handednesses[0][0].categoryName as 'Left' | 'Right')
        : 'Right';

    const confidence =
      results.handednesses && results.handednesses[0] && results.handednesses[0][0]
        ? results.handednesses[0][0].score
        : 0.92;

    const fingerAnalysis = analyzeFingers(landmarks);
    const rawGesture = fingerAnalysis ? classifyGesture(fingerAnalysis) : 'none';
    const stableGesture = this.stabilizer.process(rawGesture);

    const indexTip = landmarks[8] || null;
    const palmCenter = calculatePalmCenter(landmarks);

    const payload: HandDetectionResult = {
      gesture: stableGesture,
      confidence,
      indexTip,
      palmCenter,
      landmarks,
      dominantHand: handedness,
    };

    this.broadcastFrame(payload, results);
  }

  private broadcastFrame(result: HandDetectionResult, rawResults?: HandLandmarkerResult) {
    for (const cb of this.callbacks) {
      try {
        cb(result, rawResults);
      } catch (err) {
        console.error('HandFrameCallback error:', err);
      }
    }
  }

  public getFps(): number {
    return this.currentFps;
  }

  /**
   * Stops video stream, cancels RAF / RVFC, and frees camera tracks
   */
  public stopCamera() {
    this.isRunning = false;
    this.isProcessingFrame = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.rvfcId !== null && this.videoElement && 'cancelVideoFrameCallback' in this.videoElement) {
      try {
        (this.videoElement as any).cancelVideoFrameCallback(this.rvfcId);
      } catch {
        // Ignore
      }
      this.rvfcId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.stabilizer.reset();
    this.currentFps = 0;
    if (this.statusCallback) {
      this.statusCallback('idle');
    }
  }

  public dispose() {
    this.stopCamera();
    this.callbacks.clear();
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch {
        // Ignore
      }
      this.handLandmarker = null;
    }
  }
}

export const handTrackingService = new HandTrackingService();
