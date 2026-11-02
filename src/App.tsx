/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasSettings, GridStyle, StrokeTool, ToastMessage } from './types';
import { useHandTracking } from './hooks/useHandTracking';
import { StrokeHistory } from './canvas/strokeHistory';
import { DrawingEngine } from './canvas/drawingEngine';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Whiteboard } from './components/Whiteboard';
import { WebcamPreview } from './components/WebcamPreview';
import { GestureGuideModal } from './components/GestureGuideModal';
import { SettingsModal } from './components/SettingsModal';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { LogoPreviewModal } from './components/LogoPreviewModal';
import { CameraPermissionPrompt } from './components/CameraPermissionPrompt';
import { ExportModal } from './components/ExportModal';
import { GestureCoach } from './components/GestureCoach';
import { ToastContainer } from './components/Toast';
import { soundEffects } from './services/soundEffects';

const STORAGE_KEY = 'aircanvas_settings_v2';

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
  showGestureCoach: true,
  showCursorTrail: true,
  targetFps: 35,
  skeletonOnlyMode: false,
};

export default function App() {
  // Settings with localStorage persistence
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

  // Sync target FPS to tracking service
  useEffect(() => {
    import('./services/handTrackingService').then(({ handTrackingService }) => {
      handTrackingService.setTargetMaxFps(settings.targetFps || 35);
    });
  }, [settings.targetFps]);

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

  // Tool states
  const [currentTool, setCurrentTool] = useState<StrokeTool>('pen');
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Modals state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isLogoPreviewOpen, setIsLogoPreviewOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Toast notifications state
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

  // Onboarding prompt state
  const [showPrompt, setShowPrompt] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return false;
      }
    }
    return true;
  });

  // Canvas and Engine instances
  const strokeHistoryRef = useRef<StrokeHistory>(new StrokeHistory(150));
  const engineRef = useRef<DrawingEngine | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Hand tracking hook
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

  // Handle camera start with error checking
  const handleStartCamera = useCallback(async () => {
    if (videoRef.current) {
      const res = await startCamera(videoRef.current);
      if (res.success) {
        setShowPrompt(false);
        addToast('Camera Live', 'Index finger draws, open palm erases', 'success');
      } else {
        addToast('Camera Unavailable', res.error || 'Please connect a webcam or try Demo Mode', 'warning');
      }
    }
  }, [startCamera, addToast]);

  // Handle interactive demo simulation
  const handleStartDemo = useCallback(() => {
    startDemoSimulation();
    setShowPrompt(false);
    addToast('Interactive Demo Live', 'Simulating index-finger drawing and palm erasing cycle', 'info');
  }, [startDemoSimulation, addToast]);

  const handleToggleCamera = useCallback(async () => {
    if (cameraStatus === 'active') {
      stopCamera();
      addToast('Camera Inactive', 'Air tracking stopped. Mouse/touch is still active.', 'info');
    } else {
      if (videoRef.current) {
        const res = await startCamera(videoRef.current);
        if (res.success) {
          addToast('Camera Live', 'Gesture tracking active', 'success');
        } else {
          addToast('Camera Unavailable', res.error || 'Check camera permissions or use Demo Mode', 'warning');
        }
      }
    }
  }, [cameraStatus, startCamera, stopCamera, addToast]);

  // Undo / Redo actions
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

  // Clear action
  const handleConfirmClear = useCallback(() => {
    strokeHistoryRef.current.clear();
    soundEffects.playPop();
    engineRef.current?.invalidateCache();
    engineRef.current?.requestRender();
    syncUndoRedo();
    setIsClearModalOpen(false);
    addToast('Whiteboard Cleared', 'Press Ctrl+Z if you want to undo', 'warning');
  }, [syncUndoRedo, addToast]);

  // Open Export Modal
  const handleOpenExport = useCallback(() => {
    soundEffects.playPop();
    setIsExportModalOpen(true);
  }, []);

  // Audio Toggle
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

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  }, []);

  // Keyboard shortcuts
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
      } else if (e.key.toLowerCase() === 'h') {
        setCurrentTool('highlighter');
      } else if (e.key.toLowerCase() === 'e') {
        setCurrentTool('eraser');
      } else if (e.key === '?') {
        setIsGuideOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Sync fullscreen change event
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Toggle Skeleton Only (Hide Video in Blank Area)
  const handleToggleSkeletonOnly = useCallback(() => {
    const next = !settings.skeletonOnlyMode;
    updateSettings({ skeletonOnlyMode: next });
    soundEffects.playPop();
    addToast(
      next ? 'Hand Traced Only' : 'Camera Video Visible',
      next ? 'Camera room background hidden in blank area' : 'Live webcam feed restored',
      'info'
    );
  }, [settings.skeletonOnlyMode, updateSettings, addToast]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#fbf8fc] text-[#1b1b1e]">
      {/* Top Application Header */}
      <Header
        cameraStatus={cameraStatus}
        currentGesture={currentGesture}
        fps={fps}
        confidence={confidence}
        isHandDetected={isHandDetected}
        canUndo={canUndo}
        canRedo={canRedo}
        isFullscreen={isFullscreen}
        showGestureCoach={settings.showGestureCoach}
        skeletonOnlyMode={settings.skeletonOnlyMode}
        onToggleCamera={handleToggleCamera}
        onToggleCoach={() => updateSettings({ showGestureCoach: !settings.showGestureCoach })}
        onToggleSkeletonOnly={handleToggleSkeletonOnly}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={() => setIsClearModalOpen(true)}
        onExport={handleOpenExport}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLogoPreview={() => setIsLogoPreviewOpen(true)}
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
        videoRef={videoRef}
        registerFrameListener={registerFrameListener}
      />

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
        onSelectTool={(tool) => {
          setCurrentTool(tool);
          soundEffects.playPop();
        }}
        onSelectColor={(color) => {
          updateSettings({ brushColor: color });
          soundEffects.playPop();
        }}
        onSelectBrushSize={(size) => updateSettings({ brushSize: size })}
        onSelectEraserRadius={(radius) => updateSettings({ eraserRadius: radius })}
        onSelectGridStyle={(style) => {
          updateSettings({ gridStyle: style });
          soundEffects.playPop();
          addToast('Background Updated', `Switched to ${style}`, 'info');
        }}
        onToggleSound={handleToggleSound}
      />

      {/* Real-Time Gesture Coach Assistant */}
      {settings.showGestureCoach && (
        <GestureCoach
          cameraStatus={cameraStatus}
          currentGesture={currentGesture}
          isHandDetected={isHandDetected}
          onOpenGuide={() => setIsGuideOpen(true)}
          onDismiss={() => updateSettings({ showGestureCoach: false })}
        />
      )}

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

      {/* Gesture Guide Modal */}
      <GestureGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onResetSettings={resetSettings}
      />

      {/* Clear Confirmation Modal */}
      <ClearConfirmModal
        isOpen={isClearModalOpen}
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearModalOpen(false)}
      />

      {/* Brand Logo & Identity Preview Modal */}
      <LogoPreviewModal
        isOpen={isLogoPreviewOpen}
        onClose={() => setIsLogoPreviewOpen(false)}
        onNotify={(msg) => addToast('Logo Asset', msg, 'success')}
      />

      {/* Export Canvas Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        engine={engineRef.current}
        onNotify={(msg, type) => addToast('Export Canvas', msg, type)}
      />
    </div>
  );
}
