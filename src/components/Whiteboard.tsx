import React, { useEffect, useRef, memo } from 'react';
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

export const Whiteboard: React.FC<WhiteboardProps> = memo(({
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

  // Direct DOM cursor elements for 0 React re-renders during active drawing
  const cursorWrapperRef = useRef<HTMLDivElement | null>(null);
  const cursorGraphicRef = useRef<HTMLDivElement | null>(null);
  const cursorTagRef = useRef<HTMLDivElement | null>(null);
  const trailSvgRef = useRef<SVGPolylineElement | null>(null);

  // Keep latest props in ref to avoid stale closures
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

  // Helper to update cursor visual appearance directly in DOM without React re-render
  const updateCursorDOM = (gesture: GestureType, tool: StrokeTool, color: string, radius: number) => {
    const wrapper = cursorWrapperRef.current;
    const graphic = cursorGraphicRef.current;
    const tag = cursorTagRef.current;
    if (!wrapper || !graphic || !tag) return;

    if (gesture === 'erase') {
      graphic.className = 'rounded-full border-2 border-rose-500 bg-rose-500/15 animate-pulse shadow-lg shadow-rose-500/20';
      graphic.style.width = `${radius}px`;
      graphic.style.height = `${radius}px`;
      graphic.style.backgroundColor = '';
      graphic.innerHTML = '';
      tag.textContent = `Erasing (${radius}px)`;
    } else if (gesture === 'draw') {
      graphic.className = 'w-4 h-4 rounded-full border-2 border-white shadow-md';
      graphic.style.width = '16px';
      graphic.style.height = '16px';
      graphic.style.backgroundColor = color;
      graphic.innerHTML = '';
      tag.textContent = tool === 'highlighter' ? 'Highlighting' : 'Writing';
    } else if (gesture === 'cursor') {
      graphic.className = 'w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] border border-white';
      graphic.style.width = '14px';
      graphic.style.height = '14px';
      graphic.style.backgroundColor = '';
      graphic.innerHTML = '';
      tag.textContent = 'Pointer';
    } else if (gesture === 'pause') {
      graphic.className = 'w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shadow-md';
      graphic.style.width = '24px';
      graphic.style.height = '24px';
      graphic.style.backgroundColor = '';
      graphic.innerHTML = '⏸';
      tag.textContent = 'Paused';
    } else {
      graphic.className = 'w-3.5 h-3.5 rounded-full bg-slate-400/60 border border-white';
      graphic.style.width = '14px';
      graphic.style.height = '14px';
      graphic.style.backgroundColor = '';
      graphic.innerHTML = '';
      tag.textContent = 'Hand Tracked';
    }
  };

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
          engine.invalidateCache();
          engine.requestRender();
          onStrokeChange();
        }
        lastGestureRef.current = 'none';
        recentTrailPointsRef.current = [];
        if (trailSvgRef.current) {
          trailSvgRef.current.setAttribute('points', '');
        }

        if (cursorWrapperRef.current) {
          cursorWrapperRef.current.style.opacity = '0';
        }
        return;
      }

      // Determine active landmark for cursor & drawing
      const rawTargetPoint = gesture === 'erase' && result.palmCenter ? result.palmCenter : result.indexTip;
      if (!rawTargetPoint) return;

      // Map to mirrored canvas coordinates
      const mapped = mapLandmarkToCanvas(rawTargetPoint, dims.width, dims.height, true);

      // Apply adaptive jitter filter
      const smoothed = pointFilterRef.current.filter(mapped.normX, mapped.normY);
      const canvasX = smoothed.x * dims.width;
      const canvasY = smoothed.y * dims.height;

      // Update kinetic trail directly on SVG DOM
      const trail = recentTrailPointsRef.current;
      trail.push({ x: canvasX, y: canvasY });
      if (trail.length > 6) trail.shift();

      if (trailSvgRef.current) {
        const ptsStr = trail.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
        trailSvgRef.current.setAttribute('points', ptsStr);
      }

      // Update cursor position directly via hardware-accelerated transform
      if (cursorWrapperRef.current) {
        cursorWrapperRef.current.style.transform = `translate3d(${canvasX}px, ${canvasY}px, 0)`;
        cursorWrapperRef.current.style.opacity = '1';
      }

      // Update cursor look when gesture changes
      if (gesture !== lastGestureRef.current) {
        updateCursorDOM(gesture, uiTool, color, radius);
      }

      // Handle gesture state transitions:
      // 1. Gesture A: Drawing (Index finger extended)
      if (gesture === 'draw') {
        if (isGestureErasingRef.current) {
          strokeHistory.endStroke();
          isGestureErasingRef.current = false;
          engine.invalidateCache();
        }

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
          engine.invalidateCache();
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
          engine.invalidateCache();
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
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

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
      engineRef.current.invalidateCache();
      engineRef.current.requestRender();
    }
    onStrokeChange();
  };

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

      {/* Live Hand Gesture Tracking Cursor Reticle (Direct DOM manipulated for 0 React re-renders) */}
      <div
        ref={cursorWrapperRef}
        className="absolute top-0 left-0 pointer-events-none z-20 transition-opacity duration-150"
        style={{
          opacity: 0,
          willChange: 'transform',
        }}
      >
        <div className="-translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div ref={cursorGraphicRef} className="w-3.5 h-3.5 rounded-full bg-slate-400/60 border border-white" />
          <div
            ref={cursorTagRef}
            className="mt-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-md shadow-md border whitespace-nowrap bg-white/95 text-slate-800 border-slate-200"
          >
            Hand Tracked
          </div>
        </div>
      </div>
    </div>
  );
});
