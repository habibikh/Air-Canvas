import React, { useEffect, useRef, memo } from 'react';
import {
  GridStyle,
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

  const isGestureDrawingRef = useRef<boolean>(false);
  const isGestureErasingRef = useRef<boolean>(false);
  const lastGestureRef = useRef<GestureType>('none');
  const lastTargetSourceRef = useRef<'tip' | 'palm' | null>(null);
  const lastStrokeNormPointRef = useRef<{ x: number; y: number } | null>(null);
  const handLostAtRef = useRef<number>(0);
  const isMouseDownRef = useRef<boolean>(false);

  // 60fps smooth cursor interpolation state (decouples display smoothness from camera FPS)
  const targetCursorRef = useRef<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const visualCursorRef = useRef<{ x: number; y: number; initialized: boolean }>({ x: 0, y: 0, initialized: false });
  const cursorRafIdRef = useRef<number | null>(null);

  // Initialize Canvas DrawingEngine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new DrawingEngine(canvas, strokeHistory);
    engine.setGridStyle(gridStyle);
    engineRef.current = engine;

    const handleWindowResize = () => engine.handleResize();
    const resizeObserver = new ResizeObserver(() => engine.handleResize());

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
    };
  }, [strokeHistory, engineRef]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setGridStyle(gridStyle);
    }
  }, [gridStyle, engineRef]);

  const updateCursorDOM = (gesture: GestureType, color: string, radius: number) => {
    const graphic = cursorGraphicRef.current;
    const tag = cursorTagRef.current;
    if (!graphic || !tag) return;

    if (gesture === 'erase') {
      graphic.className = 'rounded-full border-2 border-rose-500 bg-rose-500/15 shadow-lg shadow-rose-500/20';
      graphic.style.width = `${radius}px`;
      graphic.style.height = `${radius}px`;
      graphic.style.backgroundColor = '';
      graphic.textContent = '';
      tag.textContent = `Erasing (${radius}px)`;
    } else if (gesture === 'draw') {
      graphic.className = 'w-4 h-4 rounded-full border-2 border-white shadow-md';
      graphic.style.width = '16px';
      graphic.style.height = '16px';
      graphic.style.backgroundColor = color;
      graphic.textContent = '';
      tag.textContent = 'Writing';
    } else if (gesture === 'cursor') {
      graphic.className = 'w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] border border-white';
      graphic.style.width = '14px';
      graphic.style.height = '14px';
      graphic.style.backgroundColor = '';
      graphic.textContent = '';
      tag.textContent = 'Pointer';
    } else if (gesture === 'pause') {
      graphic.className = 'w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shadow-md';
      graphic.style.width = '24px';
      graphic.style.height = '24px';
      graphic.style.backgroundColor = '';
      graphic.textContent = '✊';
      tag.textContent = 'Hold';
    } else {
      graphic.className = 'w-3.5 h-3.5 rounded-full bg-slate-400/60 border border-white';
      graphic.style.width = '14px';
      graphic.style.height = '14px';
      graphic.style.backgroundColor = '';
      graphic.textContent = '';
      tag.textContent = 'Hand Tracked';
    }
  };

  // Handle hand tracking frames for core 4 gestures: Write, Erase, Pointer, Hold
  useEffect(() => {
    const startCursorAnimation = () => {
      if (cursorRafIdRef.current !== null) return;

      const animateCursor = () => {
        const wrapper = cursorWrapperRef.current;
        const target = targetCursorRef.current;

        if (!wrapper || !target.visible) {
          cursorRafIdRef.current = null;
          return;
        }

        const visual = visualCursorRef.current;
        if (!visual.initialized) {
          visual.x = target.x;
          visual.y = target.y;
          visual.initialized = true;
        } else {
          // Snappy frame-rate-friendly exponential glide toward latest target
          const dx = target.x - visual.x;
          const dy = target.y - visual.y;
          if (Math.hypot(dx, dy) < 0.25) {
            visual.x = target.x;
            visual.y = target.y;
          } else {
            visual.x += dx * 0.45;
            visual.y += dy * 0.45;
          }
        }

        wrapper.style.transform = `translate3d(${visual.x.toFixed(1)}px, ${visual.y.toFixed(1)}px, 0)`;
        cursorRafIdRef.current = requestAnimationFrame(animateCursor);
      };

      cursorRafIdRef.current = requestAnimationFrame(animateCursor);
    };

    const stopCursorAnimation = () => {
      if (cursorRafIdRef.current !== null) {
        cancelAnimationFrame(cursorRafIdRef.current);
        cursorRafIdRef.current = null;
      }
    };

    const MIN_POINT_STEP_NORM = 0.0010;

    const unsubscribe = registerFrameListener((result) => {
      const engine = engineRef.current;
      if (!engine) return;

      const { brushColor: color, brushSize: size, eraserRadius: radius } = propsRef.current;
      const gesture = result.gesture;
      const dims = engine.getDimensions();
      const now = performance.now();

      if (!result.landmarks || result.landmarks.length === 0 || gesture === 'none') {
        if (handLostAtRef.current === 0) {
          handLostAtRef.current = now;
        }

        if (isGestureDrawingRef.current || isGestureErasingRef.current) {
          const finished = strokeHistory.endStroke();
          isGestureDrawingRef.current = false;
          isGestureErasingRef.current = false;
          lastStrokeNormPointRef.current = null;
          soundEffects.playDrawEnd();
          engine.commitStroke(finished);
          onStrokeChange();
        }

        if (now - handLostAtRef.current > 240) {
          pointFilterRef.current.reset();
          lastTargetSourceRef.current = null;
          visualCursorRef.current.initialized = false;
        }

        lastGestureRef.current = 'none';
        targetCursorRef.current.visible = false;
        stopCursorAnimation();
        if (cursorWrapperRef.current) {
          cursorWrapperRef.current.style.opacity = '0';
        }
        return;
      }

      handLostAtRef.current = 0;

      const targetSource: 'tip' | 'palm' = gesture === 'erase' && result.palmCenter ? 'palm' : 'tip';
      const rawTargetPoint = targetSource === 'palm' ? result.palmCenter : result.indexTip;
      if (!rawTargetPoint) return;

      // Only reset One Euro filter when switching between indexTip and palmCenter
      if (lastTargetSourceRef.current !== null && lastTargetSourceRef.current !== targetSource) {
        pointFilterRef.current.reset();
      }
      lastTargetSourceRef.current = targetSource;

      const mapped = mapLandmarkToCanvas(rawTargetPoint, dims.width, dims.height, true);
      const smoothed = pointFilterRef.current.filter(mapped.normX, mapped.normY, now);
      const canvasX = smoothed.x * dims.width;
      const canvasY = smoothed.y * dims.height;

      targetCursorRef.current.x = canvasX;
      targetCursorRef.current.y = canvasY;
      targetCursorRef.current.visible = true;

      const isActivelyInking = gesture === 'draw' || gesture === 'erase';

      if (cursorWrapperRef.current) {
        if (!visualCursorRef.current.initialized || isActivelyInking) {
          // Lock pen/eraser cursor directly to the live ink tip so ink never trails behind cursor
          visualCursorRef.current.x = canvasX;
          visualCursorRef.current.y = canvasY;
          visualCursorRef.current.initialized = true;
          cursorWrapperRef.current.style.transform = `translate3d(${canvasX.toFixed(1)}px, ${canvasY.toFixed(1)}px, 0)`;
          if (isActivelyInking) {
            stopCursorAnimation();
          }
        }
        cursorWrapperRef.current.style.opacity = '1';
        if (!isActivelyInking) {
          startCursorAnimation();
        }
      }

      if (gesture !== lastGestureRef.current) {
        updateCursorDOM(gesture, color, radius);
      }

      if (gesture === 'draw') {
        if (isGestureErasingRef.current) {
          const finished = strokeHistory.endStroke();
          isGestureErasingRef.current = false;
          lastStrokeNormPointRef.current = null;
          engine.commitStroke(finished);
        }

        if (!isGestureDrawingRef.current) {
          isGestureDrawingRef.current = true;
          lastStrokeNormPointRef.current = { x: smoothed.x, y: smoothed.y };
          strokeHistory.startStroke('pen', color, size, { x: smoothed.x, y: smoothed.y });
          soundEffects.playDrawStart();
          engine.render();
        } else {
          const prev = lastStrokeNormPointRef.current;
          const dist = prev ? Math.hypot(smoothed.x - prev.x, smoothed.y - prev.y) : Infinity;
          if (dist >= MIN_POINT_STEP_NORM) {
            lastStrokeNormPointRef.current = { x: smoothed.x, y: smoothed.y };
            strokeHistory.appendPoint({ x: smoothed.x, y: smoothed.y });
            engine.render();
          }
        }
      } else if (gesture === 'erase') {
        if (isGestureDrawingRef.current) {
          const finished = strokeHistory.endStroke();
          isGestureDrawingRef.current = false;
          lastStrokeNormPointRef.current = null;
          soundEffects.playDrawEnd();
          engine.commitStroke(finished);
        }

        if (!isGestureErasingRef.current) {
          isGestureErasingRef.current = true;
          lastStrokeNormPointRef.current = { x: smoothed.x, y: smoothed.y };
          strokeHistory.startStroke('eraser', '#000000', radius, { x: smoothed.x, y: smoothed.y });
          soundEffects.playErase();
          engine.render();
        } else {
          const prev = lastStrokeNormPointRef.current;
          const dist = prev ? Math.hypot(smoothed.x - prev.x, smoothed.y - prev.y) : Infinity;
          if (dist >= MIN_POINT_STEP_NORM) {
            lastStrokeNormPointRef.current = { x: smoothed.x, y: smoothed.y };
            strokeHistory.appendPoint({ x: smoothed.x, y: smoothed.y });
            engine.render();
          }
        }
      } else {
        // Pointer ('cursor') or Hold ('pause'): cleanly commit finished stroke
        if (isGestureDrawingRef.current || isGestureErasingRef.current) {
          const finished = strokeHistory.endStroke();
          isGestureDrawingRef.current = false;
          isGestureErasingRef.current = false;
          lastStrokeNormPointRef.current = null;
          soundEffects.playDrawEnd();
          engine.commitStroke(finished);
          onStrokeChange();
        }
      }

      lastGestureRef.current = gesture;
    });

    return () => {
      unsubscribe();
      stopCursorAnimation();
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

    const finished = strokeHistory.endStroke();
    soundEffects.playDrawEnd();
    if (engineRef.current) {
      engineRef.current.commitStroke(finished);
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
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 w-full h-full touch-none"
      />

      {/* Live Hand Gesture Tracking Cursor Reticle */}
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
            className="mt-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-md border whitespace-nowrap bg-white/95 text-slate-800 border-slate-200"
          >
            Hand Tracked
          </div>
        </div>
      </div>
    </div>
  );
});
