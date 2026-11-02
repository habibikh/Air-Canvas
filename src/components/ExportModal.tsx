import React, { useState, useEffect } from 'react';
import { Download, X, Copy, Check, Sparkles, Image as ImageIcon, Layers, Eye, Grid } from 'lucide-react';
import { DrawingEngine, ExportOptions } from '../canvas/drawingEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: DrawingEngine | null;
  onNotify: (msg: string, type?: 'info' | 'success') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  engine,
  onNotify,
}) => {
  // Background selection: with background vs without background (transparent)
  const [hasBackground, setHasBackground] = useState<boolean>(true);
  // Sub-option when background is enabled: clean solid white vs current board grid
  const [backgroundStyle, setBackgroundStyle] = useState<'white' | 'grid'>('white');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !engine) return;

    const opts: ExportOptions = hasBackground
      ? {
          transparentBackground: false,
          backgroundWhite: backgroundStyle === 'white',
          includeGrid: backgroundStyle === 'grid',
        }
      : {
          transparentBackground: true,
          backgroundWhite: false,
          includeGrid: false,
        };

    const dataUrl = engine.exportToPNG(opts);
    setPreviewUrl(dataUrl);
  }, [isOpen, hasBackground, backgroundStyle, engine]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!engine) return;
    setIsExporting(true);

    const suffix = hasBackground
      ? backgroundStyle === 'grid'
        ? 'grid'
        : 'white'
      : 'transparent';

    const filename = `AirCanvas-${suffix}-${new Date().toISOString().slice(0, 10)}.png`;

    const opts: ExportOptions = hasBackground
      ? {
          transparentBackground: false,
          backgroundWhite: backgroundStyle === 'white',
          includeGrid: backgroundStyle === 'grid',
        }
      : {
          transparentBackground: true,
          backgroundWhite: false,
          includeGrid: false,
        };

    engine.downloadPNG(filename, opts);
    setIsExporting(false);
    onNotify(
      hasBackground
        ? 'PNG exported with canvas background!'
        : 'Transparent PNG exported without background!',
      'success'
    );
    onClose();
  };

  const handleCopy = async () => {
    if (!previewUrl) return;
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      onNotify(
        hasBackground
          ? 'Image copied with background!'
          : 'Transparent image copied without background!',
        'success'
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('Clipboard copy not supported in this browser. Please download PNG.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Export Canvas</h3>
              <p className="text-[11px] text-slate-500">Choose with or without background</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close export modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Main Option 1: With Background vs Without Background */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Background Option
            </label>
            <div className="grid grid-cols-2 gap-2">
              {/* Option A: With Background */}
              <button
                type="button"
                onClick={() => setHasBackground(true)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  hasBackground
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    hasBackground ? 'bg-white/15 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">With Background</span>
                    {hasBackground && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p
                    className={`text-[10px] mt-0.5 leading-snug ${
                      hasBackground ? 'text-zinc-300' : 'text-slate-500'
                    }`}
                  >
                    Solid white canvas or board grid pattern
                  </p>
                </div>
              </button>

              {/* Option B: Without Background (Transparent) */}
              <button
                type="button"
                onClick={() => setHasBackground(false)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  !hasBackground
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    !hasBackground ? 'bg-white/15 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">Without Background</span>
                    {!hasBackground && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p
                    className={`text-[10px] mt-0.5 leading-snug ${
                      !hasBackground ? 'text-zinc-300' : 'text-slate-500'
                    }`}
                  >
                    Transparent PNG (writing only, no background)
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Sub-selector for Background Style when "With Background" is active */}
          {hasBackground ? (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 animate-fade-in">
              <span className="text-xs font-medium text-slate-700">Background Style:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('white')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    backgroundStyle === 'white'
                      ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Solid White</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('grid')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    backgroundStyle === 'grid'
                      ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Grid className="w-3 h-3 text-emerald-600" />
                  <span>Board Grid</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-2xl bg-cyan-50/80 border border-cyan-200/80 flex items-center gap-2 text-xs text-cyan-900 animate-fade-in">
              <ImageIcon className="w-4 h-4 text-cyan-600 shrink-0" />
              <span className="text-[11px] leading-tight font-medium">
                Transparent PNG: Only your ink strokes are saved. Perfect for pasting into slides, dark mode, or Google Docs!
              </span>
            </div>
          )}

          {/* Live High-Res Image Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Eye className="w-3 h-3" /> Live Preview
              </span>
              <span>{hasBackground ? (backgroundStyle === 'white' ? 'White Background' : 'Board Grid') : 'Transparent (No Background)'}</span>
            </div>

            <div
              className={`relative w-full h-44 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner ${
                !hasBackground ? 'checkerboard-bg' : 'bg-slate-100/50'
              }`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Whiteboard export preview"
                  className="max-w-full max-h-full object-contain shadow-xs"
                />
              ) : (
                <span className="text-xs text-slate-400">Rendering preview...</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            Format: PNG (Lossless Full-HD)
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy PNG'}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{hasBackground ? 'Download with Background' : 'Download without Background'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
