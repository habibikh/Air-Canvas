import React, { useState } from 'react';
import {
  Edit3,
  Highlighter,
  Eraser,
  Square,
  Circle as CircleIcon,
  Minus,
  Shapes,
  Volume2,
  VolumeX,
  Check,
  ChevronUp,
} from 'lucide-react';
import { GridStyle, StrokeTool } from '../types';

interface ToolbarProps {
  currentTool: StrokeTool;
  brushColor: string;
  brushSize: number;
  eraserRadius: number;
  gridStyle: GridStyle;
  soundEnabled: boolean;
  onSelectTool: (tool: StrokeTool) => void;
  onSelectColor: (color: string) => void;
  onSelectBrushSize: (size: number) => void;
  onSelectEraserRadius: (radius: number) => void;
  onSelectGridStyle: (style: GridStyle) => void;
  onToggleSound: () => void;
}

export const PRESET_COLORS = [
  { name: 'Electric Indigo', hex: '#4f46e5' },
  { name: 'Neon Violet', hex: '#8b5cf6' },
  { name: 'Vibrant Cyan', hex: '#06b6d4' },
  { name: 'Emerald Green', hex: '#10b981' },
  { name: 'Sunny Amber', hex: '#f59e0b' },
  { name: 'Fluorescent Yellow', hex: '#facc15' },
  { name: 'Coral Rose', hex: '#f43f5e' },
  { name: 'Slate Black', hex: '#1e293b' },
];

export const BRUSH_SIZES = [
  { label: 'Fine', size: 3 },
  { label: 'Medium', size: 6 },
  { label: 'Thick', size: 12 },
  { label: 'Bold', size: 24 },
  { label: 'Marker', size: 36 },
];

export const ERASER_SIZES = [
  { label: 'Small', size: 24 },
  { label: 'Medium', size: 48 },
  { label: 'Large', size: 80 },
];

