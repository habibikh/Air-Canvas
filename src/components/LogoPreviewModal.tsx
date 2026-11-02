import React, { useState } from 'react';
import { X, Download, Copy, Check, Sparkles, Layers, ShieldCheck, Eye } from 'lucide-react';
import { AirCanvasLogo, AIR_CANVAS_SVG_STRING } from './AirCanvasLogo';

interface LogoPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (message: string) => void;
}

export const LogoPreviewModal: React.FC<LogoPreviewModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [backdropTheme, setBackdropTheme] = useState<'dark' | 'light' | 'blueprint' | 'gradient'>('dark');

  if (!isOpen) return null;

  const handleCopySvg = () => {
    navigator.clipboard.writeText(AIR_CANVAS_SVG_STRING);
    setCopied(true);
    if (onNotify) onNotify('Logo SVG copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([AIR_CANVAS_SVG_STRING], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aircanvas-logo.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (onNotify) onNotify('Downloaded aircanvas-logo.svg');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <AirCanvasLogo size="sm" showGlow={false} />
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                Brand Logo & Identity Preview
              </h2>
              <p className="text-[11px] text-slate-500">Official vector identity for AirCanvas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close logo preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Main Hero Showcase */}
          <div
            className={`relative rounded-3xl p-8 flex flex-col items-center justify-center transition-colors min-h-[220px] shadow-inner ${
              backdropTheme === 'dark'
                ? 'bg-slate-950'
                : backdropTheme === 'light'
                ? 'bg-[#fbf8fc] border border-slate-200'
                : backdropTheme === 'blueprint'
                ? 'bg-[#1e293b] bg-[radial-gradient(rgba(56,189,248,0.2)_1px,transparent_1px)] [background-size:20px_20px]'
                : 'bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900'
            }`}
          >
            {/* Ambient Background Aura */}
            <div className="absolute w-44 h-44 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

            {/* Hero Mark */}
            <AirCanvasLogo size={128} showGlow={true} animated={true} />

            {/* Brand Typography */}
            <div className="mt-4 text-center">
              <h3 className={`text-xl font-bold tracking-tight ${backdropTheme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                AirCanvas
              </h3>
              <p className={`text-xs font-medium tracking-wide ${backdropTheme === 'light' ? 'text-slate-500' : 'text-cyan-300/80'}`}>
                YOUR IDEAS, IN THIN AIR.
              </p>
            </div>
          </div>

          {/* Background Theme Switcher */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Preview Backdrop:</span>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'dark', label: 'Dark' },
                { id: 'light', label: 'Canvas' },
                { id: 'blueprint', label: 'Blueprint' },
                { id: 'gradient', label: 'Aura' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setBackdropTheme(theme.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    backdropTheme === theme.id
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size Hierarchy Matrix */}
          <div>
            <span className="text-xs font-semibold text-slate-700 block mb-2.5">Adaptive Scale Hierarchy:</span>
            <div className="grid grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100 items-center justify-items-center">
              <div className="flex flex-col items-center gap-1">
                <AirCanvasLogo size={24} showGlow={false} />
                <span className="text-[10px] text-slate-400 font-mono">24px (Favicon)</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <AirCanvasLogo size={36} showGlow={false} />
                <span className="text-[10px] text-slate-400 font-mono">36px (Nav Bar)</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <AirCanvasLogo size={52} showGlow={true} />
                <span className="text-[10px] text-slate-400 font-mono">52px (App Icon)</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <AirCanvasLogo size={72} showGlow={true} />
                <span className="text-[10px] text-slate-400 font-mono">72px (Splash)</span>
              </div>
            </div>
          </div>

          {/* Design Rationale */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Design Concept: The Aerial Infinity Stroke
            </p>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              The custom lettermark synthesizes the uppercase letter <strong>"A"</strong> with a fluid, continuous 3D ribbon loop drawn in thin air. The radiant cyan spark at coordinate (76, 54) represents the index fingertip tracked with precision machine vision.
            </p>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySvg}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied SVG!' : 'Copy SVG'}</span>
            </button>

            <button
              onClick={handleDownloadSvg}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download SVG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
