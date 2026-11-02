import React from 'react';
import {
  Camera,
  CameraOff,
  Download,
  HelpCircle,
  Maximize2,
  Minimize2,
  Redo2,
  RotateCcw,
  Settings,
  Trash2,
  Undo2,
  Sparkles,
  Compass,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CameraStatus, GestureType } from '../types';
import { AirCanvasLogo } from './AirCanvasLogo';

interface HeaderProps {
  cameraStatus: CameraStatus;
  currentGesture: GestureType;
  fps: number;
  confidence: number;
  isHandDetected: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isFullscreen: boolean;
  showGestureCoach: boolean;
  skeletonOnlyMode: boolean;
  onToggleCamera: () => void;
  onToggleCoach: () => void;
  onToggleSkeletonOnly: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  onToggleFullscreen: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenLogoPreview?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  cameraStatus,
  currentGesture,
  fps,
  confidence,
  isHandDetected,
  canUndo,
  canRedo,
  isFullscreen,
  showGestureCoach,
  skeletonOnlyMode,
  onToggleCamera,
  onToggleCoach,
  onToggleSkeletonOnly,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onToggleFullscreen,
  onOpenGuide,
  onOpenSettings,
  onOpenLogoPreview,
}) => {
  const getGestureBadge = () => {
    switch (currentGesture) {
      case 'draw':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            DRAWING
          </span>
        );
      case 'erase':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            ERASING (PALM)
          </span>
        );
      case 'cursor':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            POINTER (2-FINGERS)
          </span>
        );
      case 'pause':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            PAUSED (FIST)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
            <span className={`w-2 h-2 rounded-full ${cameraStatus === 'active' ? (isHandDetected ? 'bg-cyan-400' : 'bg-slate-300') : 'bg-slate-300'}`}></span>
            {cameraStatus === 'active' ? (isHandDetected ? 'HAND DETECTED' : 'WAITING FOR HAND') : 'STANDBY'}
          </span>
        );
    }
  };

  return (
    <header className="absolute top-3 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-30 pointer-events-none flex items-center justify-between gap-2">
      {/* Brand & Status */}
      <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 glass-panel px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-sm shrink-0">
        <button
          onClick={onOpenLogoPreview}
          className="group flex items-center gap-2 sm:gap-2.5 text-left rounded-xl p-1 -m-1 hover:bg-slate-100/70 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          title="Click to preview brand logo & vector assets"
          aria-label="Preview AirCanvas brand logo"
        >
          <div className="relative shrink-0">
            <AirCanvasLogo size={36} showGlow={true} animated={true} />
            <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">AirCanvas</h1>
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider px-1 sm:px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 hidden sm:inline-block">
                Spatial AI
              </span>
              <span className="text-[9px] font-medium text-indigo-500 bg-indigo-50 px-1 py-0.2 rounded opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline-flex items-center gap-0.5">
                Preview
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium hidden md:block">Your ideas, in thin air.</p>
          </div>
        </button>

        <div className="h-5 sm:h-6 w-[1px] bg-slate-200 mx-0.5 hidden sm:block"></div>

        {/* Dynamic Gesture Pill */}
        <div className="hidden lg:flex items-center">
          {getGestureBadge()}
        </div>

        {/* Camera toggle pill */}
        <button
          onClick={onToggleCamera}
          className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-all ${
            cameraStatus === 'active'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              : cameraStatus === 'requesting'
              ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
          }`}
          title={cameraStatus === 'active' ? 'Turn off camera tracking' : 'Turn on camera tracking'}
          aria-label={cameraStatus === 'active' ? 'Turn off camera' : 'Turn on camera'}
        >
          {cameraStatus === 'active' ? (
            <>
              <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Camera Live</span>
              <span className="text-[10px] text-emerald-600/80 font-mono ml-0.5">{fps} FPS</span>
            </>
          ) : cameraStatus === 'requesting' ? (
            <>
              <Camera className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
              <span className="hidden sm:inline">Starting...</span>
            </>
          ) : (
            <>
              <CameraOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="hidden xs:inline">Camera</span>
            </>
          )}
        </button>

        {/* Hide Camera Video / Blank Area Trace Only Button */}
        {cameraStatus === 'active' && (
          <button
            onClick={onToggleSkeletonOnly}
            className={`px-2 py-1 sm:py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-all ${
              skeletonOnlyMode
                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
            title={skeletonOnlyMode ? 'Camera video is hidden (Traced in blank area) — Click to show video' : 'Hide camera video & trace hand only in blank area'}
            aria-label="Toggle blank area hand trace only"
          >
            {skeletonOnlyMode ? <Eye className="w-3.5 h-3.5 text-indigo-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
            <span className="hidden md:inline">{skeletonOnlyMode ? 'Hand Only' : 'Hide Video'}</span>
          </button>
        )}
      </div>

      {/* Action Controls */}
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 glass-panel p-1 sm:p-1.5 rounded-2xl shadow-sm shrink-0">
        {/* Gesture Coach Toggle */}
        <button
          onClick={onToggleCoach}
          className={`p-2 rounded-xl transition-all ${
            showGestureCoach
              ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title={showGestureCoach ? 'Hide Gesture Coach tips' : 'Show Gesture Coach tips'}
          aria-label="Toggle Gesture Coach"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 disabled:opacity-35 disabled:hover:bg-transparent transition-all"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 disabled:opacity-35 disabled:hover:bg-transparent transition-all"
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-slate-200 my-1"></div>

        {/* Clear Canvas */}
        <button
          onClick={onClear}
          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-all"
          title="Clear Whiteboard"
          aria-label="Clear Whiteboard"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Export PNG */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all shadow-indigo-500/20"
          title="Export as PNG"
          aria-label="Export PNG"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Export</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-200 my-1"></div>

        {/* Gesture Guide */}
        <button
          onClick={onOpenGuide}
          className="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          title="Hand Gesture Guide"
          aria-label="Gesture Guide"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
          title="Canvas & Tracking Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all hidden sm:flex"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
});
