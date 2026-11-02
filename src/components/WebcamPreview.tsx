import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  EyeOff,
  GripHorizontal,
  Move,
  RotateCcw,
  Maximize2,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { CameraStatus, GestureType, HandDetectionResult, LandmarkPoint } from '../types';
import { HAND_CONNECTIONS, HandFrameCallback } from '../services/handTrackingService';
import {
  clampHudPosition,
  getCornerDockPosition,
  DockCorner,
  Position,
} from '../utils/hudPosition';

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
  onStartDemo?: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  registerFrameListener: (cb: HandFrameCallback) => () => void;
}

export const WebcamPreview: React.FC<WebcamPreviewProps> = React.memo(({
  cameraStatus,
  currentGesture,
  fps,
  confidence,
  isHandDetected,
  dominantHand,
  skeletonOnlyMode,
  onToggleCamera,
  onToggleSkeletonOnly,
  onStartDemo,
  videoRef,
  registerFrameListener,
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'bubble' | 'hidden'>('card');
  const [showDockMenu, setShowDockMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  // Position state with localStorage persistence
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aircanvas_camera_pos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return clampHudPosition(parsed.x, parsed.y, 288, 270, window.innerWidth, window.innerHeight);
          }
        }
      } catch {
        // Ignore JSON error
      }
      return getCornerDockPosition('top-right', 288, 270, window.innerWidth, window.innerHeight);
    }
    return { x: 16, y: 72 };
  });

  const posRef = useRef<Position>(position);
  posRef.current = position;

  // Re-clamp position on window resize to ensure HUD never gets pushed off screen
  useEffect(() => {
    const handleResize = () => {
      const curW = viewMode === 'bubble' ? 88 : window.innerWidth < 640 ? 224 : 288;
      const curH = viewMode === 'bubble' ? 88 : 270;
      const clamped = clampHudPosition(posRef.current.x, posRef.current.y, curW, curH, window.innerWidth, window.innerHeight);
      posRef.current = clamped;
      setPosition(clamped);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  // Window-level dragging event listeners for ultra-smooth tracking across viewport
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;

      if (Math.hypot(dx, dy) > 3) {
        hasMovedRef.current = true;
      }

      const curW = viewMode === 'bubble' ? 88 : window.innerWidth < 640 ? 224 : 288;
      const curH = viewMode === 'bubble' ? 88 : 270;

      const nextX = dragStartRef.current.origX + dx;
      const nextY = dragStartRef.current.origY + dy;

      const clamped = clampHudPosition(nextX, nextY, curW, curH, window.innerWidth, window.innerHeight);
      posRef.current = clamped;
      setPosition(clamped);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      try {
        localStorage.setItem('aircanvas_camera_pos', JSON.stringify(posRef.current));
      } catch {
        // Ignore
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDragging, viewMode]);

  // Pointer drag start handler
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary mouse / touch button
    e.stopPropagation();
    hasMovedRef.current = false;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
    };
  };

  // Corner Snap Handler
  const snapToCorner = useCallback(
    (corner: DockCorner) => {
      const curW = viewMode === 'bubble' ? 88 : window.innerWidth < 640 ? 224 : 288;
      const curH = viewMode === 'bubble' ? 88 : 270;
      const targetPos = getCornerDockPosition(corner, curW, curH, window.innerWidth, window.innerHeight);
      posRef.current = targetPos;
      setPosition(targetPos);
      setShowDockMenu(false);
      try {
        localStorage.setItem('aircanvas_camera_pos', JSON.stringify(targetPos));
      } catch {
        // Ignore
      }
    },
    [viewMode]
  );

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

  // Hidden Mode: sleek restore pill
  if (viewMode === 'hidden') {
    return (
      <div
        className="fixed z-30 pointer-events-auto"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        <button
          onClick={() => setViewMode('card')}
          className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 shadow-md transition-all hover:scale-105 active:scale-95"
          title="Restore Vision Camera HUD"
        >
          <Camera className="w-3.5 h-3.5 text-emerald-600" />
          <span>Show Camera HUD</span>
        </button>
      </div>
    );
  }

  // Bubble Mode: draggable sleek circular HUD
  if (viewMode === 'bubble') {
    return (
      <div
        className={`fixed z-30 pointer-events-auto select-none touch-none animate-fade-in ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
      >
        <div className="flex flex-col items-center gap-1">
          <div
            onClick={(e) => {
              if (!hasMovedRef.current) {
                setViewMode('card');
              }
            }}
            className={`relative w-20 h-20 rounded-full overflow-hidden border-2 shadow-2xl transition-all duration-150 bg-slate-950 ${
              isDragging ? 'scale-105 ring-2 ring-indigo-500 ring-offset-2' : 'hover:scale-105'
            } ${getGestureBorder()}`}
            title="Drag to position anywhere, or tap to expand"
          >
            {/* Mirrored webcam feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 pointer-events-none ${
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
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white pointer-events-none">
                <CameraOff className="w-5 h-5 text-slate-400" />
              </div>
            )}

            {/* Tiny FPS badge */}
            {cameraStatus === 'active' && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-black/75 text-[9px] font-mono text-white whitespace-nowrap pointer-events-none">
                {fps} fps
              </div>
            )}

            {/* Drag hint overlay */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 text-white/60 pointer-events-none">
              <GripHorizontal className="w-3.5 h-3.5" />
            </div>
          </div>

          <button
            onClick={() => setViewMode('card')}
            className="text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-white/90 px-2 py-0.5 rounded-full border border-slate-200/90 shadow-xs"
          >
            Expand HUD
          </button>
        </div>
      </div>
    );
  }

  // Card Mode (Default): rich telemetry, movable draggable header bar, and snap presets
  return (
    <div
      className={`fixed z-30 pointer-events-auto transition-shadow duration-150 select-none ${
        isDragging ? 'shadow-2xl ring-2 ring-indigo-500/50 rounded-2xl' : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
    >
      <div className="glass-panel overflow-hidden rounded-2xl shadow-xl w-56 sm:w-72 border border-slate-200/80 bg-white/90 backdrop-blur-md">
        {/* HUD Top Bar - Movable Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className={`flex items-center justify-between px-2.5 sm:px-3 py-2 bg-slate-100/80 border-b border-slate-200/80 touch-none ${
            isDragging ? 'cursor-grabbing bg-indigo-50/80' : 'cursor-grab hover:bg-slate-200/60'
          } transition-colors group`}
          title="Click & drag header to move camera anywhere on screen"
        >
          {/* Draggable Title Area */}
          <div className="flex items-center gap-1.5 min-w-0">
            <GripHorizontal className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                cameraStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700 truncate">
              Air Vision
            </span>
          </div>

          {/* Action & Corner Snap Buttons */}
          <div className="flex items-center gap-0.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            {/* Quick Corner Snap Popover Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowDockMenu((prev) => !prev)}
                className={`p-1 rounded text-xs transition-colors ${
                  showDockMenu
                    ? 'bg-indigo-100 text-indigo-700 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/70'
                }`}
                title="Position presets & corner docking"
                aria-label="Position presets"
              >
                <Move className="w-3.5 h-3.5" />
              </button>

              {/* Corner Snap Menu Popover */}
              {showDockMenu && (
                <div className="absolute top-full right-0 mt-1.5 w-44 bg-white/95 backdrop-blur-lg rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-fade-in text-xs">
                  <div className="font-semibold text-slate-700 text-[10px] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Move / Snap</span>
                    <span className="text-[9px] text-slate-400">Drag or click</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <button
                      onClick={() => snapToCorner('top-left')}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-left transition-colors font-medium flex items-center justify-between"
                    >
                      <span>Top-Left</span>
                    </button>
                    <button
                      onClick={() => snapToCorner('top-right')}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-left transition-colors font-medium flex items-center justify-between"
                    >
                      <span>Top-Right</span>
                    </button>
                    <button
                      onClick={() => snapToCorner('bottom-left')}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-left transition-colors font-medium flex items-center justify-between"
                    >
                      <span>Btm-Left</span>
                    </button>
                    <button
                      onClick={() => snapToCorner('bottom-right')}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-left transition-colors font-medium flex items-center justify-between"
                    >
                      <span>Btm-Right</span>
                    </button>
                  </div>

                  <button
                    onClick={() => snapToCorner('center-right')}
                    className="w-full px-2 py-1 rounded bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-left transition-colors text-[10px] mb-1.5 font-medium"
                  >
                    Center-Right
                  </button>

                  <p className="text-[9px] text-slate-400 leading-tight pt-1 border-t border-slate-100">
                    💡 Hold & drag the top header bar to set camera anywhere on screen.
                  </p>
                </div>
              )}
            </div>

            {/* Toggle Skeleton Only (Hide Video in blank area) */}
            <button
              onClick={onToggleSkeletonOnly}
              className={`p-1 rounded text-xs transition-colors flex items-center gap-1 ${
                skeletonOnlyMode
                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/70'
              }`}
              title={skeletonOnlyMode ? 'Show camera video' : 'Hide camera (Trace hand only in blank area)'}
              aria-label="Hide camera video, trace hand only"
            >
              {skeletonOnlyMode ? <Eye className="w-3.5 h-3.5 text-indigo-600" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            {/* Switch to Bubble mode */}
            <button
              onClick={() => setViewMode('bubble')}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
              title="Mini Bubble Mode"
              aria-label="Switch to bubble mode"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Camera */}
            <button
              onClick={onToggleCamera}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
              title={cameraStatus === 'active' ? 'Stop tracking' : 'Start tracking'}
              aria-label="Toggle camera"
            >
              {cameraStatus === 'active' ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            </button>

            {/* Hide HUD */}
            <button
              onClick={() => setViewMode('hidden')}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
              title="Minimize HUD"
              aria-label="Minimize HUD"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video & Tracking Canvas */}
        <div>
          <div
            className={`relative w-full aspect-[4/3] overflow-hidden flex items-center justify-center transition-colors ${
              skeletonOnlyMode
                ? 'bg-slate-950 bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] [background-size:16px_16px]'
                : 'bg-slate-950'
            }`}
          >
            {/* Mirrored webcam feed (hidden if skeletonOnlyMode is enabled) */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 pointer-events-none ${
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

            {/* Inactive, Denied, or Requesting camera state display */}
            {cameraStatus !== 'active' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-900/90 text-white">
                {cameraStatus === 'requesting' ? (
                  <>
                    <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mb-1.5" />
                    <p className="text-xs font-medium text-slate-200">Connecting AI camera...</p>
                  </>
                ) : cameraStatus === 'denied' ? (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mb-1.5">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-amber-200">Camera Blocked</p>
                    <p className="text-[10px] text-slate-300 mt-0.5 max-w-[200px] leading-tight">
                      Allow camera in browser address bar to use gestures.
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        onClick={onToggleCamera}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors shadow-xs cursor-pointer"
                      >
                        Retry Camera
                      </button>
                      {onStartDemo && (
                        <button
                          onClick={onStartDemo}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-medium transition-colors border border-slate-700 cursor-pointer"
                        >
                          Try Demo
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mb-1.5">
                      <Camera className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-slate-200">Camera Inactive</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        onClick={onToggleCamera}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
                      >
                        Start Camera
                      </button>
                      {onStartDemo && (
                        <button
                          onClick={onStartDemo}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium transition-colors border border-slate-700 cursor-pointer"
                        >
                          Demo
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Live Gesture Tag */}
            {cameraStatus === 'active' && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-zinc-200/60 uppercase tracking-wider backdrop-blur-md bg-white/95 text-zinc-800 shadow-xs">
                  {currentGesture === 'draw' && '✍️ Writing'}
                  {currentGesture === 'erase' && '✋ Eraser'}
                  {currentGesture === 'cursor' && '✌️ Pointer'}
                  {currentGesture === 'pause' && '✊ Paused'}
                  {currentGesture === 'none' && (isHandDetected ? 'Ready' : 'No Hand')}
                </span>
                {skeletonOnlyMode && (
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-zinc-900 text-cyan-300 shadow-xs uppercase tracking-wider">
                    Hand Only
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Metrics HUD Footer */}
          <div className="px-2.5 sm:px-3 py-1.5 bg-white/90 text-[10px] sm:text-[11px] text-slate-600 flex items-center justify-between font-mono border-t border-slate-100">
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
});
