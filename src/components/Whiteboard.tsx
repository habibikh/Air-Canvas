import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  GridStyle,
  HandDetectionResult,
  StrokeTool,
  GestureType,
} from '../types';
import { DrawingEngine } from '../canvas/drawingEngine';
import { StrokeHistory } from '../canvas/strokeHistory';
import { PointFilter, mapLandmarkToCanvas } from '../utils/coordinateMapping';
import { HandFrameCallback } from '../services/handTrackingService';
import { soundEffects } from '../services/soundEffects';

interface WhiteboardProps {
  currentTool: StrokeTool;
  brushColor: string;
  brushSize: number;
  eraserRadius: number;
  gridStyle: GridStyle;
  smoothing: 'low' | 'medium' | 'high';
  strokeHistory: StrokeHistory;
  engineRef: React.MutableRefObject<DrawingEngine | null>;
  registerFrameListener: (cb: HandFrameCallback) => () => void;
  onStrokeChange: () => void;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  currentTool,
  brushColor,
  brushSize,
  eraserRadius,
  gridStyle,
  smoothing,
  strokeHistory,
  engineRef,
  registerFrameListener,
  onStrokeChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const trailSvgRef = useRef<SVGPolylineElement | null>(null);

  // Keep latest props in refs to avoid closure stalls inside RAF callbacks
  const propsRef = useRef({
    currentTool,
    brushColor,
    brushSize,
    eraserRadius,
    smoothing,
  });

  useEffect(() => {
    propsRef.current = {
      currentTool,
      brushColor,
      brushSize,
      eraserRadius,
      smoothing,
    };
  }, [currentTool, brushColor, brushSize, eraserRadius, smoothing]);

  const pointFilterRef = useRef<PointFilter>(new PointFilter(smoothing));
  useEffect(() => {
    pointFilterRef.current.setLevel(smoothing);
  }, [smoothing]);

  // Hand tracking state tracking for gesture drawing
  const isGestureDrawingRef = useRef<boolean>(false);
  const isGestureErasingRef = useRef<boolean>(false);
  const lastGestureRef = useRef<GestureType>('none');
  const recentTrailPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Mouse / Touch drawing state
  const isMouseDownRef = useRef<boolean>(false);

  // Cursor state for smooth DOM rendering
  const [cursorInfo, setCursorInfo] = useState<{
    visible: boolean;
    x: number;
    y: number;
    gesture: GestureType;
  }>({
    visible: false,
    x: 0,
    y: 0,
    gesture: 'none',
  });

  // Initialize Canvas DrawingEngine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new DrawingEngine(canvas, strokeHistory);
    engine.setGridStyle(gridStyle);
    engineRef.current = engine;

    const handleWindowResize = () => {
      engine.handleResize();
    };

