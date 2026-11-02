import React from 'react';
import { X, Sliders, Volume2, VolumeX, Eye, Sparkles, Check, RotateCcw } from 'lucide-react';
import { CanvasSettings, GridStyle } from '../types';
import { soundEffects } from '../services/soundEffects';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CanvasSettings;
  onUpdateSettings: (newSettings: Partial<CanvasSettings>) => void;
  onResetSettings: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Settings & Preferences
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Customize hand tracking, canvas aesthetics, and audio feedback</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Tracking Jitter Smoothing */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
              Gesture Motion Smoothing
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => onUpdateSettings({ smoothing: level })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-all ${
                    settings.smoothing === level
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {level} {level === 'medium' && '(Recommended)'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Higher smoothing eliminates camera tremors; lower smoothing provides instant low-latency flick response.
            </p>
          </div>

          <div className="h-[1px] bg-slate-100"></div>

          {/* Camera FPS Control (30 - 50 FPS) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Camera Target FPS (Speed)
              </label>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                {settings.targetFps || 50} FPS Target
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([30, 45, 50] as const).map((rate) => (
                <button
                  key={rate}
                  onClick={() => onUpdateSettings({ targetFps: rate })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    (settings.targetFps || 50) === rate
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {rate} FPS {rate === 50 ? '(Max Speed)' : rate === 30 ? '(Eco)' : '(Balanced)'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Optimized for 30 to 50 FPS using hardware video frame callbacks on both Mobile and PC.
            </p>
          </div>

          <div className="h-[1px] bg-slate-100"></div>

          {/* Canvas Background Style */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
              Canvas Background
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Dot Grid', style: 'dots' as GridStyle },
                { label: 'Clean White', style: 'blank' as GridStyle },
                { label: 'Notebook', style: 'ruled' as GridStyle },
                { label: 'Graph Grid', style: 'grid' as GridStyle },
                { label: 'Blueprint', style: 'blueprint' as GridStyle },
              ].map((g) => (
                <button
                  key={g.style}
                  onClick={() => onUpdateSettings({ gridStyle: g.style })}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                    settings.gridStyle === g.style
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[1px] bg-slate-100"></div>

          {/* Gesture Coach Assistant Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Gesture Coach</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Display real-time friendly prompts and gesture recognition status near the top.
              </p>
            </div>
            <button
              onClick={() => onUpdateSettings({ showGestureCoach: !settings.showGestureCoach })}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                settings.showGestureCoach
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}
            >
              {settings.showGestureCoach ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="h-[1px] bg-slate-100"></div>

          {/* Hide Camera Video (Trace Hand Only in Blank Area) Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Trace Hand Only (Hide Room Video)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hides your webcam room video in a blank area, displaying only your traced hand skeleton vectors.
              </p>
            </div>
            <button
              onClick={() => onUpdateSettings({ skeletonOnlyMode: !settings.skeletonOnlyMode })}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                settings.skeletonOnlyMode
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {settings.skeletonOnlyMode ? 'Hand Only' : 'Show Video'}
            </button>
          </div>

          <div className="h-[1px] bg-slate-100"></div>

          {/* Palm Eraser Default Radius */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Palm Eraser Radius
              </label>
              <span className="text-xs font-mono font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                {settings.eraserRadius}px
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="4"
              value={settings.eraserRadius}
              onChange={(e) => onUpdateSettings({ eraserRadius: Number(e.target.value) })}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Controls the physical radius cleared when you wipe the board with an open palm.
            </p>
          </div>

          <div className="h-[1px] bg-slate-100"></div>

          {/* Audio Synthesizer Feedback Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Audio Feedback</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Play subtle chimes and whooshes when starting/stopping air drawing and erasing.
              </p>
            </div>
            <button
              onClick={() => {
                const newEnabled = !settings.soundEnabled;
                onUpdateSettings({ soundEnabled: newEnabled });
                soundEffects.setEnabled(newEnabled);
                if (newEnabled) soundEffects.playPop();
              }}
              className={`p-2 rounded-xl border transition-all ${
                settings.soundEnabled
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}
              title={settings.soundEnabled ? 'Mute audio' : 'Unmute audio'}
            >
              {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onResetSettings}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
