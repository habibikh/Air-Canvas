/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { CanvasSettings, GridStyle, StrokeTool, ToastMessage } from './types';
import { useHandTracking } from './hooks/useHandTracking';
import { StrokeHistory } from './canvas/strokeHistory';
import { DrawingEngine } from './canvas/drawingEngine';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Whiteboard } from './components/Whiteboard';
import { WebcamPreview } from './components/WebcamPreview';
import { CameraPermissionPrompt } from './components/CameraPermissionPrompt';
import { ToastContainer } from './components/Toast';
import { soundEffects } from './services/soundEffects';
import { handTrackingService } from './services/handTrackingService';

// Lazy-load secondary modals & optional overlays for ultra-fast initial page boot
const GestureGuideModal = lazy(() =>
  import('./components/GestureGuideModal').then((m) => ({ default: m.GestureGuideModal }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const ClearConfirmModal = lazy(() =>
  import('./components/ClearConfirmModal').then((m) => ({ default: m.ClearConfirmModal }))
);
const ExportModal = lazy(() =>
  import('./components/ExportModal').then((m) => ({ default: m.ExportModal }))
);
const GestureCoach = lazy(() =>
  import('./components/GestureCoach').then((m) => ({ default: m.GestureCoach }))
);

const STORAGE_KEY = 'aircanvas_settings_v3';

const DEFAULT_SETTINGS: CanvasSettings = {
  gridStyle: 'dots',
  smoothing: 'medium',
  eraserRadius: 48,
  brushSize: 6,
  brushColor: '#4f46e5',
  soundEnabled: true,
  showWebcamHUD: true,
  hudMode: 'card',
  webcamOpacity: 0.85,
  mirrorTracking: true,
  autoConnectCamera: false,
  showGestureCoach: false,
  targetFps: 45,
  skeletonOnlyMode: false,
};

export default function App() {
  const [settings, setSettings] = useState<CanvasSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore
    }
    return DEFAULT_SETTINGS;
  });

  // Sync target FPS & gently warm up MediaPipe module after initial paint
  useEffect(() => {
    handTrackingService.setTargetMaxFps(settings.targetFps || 45);
  }, [settings.targetFps]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    if (ric) {
      const id = ric(() => handTrackingService.preloadModule(), { timeout: 1500 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => handTrackingService.preloadModule(), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const updateSettings = useCallback((newPartial: Partial<CanvasSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // Ignore
    }
  }, []);

  const [currentTool, setCurrentTool] = useState<StrokeTool>('pen');
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((title: string, description?: string, type?: 'info' | 'success' | 'warning') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, title, description, type };
    setToasts((prev) => [...prev.slice(-3), newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const [showPrompt, setShowPrompt] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return false;
      }
    }
    return true;
  });

  const strokeHistoryRef = useRef<StrokeHistory>(new StrokeHistory(150));
  const engineRef = useRef<DrawingEngine | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const {
    cameraStatus,
    errorMessage,
    currentGesture,
    confidence,
    fps,
    isHandDetected,
    dominantHand,
    startCamera,
    startDemoSimulation,
    stopCamera,
    registerFrameListener,
  } = useHandTracking();

  const syncUndoRedo = useCallback(() => {
    setCanUndo(strokeHistoryRef.current.canUndo());
    setCanRedo(strokeHistoryRef.current.canRedo());
  }, []);

  const handleStartCamera = useCallback(async () => {
    if (videoRef.current) {
      const res = await startCamera(videoRef.current);
      if (res.success) {
        setShowPrompt(false);
        addToast('Camera Live', '1 finger writes, open palm erases, 2 fingers point, fist holds', 'success');
      } else {
        if (res.isDenied) {
          addToast('Camera Blocked', 'Allow camera in browser address bar, or draw with mouse/touch', 'info');
        } else {
          addToast('Camera Unavailable', res.error || 'Please connect a webcam or try Demo Mode', 'warning');
        }
      }
    }
  }, [startCamera, addToast]);

  const handleStartDemo = useCallback(() => {
    startDemoSimulation();
    setShowPrompt(false);
    addToast('Interactive Demo Live', 'Simulating write, pointer, hold, and erase cycle', 'info');
  }, [startDemoSimulation, addToast]);

  const handleToggleCamera = useCallback(async () => {
    if (cameraStatus === 'active') {
      stopCamera();
      addToast('Camera Inactive', 'Air tracking stopped. Mouse/touch is still active.', 'info');
    } else if (videoRef.current) {
      const res = await startCamera(videoRef.current);
      if (res.success) {
        addToast('Camera Live', 'Gesture tracking active', 'success');
      } else if (res.isDenied) {
        addToast('Camera Blocked', 'Click the lock icon in your address bar to allow camera.', 'info');
      } else {
        addToast('Camera Unavailable', res.error || 'Check camera permissions or use Demo Mode', 'warning');
      }
    }
  }, [cameraStatus, startCamera, stopCamera, addToast]);

  const handleUndo = useCallback(() => {
    const undone = strokeHistoryRef.current.undo();
    if (undone) {
      soundEffects.playPop();
      engineRef.current?.invalidateCache();
      engineRef.current?.requestRender();
      syncUndoRedo();
      addToast('Undo', 'Removed last stroke', 'info');
    }
  }, [syncUndoRedo, addToast]);

  const handleRedo = useCallback(() => {
    const redone = strokeHistoryRef.current.redo();
    if (redone) {
      soundEffects.playPop();
      engineRef.current?.invalidateCache();
      engineRef.current?.requestRender();
      syncUndoRedo();
      addToast('Redo', 'Restored stroke', 'info');
    }
  }, [syncUndoRedo, addToast]);

  const handleConfirmClear = useCallback(() => {
    strokeHistoryRef.current.clear();
    soundEffects.playPop();
    engineRef.current?.invalidateCache();
    engineRef.current?.requestRender();
    syncUndoRedo();
    setIsClearModalOpen(false);
    addToast('Whiteboard Cleared', 'Press Ctrl+Z if you want to undo', 'warning');
  }, [syncUndoRedo, addToast]);

  const handleOpenExport = useCallback(() => {
    soundEffects.playPop();
    setIsExportModalOpen(true);
  }, []);

  const handleToggleSound = useCallback(() => {
    const newState = !settings.soundEnabled;
    updateSettings({ soundEnabled: newState });
    soundEffects.setEnabled(newState);
    if (newState) {
      soundEffects.playPop();
      addToast('Audio Feedback On', 'Subtle chimes enabled', 'info');
    } else {
      addToast('Audio Feedback Muted', 'Silent mode active', 'info');
    }
  }, [settings.soundEnabled, updateSettings, addToast]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'p') {
        setCurrentTool('pen');
      } else if (e.key.toLowerCase() === 'e') {
        setCurrentTool('eraser');
      } else if (e.key === '?') {
        setIsGuideOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleSkeletonOnly = useCallback(() => {
    const next = !settings.skeletonOnlyMode;
    updateSettings({ skeletonOnlyMode: next });
    soundEffects.playPop();
    addToast(
      next ? 'Hand Traced Only' : 'Camera Video Visible',
      next ? 'Camera room background hidden' : 'Live webcam feed restored',
      'info'
    );
  }, [settings.skeletonOnlyMode, updateSettings, addToast]);

  const handleSelectTool = useCallback((tool: StrokeTool) => {
    setCurrentTool(tool);
    soundEffects.playPop();
  }, []);

  const handleSelectColor = useCallback((color: string) => {
    updateSettings({ brushColor: color });
    soundEffects.playPop();
  }, [updateSettings]);

  const handleSelectBrushSize = useCallback((size: number) => {
    updateSettings({ brushSize: size });
  }, [updateSettings]);

  const handleSelectEraserRadius = useCallback((radius: number) => {
    updateSettings({ eraserRadius: radius });
  }, [updateSettings]);

  const handleSelectGridStyle = useCallback((style: GridStyle) => {
    updateSettings({ gridStyle: style });
    soundEffects.playPop();
    addToast('Background Updated', `Switched to ${style}`, 'info');
  }, [updateSettings, addToast]);

  const handleToggleCoach = useCallback(() => {
    updateSettings({ showGestureCoach: !settings.showGestureCoach });
  }, [settings.showGestureCoach, updateSettings]);

  const handleOpenClearModal = useCallback(() => setIsClearModalOpen(true), []);
  const handleOpenGuideModal = useCallback(() => setIsGuideOpen(true), []);
  const handleOpenSettingsModal = useCallback(() => setIsSettingsOpen(true), []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#fbf8fc] text-[#1b1b1e]">
      {/* Top Application Header */}
      <Header
        canUndo={canUndo}
        canRedo={canRedo}
        isFullscreen={isFullscreen}
        showGestureCoach={settings.showGestureCoach}
        skeletonOnlyMode={settings.skeletonOnlyMode}
        onToggleCoach={handleToggleCoach}
        onToggleSkeletonOnly={handleToggleSkeletonOnly}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleOpenClearModal}
        onExport={handleOpenExport}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenGuide={handleOpenGuideModal}
        onOpenSettings={handleOpenSettingsModal}
      />

      {/* Floating Webcam Preview HUD */}
      <WebcamPreview
        cameraStatus={cameraStatus}
        currentGesture={currentGesture}
        fps={fps}
        confidence={confidence}
        isHandDetected={isHandDetected}
        dominantHand={dominantHand}
        skeletonOnlyMode={settings.skeletonOnlyMode}
        onToggleCamera={handleToggleCamera}
        onToggleSkeletonOnly={handleToggleSkeletonOnly}
        onStartDemo={handleStartDemo}
        videoRef={videoRef}
        registerFrameListener={registerFrameListener}
      />

      {/* Optional Gesture Coach */}
      {settings.showGestureCoach && (
        <Suspense fallback={null}>
          <GestureCoach
            cameraStatus={cameraStatus}
            currentGesture={currentGesture}
            isHandDetected={isHandDetected}
            onOpenGuide={handleOpenGuideModal}
            onDismiss={() => updateSettings({ showGestureCoach: false })}
          />
        </Suspense>
      )}

      {/* Interactive Main Whiteboard Canvas */}
      <Whiteboard
        currentTool={currentTool}
        brushColor={settings.brushColor}
        brushSize={settings.brushSize}
        eraserRadius={settings.eraserRadius}
        gridStyle={settings.gridStyle}
        smoothing={settings.smoothing}
        strokeHistory={strokeHistoryRef.current}
        engineRef={engineRef}
        registerFrameListener={registerFrameListener}
        onStrokeChange={syncUndoRedo}
      />

      {/* Bottom Floating Canvas Toolbar */}
      <Toolbar
        currentTool={currentTool}
        brushColor={settings.brushColor}
        brushSize={settings.brushSize}
        eraserRadius={settings.eraserRadius}
        gridStyle={settings.gridStyle}
        soundEnabled={settings.soundEnabled}
        onSelectTool={handleSelectTool}
        onSelectColor={handleSelectColor}
        onSelectBrushSize={handleSelectBrushSize}
        onSelectEraserRadius={handleSelectEraserRadius}
        onSelectGridStyle={handleSelectGridStyle}
        onToggleSound={handleToggleSound}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Onboarding & Camera Access Prompt */}
      {showPrompt && (
        <CameraPermissionPrompt
          cameraStatus={cameraStatus}
          errorMessage={errorMessage}
          onStartCamera={handleStartCamera}
          onStartDemo={handleStartDemo}
          onDismiss={() => setShowPrompt(false)}
        />
      )}

      {/* Lazy-Loaded Modals */}
      <Suspense fallback={null}>
        {isGuideOpen && (
          <GestureGuideModal
            isOpen={isGuideOpen}
            onClose={() => setIsGuideOpen(false)}
          />
        )}

        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdateSettings={updateSettings}
            onResetSettings={resetSettings}
          />
        )}

        {isClearModalOpen && (
          <ClearConfirmModal
            isOpen={isClearModalOpen}
            onConfirm={handleConfirmClear}
            onCancel={() => setIsClearModalOpen(false)}
          />
        )}

        {isExportModalOpen && (
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            engine={engineRef.current}
            onNotify={(msg, type) => addToast('Export Canvas', msg, type)}
          />
        )}
      </Suspense>
    </div>
  );
}
