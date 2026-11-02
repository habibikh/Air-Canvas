import React from 'react';
import { X, Edit3, Eraser, PauseCircle, Navigation, Lightbulb, ShieldCheck, Camera } from 'lucide-react';

interface GestureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GestureGuideModal: React.FC<GestureGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              AirCanvas Gesture Guide
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Control your whiteboard in 3D space with natural hand movements</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 4 Core Gestures Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gesture A: Drawing */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 flex flex-col justify-between hover:shadow-sm transition-all">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                    Gesture A
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Edit3 className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900">Draw / Write</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Raise your <strong className="text-indigo-700">index finger</strong> with other fingers folded into a fist. Move your fingertip to write smooth lines in thin air.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-indigo-100/60 flex items-center gap-2 text-[11px] font-medium text-indigo-700">
                <span className="text-base">☝️</span> Index Finger Extended
              </div>
            </div>

            {/* Gesture B: Erase */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100/80 flex flex-col justify-between hover:shadow-sm transition-all">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-rose-600 text-white shadow-sm shadow-rose-600/20">
                    Gesture B
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                    <Eraser className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900">Open Palm Eraser</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Open your <strong className="text-rose-700">entire palm</strong> with fingers spread outward. Move your hand across drawn lines to erase them progressively.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-rose-100/60 flex items-center gap-2 text-[11px] font-medium text-rose-700">
                <span className="text-base">✋</span> All 5 Fingers Extended
              </div>
            </div>

            {/* Gesture C: Fist / Pause */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100/80 flex flex-col justify-between hover:shadow-sm transition-all">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-amber-600 text-white shadow-sm shadow-amber-600/20">
                    Gesture C
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <PauseCircle className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900">Fist / Pause</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Fold all four fingers into a <strong className="text-amber-700">closed fist</strong>. Drawing and erasing instantly pause without leaving marks.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-amber-100/60 flex items-center gap-2 text-[11px] font-medium text-amber-700">
                <span className="text-base">✊</span> Closed Fist
              </div>
            </div>

            {/* Gesture D: Two-Finger Pointer */}
            <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-100/80 flex flex-col justify-between hover:shadow-sm transition-all">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-cyan-600 text-white shadow-sm shadow-cyan-600/20">
                    Gesture D
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600">
                    <Navigation className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900">Pointer Mode</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Raise <strong className="text-cyan-700">both index and middle fingers</strong> (peace sign). Move the cursor freely without drawing to reposition your hand.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-cyan-100/60 flex items-center gap-2 text-[11px] font-medium text-cyan-700">
                <span className="text-base">✌️</span> Index + Middle Fingers
              </div>
            </div>
          </div>

          {/* Pro-Tips & Privacy */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Tracking Tips for Best Experience
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>Position yourself 0.5 to 1.5 meters from your camera.</li>
              <li>Ensure good front-facing lighting so finger outlines are clear.</li>
              <li>Hold your hand in front of your chest or shoulders for natural drawing posture.</li>
              <li>You can also click and drag with your mouse or trackpad anytime!</li>
            </ul>

            <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-[11px] text-emerald-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% Client-Side Privacy: Camera frames are processed strictly in your local browser.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all"
          >
            Got it, let's create!
          </button>
        </div>
      </div>
    </div>
  );
};
