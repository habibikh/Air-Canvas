import React from 'react';
import {
  Download,
  HelpCircle,
  Maximize2,
  Minimize2,
  Redo2,
  Settings,
  Trash2,
  Undo2,
  Hand,
  Compass,
} from 'lucide-react';
import { AirCanvasLogo } from './AirCanvasLogo';

interface HeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  isFullscreen: boolean;
  showGestureCoach: boolean;
  skeletonOnlyMode: boolean;
  onToggleCoach: () => void;
  onToggleSkeletonOnly: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  onToggleFullscreen: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  canUndo,
  canRedo,
  isFullscreen,
  showGestureCoach,
  skeletonOnlyMode,
  onToggleCoach,
  onToggleSkeletonOnly,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onToggleFullscreen,
  onOpenGuide,
  onOpenSettings,
}) => {
  return (
    <header className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-30 pointer-events-none flex items-center justify-between gap-3">
      {/* Brand & Hand Only Control */}
      <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 bg-white/90 backdrop-blur-md px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl shadow-sm border border-zinc-200/80 shrink-0">
        <div className="flex items-center gap-2.5 select-none">
          <div className="relative shrink-0">
            <AirCanvasLogo size={32} showGlow={false} animated={false} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-bold tracking-tight text-zinc-900">
              AirCanvas
            </span>
            <span className="text-[10px] text-zinc-500 font-medium hidden md:block leading-none">
              Your ideas, in thin air
            </span>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-zinc-200 shrink-0"></div>

        {/* Hand Only Button */}
        <button
          onClick={onToggleSkeletonOnly}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs ${
            skeletonOnlyMode
              ? 'bg-zinc-900 text-white ring-1 ring-zinc-900/50 hover:bg-zinc-800'
              : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 border border-zinc-200/80'
          }`}
          title={
            skeletonOnlyMode
              ? 'Hand Only mode active (blank room background). Click to show camera feed.'
              : 'Click to enable Hand Only mode: hides camera video and traces hand only on clean canvas'
          }
          aria-label="Toggle Hand Only mode"
        >
          {skeletonOnlyMode ? (
            <>
              <Hand className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>Hand Only</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            </>
          ) : (
            <>
              <Hand className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Hand Only</span>
            </>
          )}
        </button>
      </div>

      {/* Workspace Actions */}
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-zinc-200/80 shrink-0">
        {/* Gesture Coach Toggle */}
        <button
          onClick={onToggleCoach}
          className={`p-2 rounded-xl text-xs font-medium transition-colors ${
            showGestureCoach
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/70'
          }`}
          title={showGestureCoach ? 'Hide Gesture Coach' : 'Show Gesture Coach'}
          aria-label="Toggle Gesture Coach"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Clear Canvas */}
        <button
          onClick={onClear}
          className="p-2 rounded-xl text-zinc-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="Clear Whiteboard"
          aria-label="Clear Whiteboard"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-200 my-1 mx-0.5"></div>

        {/* Export CTA */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition-colors"
          title="Export board as high-res PNG"
          aria-label="Export PNG"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>

        <div className="h-4 w-[1px] bg-zinc-200 my-1 mx-0.5"></div>

        {/* Gesture Guide */}
        <button
          onClick={onOpenGuide}
          className="p-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          title="Gestures Guide (Write, Erase, Pointer, Hold)"
          aria-label="Gesture Guide"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          title="Preferences & Tracking Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="p-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors hidden sm:flex"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
});