    const resizeObserver = new ResizeObserver(() => {
      engine.handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
    };
  }, [strokeHistory, engineRef]);

  // Update grid style in drawing engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setGridStyle(gridStyle);
    }
  }, [gridStyle, engineRef]);

  // Handle hand tracking frames for air drawing
  useEffect(() => {
    const unsubscribe = registerFrameListener((result) => {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) return;

      const { currentTool: uiTool, brushColor: color, brushSize: size, eraserRadius: radius } = propsRef.current;
      const gesture = result.gesture;
      const dims = engine.getDimensions();

      // If no hand detected, end any current stroke safely
      if (!result.landmarks || result.landmarks.length === 0 || gesture === 'none') {
        if (isGestureDrawingRef.current || isGestureErasingRef.current) {
          strokeHistory.endStroke();
          isGestureDrawingRef.current = false;
          isGestureErasingRef.current = false;
          pointFilterRef.current.reset();
          soundEffects.playDrawEnd();
          engine.requestRender();
          onStrokeChange();
        }
        lastGestureRef.current = 'none';
        recentTrailPointsRef.current = [];
        if (trailSvgRef.current) {
          trailSvgRef.current.setAttribute('points', '');
        }

        setCursorInfo((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      // Determine active landmark for cursor & drawing
      const rawTargetPoint = gesture === 'erase' && result.palmCenter ? result.palmCenter : result.indexTip;

      if (!rawTargetPoint) {
        return;
      }

      // Map to mirrored canvas coordinates
      const mapped = mapLandmarkToCanvas(rawTargetPoint, dims.width, dims.height, true);

      // Apply adaptive jitter filter
      const smoothed = pointFilterRef.current.filter(mapped.normX, mapped.normY);
      const canvasX = smoothed.x * dims.width;
      const canvasY = smoothed.y * dims.height;

      // Update kinetic trail
      const trail = recentTrailPointsRef.current;
      trail.push({ x: canvasX, y: canvasY });
      if (trail.length > 8) trail.shift();

      if (trailSvgRef.current) {
        const ptsStr = trail.map((p) => `${p.x},${p.y}`).join(' ');
        trailSvgRef.current.setAttribute('points', ptsStr);
      }

      // Update cursor position directly in DOM for 60fps performance
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${canvasX}px, ${canvasY}px, 0)`;
      }

      setCursorInfo({
        visible: true,
        x: canvasX,
        y: canvasY,
        gesture,
      });

      // Handle gesture state transitions:
      // 1. Gesture A: Drawing (Index finger extended)
      if (gesture === 'draw') {
        if (isGestureErasingRef.current) {
          strokeHistory.endStroke();
          isGestureErasingRef.current = false;
        }

        // Use selected active tool (pen, highlighter, line, rectangle, circle)
        const activeTool = uiTool === 'eraser' ? 'pen' : uiTool;

        if (!isGestureDrawingRef.current) {
          isGestureDrawingRef.current = true;
          strokeHistory.startStroke(activeTool, color, size, { x: smoothed.x, y: smoothed.y });
          soundEffects.playDrawStart();
        } else {
          strokeHistory.appendPoint({ x: smoothed.x, y: smoothed.y });
        }
        engine.requestRender();
      }
      // 2. Gesture B: Open Palm Eraser
      else if (gesture === 'erase') {
        if (isGestureDrawingRef.current) {
          strokeHistory.endStroke();
          isGestureDrawingRef.current = false;
          soundEffects.playDrawEnd();
        }

        if (!isGestureErasingRef.current) {
          isGestureErasingRef.current = true;
          strokeHistory.startStroke('eraser', '#000000', radius, { x: smoothed.x, y: smoothed.y });
          soundEffects.playErase();
        } else {
          strokeHistory.appendPoint({ x: smoothed.x, y: smoothed.y });
        }
        engine.requestRender();
      }
      // 3. Gesture C: Pause (Fist) or Gesture D: Cursor (Two fingers)
      else if (gesture === 'pause' || gesture === 'cursor') {
        if (isGestureDrawingRef.current || isGestureErasingRef.current) {
          strokeHistory.endStroke();
          isGestureDrawingRef.current = false;
          isGestureErasingRef.current = false;
          pointFilterRef.current.reset();
          soundEffects.playDrawEnd();
          engine.requestRender();
          onStrokeChange();
        }
      }

      lastGestureRef.current = gesture;
    });

    return () => {
      unsubscribe();
    };
  }, [registerFrameListener, strokeHistory, engineRef, onStrokeChange]);

  // Fallback Mouse & Touch Drawing Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    isMouseDownRef.current = true;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    const { currentTool: tool, brushColor: color, brushSize: size, eraserRadius: radius } = propsRef.current;
    const strokeSize = tool === 'eraser' ? radius : size;

    strokeHistory.startStroke(tool, color, strokeSize, { x: normX, y: normY });
    if (tool === 'eraser') {
      soundEffects.playErase();
    } else {
      soundEffects.playDrawStart();
    }
    engine.requestRender();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const rect = canvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    strokeHistory.appendPoint({ x: normX, y: normY });
    engine.requestRender();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    strokeHistory.endStroke();
    soundEffects.playDrawEnd();
    if (engineRef.current) {
      engineRef.current.requestRender();
    }
    onStrokeChange();
  };

  const cursorGesture = cursorInfo.gesture;
  const isEraser = cursorGesture === 'erase';
  const isPen = cursorGesture === 'draw';
  const isPointer = cursorGesture === 'cursor';
  const isPaused = cursorGesture === 'pause';

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none cursor-crosshair ${
        gridStyle === 'blueprint'
          ? 'bg-[#1e293b]'
          : gridStyle === 'ruled'
          ? 'bg-[#fdfbf7]'
          : 'bg-[#fbf8fc]'
      }`}
    >
      {/* Primary HTML5 Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 w-full h-full touch-none"
      />

      {/* Kinetic Air Trail SVG Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <polyline
          ref={trailSvgRef}
          fill="none"
          stroke={brushColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.35"
        />
      </svg>

      {/* Live Hand Gesture Tracking Cursor Reticle */}
      {cursorInfo.visible && (
        <div
          ref={cursorRef}
          className="absolute top-0 left-0 pointer-events-none transition-opacity duration-150 z-20"
          style={{
            transform: `translate3d(${cursorInfo.x}px, ${cursorInfo.y}px, 0)`,
            willChange: 'transform',
          }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            {/* Cursor Graphic */}
            {isEraser ? (
              <div
                className="rounded-full border-2 border-rose-500 bg-rose-500/15 animate-pulse shadow-lg shadow-rose-500/20"
                style={{
                  width: `${eraserRadius}px`,
                  height: `${eraserRadius}px`,
                }}
              />
            ) : isPen ? (
              <div className="relative flex items-center justify-center">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-md transition-colors"
                  style={{ backgroundColor: brushColor }}
                />
                <div
                  className="absolute w-8 h-8 rounded-full border border-indigo-400/60 animate-ping"
                  style={{ animationDuration: '1.4s' }}
                />
              </div>
            ) : isPointer ? (
              <div className="relative flex items-center justify-center w-7 h-7">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400/80 border-dashed animate-spin" style={{ animationDuration: '6s' }} />
              </div>
            ) : isPaused ? (
              <div className="w-6 h-6 rounded-full bg-amber-500/90 border-2 border-white flex items-center justify-center text-xs text-white font-bold shadow-md">
                ⏸
              </div>
            ) : (
              <div className="w-3.5 h-3.5 rounded-full bg-slate-400/60 border border-white" />
            )}

            {/* Dynamic Gesture Feedback Tag */}
            <div className="mt-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-md shadow-md border whitespace-nowrap bg-white/95 text-slate-800 border-slate-200">
              {isPen && (currentTool === 'highlighter' ? 'Highlighting' : 'Writing')}
              {isEraser && `Erasing (${eraserRadius}px)`}
              {isPointer && 'Pointer'}
              {isPaused && 'Paused'}
              {!isPen && !isEraser && !isPointer && !isPaused && 'Hand Tracked'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