export const GRID_OPTIONS: { label: string; style: GridStyle }[] = [
  { label: 'Dot Grid', style: 'dots' },
  { label: 'Clean White', style: 'blank' },
  { label: 'Notebook Ruled', style: 'ruled' },
  { label: 'Graph Grid', style: 'grid' },
  { label: 'Blueprint', style: 'blueprint' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  brushColor,
  brushSize,
  eraserRadius,
  gridStyle,
  soundEnabled,
  onSelectTool,
  onSelectColor,
  onSelectBrushSize,
  onSelectEraserRadius,
  onSelectGridStyle,
  onToggleSound,
}) => {
  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);
  const isShapeTool = ['line', 'rectangle', 'circle'].includes(currentTool);

  return (
    <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[calc(100vw-16px)]">
      {/* Floating Shape Selection Popover */}
      {showShapeMenu && (
        <div className="absolute bottom-full mb-2 left-12 glass-panel p-1.5 rounded-2xl shadow-xl flex items-center gap-1 animate-fade-in">
          <button
            onClick={() => {
              onSelectTool('line');
              setShowShapeMenu(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentTool === 'line' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Line</span>
          </button>

          <button
            onClick={() => {
              onSelectTool('rectangle');
              setShowShapeMenu(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentTool === 'rectangle' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Rectangle</span>
          </button>

          <button
            onClick={() => {
              onSelectTool('circle');
              setShowShapeMenu(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentTool === 'circle' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <CircleIcon className="w-3.5 h-3.5" />
            <span>Circle</span>
          </button>
        </div>
      )}

      <div className="glass-panel px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl flex items-center gap-1.5 sm:gap-2.5 shadow-xl shadow-slate-900/5 overflow-x-auto max-w-full">
        {/* Tool Selectors */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl shrink-0">
          {/* Pen */}
          <button
            onClick={() => {
              onSelectTool('pen');
              setShowShapeMenu(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTool === 'pen'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
            title="Pen (Air gesture: 1 extended finger)"
            aria-label="Pen tool"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Pen</span>
          </button>

          {/* Highlighter */}
          <button
            onClick={() => {
              onSelectTool('highlighter');
              setShowShapeMenu(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTool === 'highlighter'
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
            title="Highlighter (Semi-transparent stroke)"
            aria-label="Highlighter tool"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Highlight</span>
          </button>

          {/* Shapes Dropdown */}
          <button
            onClick={() => setShowShapeMenu(!showShapeMenu)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isShapeTool
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
            title="Shapes (Line, Rectangle, Circle)"
            aria-label="Shapes tool"
          >
            <Shapes className="w-3.5 h-3.5" />
            <ChevronUp className={`w-3 h-3 transition-transform ${showShapeMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Eraser */}
          <button
            onClick={() => {
              onSelectTool('eraser');
              setShowShapeMenu(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTool === 'eraser'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
            title="Eraser (Air gesture: Open palm)"
            aria-label="Eraser tool"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Eraser</span>
          </button>
        </div>

        <div className="h-5 sm:h-6 w-[1px] bg-slate-200 shrink-0"></div>

        {/* Color Palette (Active when drawing or highlighting) */}
        {currentTool !== 'eraser' ? (
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => onSelectColor(c.hex)}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative ${
                  brushColor === c.hex ? 'ring-2 ring-indigo-500 ring-offset-2 scale-105' : ''
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
                aria-label={`Select color ${c.name}`}
              >
                {brushColor === c.hex && (
                  <Check className={`w-3.5 h-3.5 ${['#ffffff', '#facc15'].includes(c.hex) ? 'text-slate-900' : 'text-white'}`} />
                )}
              </button>
            ))}
          </div>
        ) : (
          /* Eraser Size Selector */
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <span className="text-xs text-slate-500 font-medium px-1 hidden md:inline">Eraser Size:</span>
            {ERASER_SIZES.map((es) => (
              <button
                key={es.size}
                onClick={() => onSelectEraserRadius(es.size)}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  eraserRadius === es.size
                    ? 'bg-rose-100 text-rose-700 font-semibold ring-1 ring-rose-300'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {es.label} ({es.size}px)
              </button>
            ))}
          </div>
        )}

        <div className="h-5 sm:h-6 w-[1px] bg-slate-200 shrink-0 hidden sm:block"></div>

        {/* Brush Size Selector */}
        {currentTool !== 'eraser' && (
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {BRUSH_SIZES.map((b) => (
              <button
                key={b.size}
                onClick={() => onSelectBrushSize(b.size)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  brushSize === b.size
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                    : 'hover:bg-slate-100 text-slate-500'
                }`}
                title={`${b.label} (${b.size}px)`}
                aria-label={`${b.label} brush size`}
              >
                <span
                  className="rounded-full bg-current transition-all"
                  style={{
                    width: `${Math.min(18, Math.max(4, b.size * 0.7))}px`,
                    height: `${Math.min(18, Math.max(4, b.size * 0.7))}px`,
                  }}
                />
              </button>
            ))}
          </div>
        )}

        <div className="h-5 sm:h-6 w-[1px] bg-slate-200 shrink-0 hidden lg:block"></div>

        {/* Grid Background Picker */}
        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {GRID_OPTIONS.map((g) => (
            <button
              key={g.style}
              onClick={() => onSelectGridStyle(g.style)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                gridStyle === g.style
                  ? 'bg-slate-200/90 text-slate-800 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title={`Switch canvas to ${g.label}`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="h-5 sm:h-6 w-[1px] bg-slate-200 shrink-0"></div>

        {/* Quick Audio Mute / Unmute Button */}
        <button
          onClick={onToggleSound}
          className={`p-1.5 sm:p-2 rounded-xl transition-all shrink-0 ${
            soundEnabled
              ? 'text-indigo-600 hover:bg-indigo-50'
              : 'text-slate-400 hover:bg-slate-100'
          }`}
          title={soundEnabled ? 'Mute audio feedback' : 'Unmute audio feedback'}
          aria-label="Toggle audio feedback"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
