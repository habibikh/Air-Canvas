import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Activity,
  Hand,
  Sparkles,
  EyeOff,
  Eye,
  Circle,
  Layout,
  Scan,
} from 'lucide-react';
import { CameraStatus, GestureType, HandDetectionResult, LandmarkPoint } from '../types';
import { HAND_CONNECTIONS, HandFrameCallback } from '../services/handTrackingService';

interface WebcamPreviewProps {
  cameraStatus: CameraStatus;
  currentGesture: GestureType;
  fps: number;
  confidence: number;
  isHandDetected: boolean;
  dominantHand: string;
  skeletonOnlyMode: boolean;
  onToggleCamera: () => void;
  onToggleSkeletonOnly: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  registerFrameListener: (cb: HandFrameCallback) => () => void;
}

export const WebcamPreview: React.FC<WebcamPreviewProps> = ({
  cameraStatus,
  currentGesture,
  fps,
  confidence,
  isHandDetected,
  dominantHand,
  skeletonOnlyMode,
  onToggleCamera,
  onToggleSkeletonOnly,
  videoRef,
  registerFrameListener,
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'bubble' | 'hidden'>('card');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw real-time hand skeleton overlay directly on video canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const unsubscribe = registerFrameListener((result) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!result.landmarks || result.landmarks.length === 0) {
        return;
      }

      const landmarks = result.landmarks;
      const w = canvas.width;
      const h = canvas.height;

      ctx.save();

      // 1. Draw skeleton connections
      // In skeleton-only mode, render slightly brighter and thicker for higher contrast
      ctx.strokeStyle = skeletonOnlyMode ? 'rgba(34, 211, 238, 0.85)' : 'rgba(6, 182, 212, 0.65)';
      ctx.lineWidth = skeletonOnlyMode ? 2.5 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
          ctx.stroke();
        }
      }

      // 2. Draw joint landmarks
      for (let i = 0; i < landmarks.length; i++) {
        const pt = landmarks[i];
        const isTip = [4, 8, 12, 16, 20].includes(i);
        const isIndexTip = i === 8;

        ctx.beginPath();
        const radius = isIndexTip ? 5.5 : isTip ? 4 : 2.75;
        ctx.arc(pt.x * w, pt.y * h, radius, 0, Math.PI * 2);

        if (isIndexTip) {
          ctx.fillStyle = result.gesture === 'draw' ? '#4f46e5' : '#06b6d4';
          ctx.fill();
          // Concentric highlight ring
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 8, 0, Math.PI * 2);
          ctx.strokeStyle = result.gesture === 'draw' ? 'rgba(99, 102, 241, 0.8)' : 'rgba(34, 211, 238, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = skeletonOnlyMode ? '#38bdf8' : '#38bdf8';
          ctx.fill();
        }
      }

      // 3. Highlight palm center if in erase mode
      if (result.gesture === 'erase' && result.palmCenter) {
        const pc = result.palmCenter;
        ctx.beginPath();
        ctx.arc(pc.x * w, pc.y * h, 18, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      ctx.restore();
    });

    return () => {
      unsubscribe();
    };
  }, [registerFrameListener, viewMode, skeletonOnlyMode]);

  const getGestureBorder = () => {
    switch (currentGesture) {
      case 'draw':
        return 'border-indigo-500 shadow-indigo-500/30';
      case 'erase':
        return 'border-rose-500 shadow-rose-500/30';
      case 'cursor':
        return 'border-cyan-400 shadow-cyan-400/30';
      case 'pause':
        return 'border-amber-400 shadow-amber-400/30';
      default:
        return 'border-slate-300 shadow-black/10';
    }
  };

  // Hidden Mode: small restore button
  if (viewMode === 'hidden') {
    return (
      <div className="absolute top-16 sm:top-20 right-2 sm:right-4 z-30 pointer-events-auto">
        <button
          onClick={() => setViewMode('card')}
          className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 shadow-md transition-all"
          title="Show Vision HUD"
        >
          <Camera className="w-3.5 h-3.5 text-emerald-600" />
          <span>Show Vision HUD</span>
        </button>
      </div>
    );
  }

  // Bubble Mode: sleek circular HUD
  if (viewMode === 'bubble') {
    return (
      <div className="absolute top-16 sm:top-20 right-2 sm:right-4 z-30 pointer-events-auto flex flex-col items-end gap-1.5 animate-fade-in">
        <div
          onClick={() => setViewMode('card')}
          className={`relative w-20 h-20 rounded-full overflow-hidden border-2 shadow-xl cursor-pointer transition-transform hover:scale-105 bg-slate-950 ${getGestureBorder()}`}
          title="Click to expand Vision HUD"
        >
          {/* Mirrored webcam feed (hidden if skeletonOnlyMode is enabled) */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
              cameraStatus === 'active' && !skeletonOnlyMode ? 'opacity-90' : 'opacity-0'
            }`}
          />
          {/* Real-time skeleton canvas */}
          <canvas
            ref={canvasRef}
            width={120}
            height={120}
            className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
          />
          {cameraStatus !== 'active' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white">
              <CameraOff className="w-5 h-5 text-slate-400" />
            </div>
          )}

          {/* Tiny FPS badge */}
          {cameraStatus === 'active' && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-black/70 text-[9px] font-mono text-white whitespace-nowrap">
              {fps} fps
            </div>
          )}
        </div>

        <button
          onClick={() => setViewMode('card')}
          className="text-[10px] text-slate-500 hover:text-slate-800 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200"
        >
          Expand HUD
        </button>
      </div>
    );
  }

  // Card Mode (Default): rich telemetry and full skeleton preview
  return (
    <div className="absolute top-16 sm:top-20 right-2 sm:right-4 z-30 pointer-events-auto">
      <div className="glass-panel overflow-hidden rounded-2xl shadow-xl w-52 sm:w-72 transition-all duration-200">
        {/* HUD Top Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-white/70 border-b border-slate-200/80">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cameraStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700">Air Vision HUD</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Toggle Skeleton Only (Hide Video in blank area) */}
            <button
              onClick={onToggleSkeletonOnly}
              className={`p-1 rounded text-xs transition-colors flex items-center gap-1 ${
                skeletonOnlyMode
                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title={skeletonOnlyMode ? 'Show camera video' : 'Hide camera (Trace hand only in blank area)'}
              aria-label="Hide camera video, trace hand only"
            >
              {skeletonOnlyMode ? <Eye className="w-3.5 h-3.5 text-indigo-600" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            {/* Switch to Bubble mode */}
            <button
              onClick={() => setViewMode('bubble')}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Mini Bubble Mode"
              aria-label="Switch to bubble mode"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Camera */}
            <button
              onClick={onToggleCamera}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title={cameraStatus === 'active' ? 'Stop tracking' : 'Start tracking'}
              aria-label="Toggle camera"
            >
              {cameraStatus === 'active' ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            </button>

            {/* Hide HUD */}
            <button
              onClick={() => setViewMode('hidden')}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Hide HUD"
              aria-label="Hide HUD"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video & Tracking Canvas */}
        <div>
          <div className={`relative w-full aspect-[4/3] overflow-hidden flex items-center justify-center transition-colors ${
            skeletonOnlyMode
              ? 'bg-slate-950 bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] [background-size:16px_16px]'
              : 'bg-slate-950'
          }`}>
            {/* Mirrored webcam feed (hidden if skeletonOnlyMode is enabled) */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                cameraStatus === 'active' && !skeletonOnlyMode ? 'opacity-85' : 'opacity-0'
              }`}
            />

            {/* Hand landmark overlay canvas */}
            <canvas
              ref={canvasRef}
              width={320}
              height={240}
              className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
            />

            {/* Inactive or Requesting camera state display */}
            {cameraStatus !== 'active' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-3 sm:p-4 text-center bg-slate-900/90 text-white">
                {cameraStatus === 'requesting' ? (
                  <>
                    <div className="w-7 h-7 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mb-2" />
                    <p className="text-xs font-medium text-slate-200">Connecting camera & AI...</p>
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                      <Camera className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-slate-200">Camera Inactive</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 mb-2 hidden sm:block">
                      Track finger gestures in thin air
                    </p>
                    <button
                      onClick={onToggleCamera}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
                    >
                      Start Camera
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Live Gesture Tag */}
            {cameraStatus === 'active' && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider backdrop-blur-md bg-white/90 text-slate-800 shadow-sm`}>
                  {currentGesture === 'draw' && '✍️ Writing'}
                  {currentGesture === 'erase' && '✋ Eraser'}
                  {currentGesture === 'cursor' && '✌️ Pointer'}
                  {currentGesture === 'pause' && '✊ Paused'}
                  {currentGesture === 'none' && (isHandDetected ? 'Recognizing' : 'No Hand')}
                </span>
                {skeletonOnlyMode && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-indigo-600/90 text-white shadow-xs">
                    Blank Area
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Metrics HUD Footer */}
          <div className="px-3 py-1.5 sm:py-2 bg-white/90 text-[10px] sm:text-[11px] text-slate-600 flex items-center justify-between font-mono">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">FPS:</span>
              <span className="font-semibold text-slate-700">{cameraStatus === 'active' ? fps : 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">CONF:</span>
              <span className="font-semibold text-slate-700">
                {cameraStatus === 'active' && isHandDetected ? `${Math.round(confidence * 100)}%` : '--'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">HAND:</span>
              <span className="font-semibold text-slate-700">
                {cameraStatus === 'active' && isHandDetected ? dominantHand : 'None'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
