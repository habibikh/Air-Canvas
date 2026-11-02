import React, { useState } from 'react';
import { Sparkles, X, ChevronRight, CheckCircle2, Hand, Info } from 'lucide-react';
import { CameraStatus, GestureType } from '../types';

interface GestureCoachProps {
  cameraStatus: CameraStatus;
  currentGesture: GestureType;
  isHandDetected: boolean;
  onOpenGuide: () => void;
  onDismiss: () => void;
}

export const GestureCoach: React.FC<GestureCoachProps> = ({
  cameraStatus,
  currentGesture,
  isHandDetected,
  onOpenGuide,
  onDismiss,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const getCoachMessage = () => {
    if (cameraStatus !== 'active') {
      if (cameraStatus === 'denied') {
        return {
          icon: '🛡️',
          title: 'Mouse & Touch Mode Active',
          subtitle: 'Camera access is blocked in browser settings. You can draw freely with mouse/touch or retry permissions.',
          accent: 'border-amber-200 bg-amber-50/95 text-amber-900',
        };
      }
      return {
        icon: '🖱️',
        title: 'Mouse & Touch Ready',
        subtitle: 'Click and drag on the board, or click "Start Camera" to write in thin air!',
        accent: 'border-indigo-200 bg-white/95 text-slate-800',
      };
    }

    if (!isHandDetected) {
      return {
        icon: '👋',
        title: 'Show your hand to the camera',
        subtitle: 'Hold your hand up in front of the webcam to begin tracking.',
        accent: 'border-cyan-200 bg-cyan-50/95 text-cyan-900',
      };
    }

    switch (currentGesture) {
      case 'draw':
        return {
          icon: '☝️',
          title: 'Writing Active',
          subtitle: 'Move your index finger to sketch in thin air. Curl fingers to pause.',
          accent: 'border-indigo-300 bg-indigo-50/95 text-indigo-900',
        };
      case 'erase':
        return {
          icon: '✋',
          title: 'Palm Eraser Active',
          subtitle: 'Move your open hand over strokes to progressively erase them.',
          accent: 'border-rose-300 bg-rose-50/95 text-rose-900',
        };
      case 'cursor':
        return {
          icon: '✌️',
          title: 'Pointer Mode',
          subtitle: 'Two fingers raised: move the reticle without leaving marks.',
          accent: 'border-cyan-300 bg-cyan-50/95 text-cyan-900',
        };
      case 'pause':
        return {
          icon: '✊',
          title: 'Paused (Fist)',
          subtitle: 'All fingers curled: drawing and erasing safely paused.',
          accent: 'border-amber-300 bg-amber-50/95 text-amber-900',
        };
      default:
        return {
          icon: '✨',
          title: 'Hand Tracked',
          subtitle: 'Raise index finger to write, open palm to erase, or fist to pause.',
          accent: 'border-slate-200 bg-white/95 text-slate-800',
        };
    }
  };

  const info = getCoachMessage();

  if (isMinimized) {
    return (
      <div className="absolute top-20 left-4 z-20 pointer-events-auto">
        <button
          onClick={() => setIsMinimized(false)}
          className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-all shadow-md hover:scale-105"
          title="Open Gesture Coach"
        >
          <span className="text-sm">{info.icon}</span>
          <span>Gesture Coach</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-18 sm:top-20 left-2 sm:left-4 z-20 pointer-events-auto max-w-xs sm:max-w-sm animate-fade-in">
      <div className={`p-3 rounded-2xl border shadow-lg backdrop-blur-md transition-all ${info.accent}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="text-xl shrink-0 mt-0.5">{info.icon}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold tracking-tight">{info.title}</h4>
              </div>
              <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{info.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors"
              title="Minimize coach"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors"
              title="Close coach"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between text-[10px]">
          <span className="opacity-70 font-medium">Want quick visual cards?</span>
          <button
            onClick={onOpenGuide}
            className="font-bold underline text-indigo-700 hover:text-indigo-900 transition-colors flex items-center gap-0.5"
          >
            Open Guide <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
