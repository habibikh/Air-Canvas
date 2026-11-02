/**
 * High-Performance MediaPipe Tasks Vision HandLandmarker integration service
 * Smooth 30 - 35 FPS tracking without main thread starvation
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
  private isSimulating: boolean = false;
  private simTimer: number | null = null;
  private simAngle: number = 0;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private rvfcId: number | null = null;
  private lastFrameTimestamp: number = 0;
  private lastInferenceTimestamp: number = 0;
  private stabilizer = new GestureStabilizer();
  private callbacks: Set<HandFrameCallback> = new Set();
  private statusCallback?: (status: CameraStatus, error?: string) => void;

  // Frame rate control: 30 - 35 FPS ideal for stable computer vision without lagging UI thread
  private targetMaxFps: number = 35;
  private minFrameIntervalMs: number = 1000 / 35; // ~28.5ms

  // Rolling telemetry metrics
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 0;

  constructor() {}

  public setTargetMaxFps(fps: number) {
    this.targetMaxFps = Math.max(25, Math.min(45, fps));
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
          minHandDetectionConfidence: 0.38,
          minHandPresenceConfidence: 0.38,
          minTrackingConfidence: 0.38,
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
          minHandDetectionConfidence: 0.38,
          minHandPresenceConfidence: 0.38,
          minTrackingConfidence: 0.38,
        });
      }

      return this.handLandmarker;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Request webcam stream with graceful fallback
   */
  public async startCamera(videoEl: HTMLVideoElement): Promise<void> {
    // If simulation was running, stop it
    this.stopSimulation();

    // Clean up any existing stream first
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

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

      // Constraints optimized for 30 FPS without camera hardware stalls
      const constraints: MediaStreamConstraints = {
        video: {
          width: isMobile ? { ideal: 480, max: 640 } : { ideal: 640, max: 640 },
          height: isMobile ? { ideal: 360, max: 480 } : { ideal: 480, max: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 45 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (strictErr) {
        // Fallback for cameras that reject specific constraint objects
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
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
   * Smooth processing loop with rate limiter and monotonic timestamps
   */
  private startProcessingLoop() {
    const video = this.videoElement;
    if (!video) return;

    const hasRVFC = typeof (video as unknown as { requestVideoFrameCallback?: Function }).requestVideoFrameCallback === 'function';

    const processTick = () => {
      if (!this.isRunning) return;

      const now = performance.now();
      const elapsed = now - this.lastFrameTimestamp;

      // Rate limiter: ensure max 35 FPS to avoid UI lagging
      if (elapsed >= this.minFrameIntervalMs) {
        if (!this.isProcessingFrame && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.handLandmarker) {
          this.isProcessingFrame = true;
          this.lastFrameTimestamp = now;

          // Rolling FPS metric
          this.frameCount++;
          if (now - this.lastFpsTime >= 500) {
            const rawFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
            this.currentFps = Math.min(35, Math.max(1, rawFps));
            this.frameCount = 0;
            this.lastFpsTime = now;
          }

          try {
            // Strictly monotonic timestamp for MediaPipe Tasks Vision
            const timestamp = Math.max(now, this.lastInferenceTimestamp + 1);
            this.lastInferenceTimestamp = timestamp;

            const results = this.handLandmarker.detectForVideo(video, timestamp);
            this.processDetectionResult(results);
          } catch (e) {
            // Frame dropped or skipped
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
    return this.isSimulating ? 30 : this.currentFps;
  }

  /**
   * Interactive Virtual Hand Simulator
   * Allows testing index finger drawing and palm erasing without physical camera
   */
  public startDemoSimulation() {
    this.stopCamera();
    this.isSimulating = true;
    this.simAngle = 0;

    if (this.statusCallback) {
      this.statusCallback('active');
    }

    const simLoop = () => {
      if (!this.isSimulating) return;

      this.simAngle += 0.035;
      const angle = this.simAngle;

      // Figure-8 parametric trajectory
      const centerX = 0.5 + Math.sin(angle) * 0.22;
      const centerY = 0.45 + (Math.sin(angle * 2) * 0.16);

      // Periodically switch between draw (index) and erase (palm)
      const cycle = Math.floor(angle / (Math.PI * 2)) % 4;
      const gesture: GestureType = cycle === 3 ? 'erase' : 'draw';

      // Construct synthetic 21-point hand skeleton centered on target
      const landmarks: LandmarkPoint[] = [];
      for (let i = 0; i < 21; i++) {
        const offsetX = ((i % 5) - 2) * 0.015;
        const offsetY = (Math.floor(i / 5) - 2) * 0.02;
        landmarks.push({
          x: Math.max(0.1, Math.min(0.9, centerX + offsetX)),
          y: Math.max(0.1, Math.min(0.9, centerY + offsetY)),
          z: 0,
        });
      }

      const indexTip: LandmarkPoint = { x: centerX, y: centerY, z: 0 };
      const palmCenter: LandmarkPoint = { x: centerX, y: centerY + 0.05, z: 0 };

      const payload: HandDetectionResult = {
        gesture,
        confidence: 0.95,
        indexTip,
        palmCenter,
        landmarks,
        dominantHand: 'Right',
      };

      this.broadcastFrame(payload);
      this.simTimer = window.setTimeout(simLoop, 33);
    };

    simLoop();
  }

  public stopSimulation() {
    this.isSimulating = false;
    if (this.simTimer !== null) {
      clearTimeout(this.simTimer);
      this.simTimer = null;
    }
  }

  public isSimulationMode(): boolean {
    return this.isSimulating;
  }

  /**
   * Stops video stream, cancels RAF / RVFC, and frees camera tracks
   */
  public stopCamera() {
    this.stopSimulation();
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
