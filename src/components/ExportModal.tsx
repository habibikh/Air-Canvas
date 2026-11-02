import React, { useState, useEffect } from 'react';
import { Download, X, Copy, Check, Sparkles, Image as ImageIcon, Eye } from 'lucide-react';
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
  const [exportType, setExportType] = useState<'clean' | 'transparent' | 'grid'>('clean');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !engine) return;

    let opts: ExportOptions = { includeGrid: false, backgroundWhite: true };
    if (exportType === 'transparent') {
      opts = { transparentBackground: true, backgroundWhite: false };
    } else if (exportType === 'grid') {
      opts = { includeGrid: true, backgroundWhite: true };
    }

    const dataUrl = engine.exportToPNG(opts);
    setPreviewUrl(dataUrl);
  }, [isOpen, exportType, engine]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!engine) return;
    const filename = `AirCanvas-Writing-${new Date().toISOString().slice(0, 10)}.png`;
    let opts: ExportOptions = { includeGrid: false, backgroundWhite: true };
    if (exportType === 'transparent') {
      opts = { transparentBackground: true, backgroundWhite: false };
    } else if (exportType === 'grid') {
      opts = { includeGrid: true, backgroundWhite: true };
    }

    engine.downloadPNG(filename, opts);
    onNotify('PNG Downloaded! Only clean writing included.', 'success');
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
      onNotify('Copied image to clipboard!', 'success');
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Export Canvas</h3>
              <p className="text-[11px] text-slate-500">Only clean writing and drawings are exported (zero eraser marks)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Format selector */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setExportType('clean')}
              className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                exportType === 'clean'
                  ? 'bg-indigo-50/80 border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Clean White</span>
              <span className="text-[9px] font-normal text-indigo-600/80">Writing Only</span>
            </button>

            <button
              onClick={() => setExportType('transparent')}
              className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                exportType === 'transparent'
                  ? 'bg-indigo-50/80 border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-cyan-600" />
              <span>Transparent</span>
              <span className="text-[9px] font-normal text-slate-500">No Background</span>
            </button>

            <button
              onClick={() => setExportType('grid')}
              className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                exportType === 'grid'
                  ? 'bg-indigo-50/80 border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>With Grid</span>
              <span className="text-[9px] font-normal text-slate-500">Board Style</span>
            </button>
          </div>

          {/* Clean Writing Guarantee Notice */}
          <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex items-center gap-2 text-xs text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] leading-tight font-medium">
              Multi-layer ink isolation active: All eraser paths are completely subtracted. Only actual strokes are saved.
            </span>
          </div>

          {/* Live High-Res Image Preview Box */}
          <div className="relative w-full h-44 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-100/70 checkerboard-bg shadow-inner">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Whiteboard preview"
                className="max-w-full max-h-full object-contain shadow-sm"
              />
            ) : (
              <span className="text-xs text-slate-400">Rendering preview...</span>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy PNG'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download High-Res PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
