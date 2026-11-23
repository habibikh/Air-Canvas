/**
 * High-Performance MediaPipe Tasks Vision HandLandmarker integration service
 * Lazy-loaded for instant initial page boot, smooth 30-35 FPS tracking without main thread lag.
 */

import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { CameraStatus, GestureType, HandDetectionResult, LandmarkPoint } from '../types';
import {
  analyzeFingers,
  calculatePalmCenter,
  classifyGesture,
  GestureStabilizer,
  LandmarkSmoother,
} from '../utils/gestureRecognition';

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
  private initPromise: Promise<HandLandmarker> | null = null;
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
  private lastHandSeenTimestamp: number = 0;
  private stabilizer = new GestureStabilizer();
  private landmarkSmoother = new LandmarkSmoother();
  private callbacks: Set<HandFrameCallback> = new Set();
  private statusCallback?: (status: CameraStatus, error?: string) => void;

  // Reusable downscaled canvas so HD webcams (720p/1080p) never stall MediaPipe inference
  private inferenceCanvas: HTMLCanvasElement | null = null;
  private inferenceCtx: CanvasRenderingContext2D | null = null;

  private targetMaxFps: number = 45;
  private minFrameIntervalMs: number = 1000 / 45;

  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 0;

  constructor() {}

  public setTargetMaxFps(fps: number) {
    this.targetMaxFps = Math.max(24, Math.min(60, fps));
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
   * Warm up the MediaPipe JS chunk in the background without blocking initial UI paint
   */
  public preloadModule(): void {
    void import('@mediapipe/tasks-vision').catch(() => {});
  }

  /**
   * Initializes MediaPipe HandLandmarker lazily with GPU and graceful fallback to CPU
   */
  public async initMediaPipe(): Promise<HandLandmarker> {
    if (this.handLandmarker) return this.handLandmarker;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm'
        );

        const modelAssetPath =
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

        try {
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.48,
            minHandPresenceConfidence: 0.48,
            minTrackingConfidence: 0.48,
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
            minHandDetectionConfidence: 0.48,
            minHandPresenceConfidence: 0.48,
            minTrackingConfidence: 0.48,
          });
        }

        return this.handLandmarker;
      } catch (err) {
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Request webcam stream with graceful fallback
   */
  public async startCamera(videoEl: HTMLVideoElement): Promise<void> {
    this.stopSimulation();

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    this.videoElement = videoEl;

    if (this.statusCallback) {
      this.statusCallback('requesting');
    }

    try {
      // Request lightweight camera stream (ideal only — avoid strict max that forces 1080p fallback)
      const mediaPromise = (async () => {
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 480 },
            height: { ideal: 360 },
            facingMode: 'user',
            frameRate: { ideal: 30 },
          },
          audio: false,
        };

        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (strictErr: any) {
          if (
            strictErr?.name === 'NotAllowedError' ||
            strictErr?.name === 'PermissionDeniedError' ||
            strictErr?.message?.toLowerCase().includes('permission') ||
            strictErr?.message?.toLowerCase().includes('not allowed')
          ) {
            throw strictErr;
          }
          return await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      })();

      const [, stream] = await Promise.all([this.initMediaPipe(), mediaPromise]);

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
      const errorName = error?.name || '';
      const errorMsg = error?.message || '';

      const isPermissionDenied =
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError' ||
        errorMsg.toLowerCase().includes('permission denied') ||
        errorMsg.toLowerCase().includes('permission') ||
        errorMsg.toLowerCase().includes('not allowed');

      const isNotFound =
        errorName === 'NotFoundError' ||
        errorName === 'DevicesNotFoundError' ||
        errorMsg.toLowerCase().includes('not found') ||
        errorMsg.toLowerCase().includes('device');

      let status: CameraStatus = 'error';
      if (isPermissionDenied) {
        status = 'denied';
      } else if (isNotFound) {
        status = 'unsupported';
      } else {
        console.error('HandLandmarker or camera stream error:', error);
      }

      if (this.statusCallback) {
        this.statusCallback(
          status,
          isPermissionDenied ? 'Camera permission denied' : error.message
        );
      }
      throw error;
    }
  }

  /**
   * Returns video directly if already <= 480px wide, or downscales HD streams
   * onto a lightweight 320px canvas so MediaPipe stays fast and lag-free.
   */
  private getInferenceSource(video: HTMLVideoElement): HTMLVideoElement | HTMLCanvasElement {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || vw <= 480) {
      return video;
    }

    const targetW = 320;
    const targetH = Math.max(180, Math.round((vh * targetW) / vw));

    if (!this.inferenceCanvas) {
      this.inferenceCanvas = document.createElement('canvas');
      this.inferenceCtx = this.inferenceCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
    }

    if (this.inferenceCanvas.width !== targetW || this.inferenceCanvas.height !== targetH) {
      this.inferenceCanvas.width = targetW;
      this.inferenceCanvas.height = targetH;
    }

    if (this.inferenceCtx) {
      this.inferenceCtx.drawImage(video, 0, 0, targetW, targetH);
      return this.inferenceCanvas;
    }

    return video;
  }

  /**
   * Smooth processing loop synchronized to camera frames without half-FPS boundary drops
   */
  private startProcessingLoop() {
    const video = this.videoElement;
    if (!video) return;

    const hasRVFC = typeof (video as unknown as { requestVideoFrameCallback?: Function }).requestVideoFrameCallback === 'function';
    let smoothedInferenceMs = 10;

    const processTick = () => {
      if (!this.isRunning) return;

      const now = performance.now();
      const elapsed = now - this.lastFrameTimestamp;
      // 3ms jitter tolerance ensures 30Hz camera frames (~31-35ms) aren't skipped
      const minInterval = Math.max(0, this.minFrameIntervalMs - 3);
      const adaptiveInterval = smoothedInferenceMs > 26
        ? Math.max(minInterval, smoothedInferenceMs * 1.1)
        : minInterval;

      if (elapsed >= adaptiveInterval) {
        if (!this.isProcessingFrame && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.handLandmarker) {
          this.isProcessingFrame = true;
          this.lastFrameTimestamp = now;

          this.frameCount++;
          if (now - this.lastFpsTime >= 500) {
            const rawFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
            this.currentFps = Math.min(60, Math.max(1, rawFps));
            this.frameCount = 0;
            this.lastFpsTime = now;
          }

          try {
            const timestamp = Math.max(now, this.lastInferenceTimestamp + 1);
            this.lastInferenceTimestamp = timestamp;

            const tStart = performance.now();
            const source = this.getInferenceSource(video);
            const results = this.handLandmarker.detectForVideo(source, timestamp);
            const duration = performance.now() - tStart;
            smoothedInferenceMs = smoothedInferenceMs * 0.8 + duration * 0.2;

            this.processDetectionResult(results);
          } catch {
            // Frame dropped or skipped
          } finally {
            this.isProcessingFrame = false;
          }
        }
      }

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
   * Fast, temporally smoothed landmark extraction and 4-gesture classification
   */
  private processDetectionResult(results: HandLandmarkerResult) {
    const now = performance.now();

    if (!results.landmarks || results.landmarks.length === 0 || results.landmarks[0].length === 0) {
      if (now - this.lastHandSeenTimestamp > 260) {
        this.landmarkSmoother.reset();
      }
      const stableGesture = this.stabilizer.process('none');
      this.broadcastFrame(
        {
          gesture: stableGesture,
          confidence: 0,
          indexTip: null,
          palmCenter: null,
          landmarks: null,
          dominantHand: 'Unknown',
        },
        results
      );
      return;
    }

    this.lastHandSeenTimestamp = now;
    const rawLandmarks = results.landmarks[0] as LandmarkPoint[];
    const landmarks = this.landmarkSmoother.smooth(rawLandmarks);

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

    this.broadcastFrame(
      {
        gesture: stableGesture,
        confidence,
        indexTip: landmarks[8] || null,
        palmCenter: calculatePalmCenter(landmarks),
        landmarks,
        dominantHand: handedness,
      },
      results
    );
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
   * Interactive Virtual Hand Simulator cycling through Write, Pointer, Hold, and Erase
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

      const centerX = 0.5 + Math.sin(angle) * 0.22;
      const centerY = 0.45 + Math.sin(angle * 2) * 0.16;

      // Cycle cleanly through the 4 core gestures: Write -> Pointer -> Hold -> Erase
      const cycle = Math.floor(angle / (Math.PI * 2)) % 4;
      let gesture: GestureType = 'draw';
      if (cycle === 1) gesture = 'cursor';
      else if (cycle === 2) gesture = 'pause';
      else if (cycle === 3) gesture = 'erase';

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

      this.broadcastFrame({
        gesture,
        confidence: 0.95,
        indexTip: { x: centerX, y: centerY, z: 0 },
        palmCenter: { x: centerX, y: centerY + 0.05, z: 0 },
        landmarks,
        dominantHand: 'Right',
      });

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
    this.landmarkSmoother.reset();
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
