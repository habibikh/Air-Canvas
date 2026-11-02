/**
 * High-performance, multi-layered HTML Canvas drawing engine for AirCanvas
 * Completely isolates ink from background so eraser strokes NEVER punch holes
 * or leave visible marks in the canvas or exported PNG.
 */

import { GridStyle, Stroke, StrokePoint } from '../types';
import { StrokeHistory } from './strokeHistory';

export interface ExportOptions {
  includeGrid?: boolean;
  backgroundWhite?: boolean;
  transparentBackground?: boolean;
  scale?: number;
}

export class DrawingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private history: StrokeHistory;
  private dpr: number = 1;
  private width: number = 0;
  private height: number = 0;
  private isRenderingRequested: boolean = false;
  private gridStyle: GridStyle = 'dots';

  // 1. Background layer canvas (cached grid / ruled / blueprint / white)
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private isBgDirty: boolean = true;

  // 2. Pure Ink layer canvas (transparent background, contains only ink + destination-out erasers)
  private inkCanvas: HTMLCanvasElement;
  private inkCtx: CanvasRenderingContext2D;
  private isInkDirty: boolean = true;

  // 3. Scratch layer for rendering active real-time eraser without redrawing all history
  private scratchCanvas: HTMLCanvasElement;
  private scratchCtx: CanvasRenderingContext2D;

  // 4. Pre-composited background + ink layer for single-blit 60 FPS drawing
  private compositeCanvas: HTMLCanvasElement;
  private compositeCtx: CanvasRenderingContext2D;
  private isCompositeDirty: boolean = true;

  constructor(canvas: HTMLCanvasElement, history: StrokeHistory) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { willReadFrequently: false, alpha: false });
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }
    this.ctx = context;
    this.history = history;

    // Background canvas
    this.bgCanvas = document.createElement('canvas');
    const bg = this.bgCanvas.getContext('2d', { willReadFrequently: false, alpha: false });
    if (!bg) throw new Error('Background canvas 2D context not available');
    this.bgCtx = bg;

    // Ink canvas (must have alpha: true to support transparent background and destination-out)
    this.inkCanvas = document.createElement('canvas');
    const ink = this.inkCanvas.getContext('2d', { willReadFrequently: false, alpha: true });
    if (!ink) throw new Error('Ink canvas 2D context not available');
    this.inkCtx = ink;

    // Scratch canvas for active eraser compositing
    this.scratchCanvas = document.createElement('canvas');
    const scratch = this.scratchCanvas.getContext('2d', { willReadFrequently: false, alpha: true });
    if (!scratch) throw new Error('Scratch canvas 2D context not available');
    this.scratchCtx = scratch;

    // Composite canvas for 1-blit render during active drawing
    this.compositeCanvas = document.createElement('canvas');
    const comp = this.compositeCanvas.getContext('2d', { willReadFrequently: false, alpha: false });
    if (!comp) throw new Error('Composite canvas 2D context not available');
    this.compositeCtx = comp;

    this.handleResize();
  }

  public setGridStyle(style: GridStyle) {
    if (this.gridStyle !== style) {
      this.gridStyle = style;
      this.isBgDirty = true;
      this.isCompositeDirty = true;
      this.requestRender();
    }
  }

  public invalidateCache() {
    this.isInkDirty = true;
    this.isCompositeDirty = true;
    this.requestRender();
  }

  public handleResize() {
    const parent = this.canvas.parentElement;
    const clientWidth = parent ? parent.clientWidth : window.innerWidth;
    const clientHeight = parent ? parent.clientHeight : window.innerHeight;

    if (clientWidth <= 0 || clientHeight <= 0) return;

    const isMobile =
      typeof navigator !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        clientWidth < 768);

    // DPR capped at 1.5x (1.25x on mobile) for razor-sharp visuals while cutting memory by 50-60%
    this.dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);
    this.width = clientWidth;
    this.height = clientHeight;

    const scaledW = Math.max(1, Math.floor(clientWidth * this.dpr));
    const scaledH = Math.max(1, Math.floor(clientHeight * this.dpr));

    this.canvas.width = scaledW;
    this.canvas.height = scaledH;
    this.canvas.style.width = `${clientWidth}px`;
    this.canvas.style.height = `${clientHeight}px`;

    this.bgCanvas.width = scaledW;
    this.bgCanvas.height = scaledH;

    this.inkCanvas.width = scaledW;
    this.inkCanvas.height = scaledH;

    this.scratchCanvas.width = scaledW;
    this.scratchCanvas.height = scaledH;

    this.compositeCanvas.width = scaledW;
    this.compositeCanvas.height = scaledH;

    this.isBgDirty = true;
    this.isInkDirty = true;
    this.isCompositeDirty = true;
    this.requestRender();
  }

  public requestRender() {
    if (this.isRenderingRequested) return;
    this.isRenderingRequested = true;

    requestAnimationFrame(() => {
      this.isRenderingRequested = false;
      this.render();
    });
  }

  /**
   * Rebuilds the background canvas (grid / pattern)
   */
  private rebuildBackground() {
    const { bgCtx: ctx, dpr, width, height } = this;
    if (width === 0 || height === 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    this.drawBackgroundGrid(ctx, width, height, this.gridStyle);
    ctx.restore();

    this.isBgDirty = false;
    this.isCompositeDirty = true;
  }

  /**
   * Rebuilds the committed ink layer.
   * Renders committed ink strokes with source-over and eraser strokes with destination-out.
   * Because inkCanvas is isolated and transparent, destination-out erases ONLY the ink.
   * It never touches the background or leaves white/black marks.
   */
  private rebuildInk() {
    const { inkCtx: ctx, dpr, width, height } = this;
    if (width === 0 || height === 0) return;

    // Clear ink canvas to completely transparent
    ctx.clearRect(0, 0, this.inkCanvas.width, this.inkCanvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    const strokes = this.history.getStrokes();
    for (let i = 0; i < strokes.length; i++) {
      this.renderStroke(ctx, strokes[i], width, height);
    }

    ctx.restore();
    this.isInkDirty = false;
    this.isCompositeDirty = true;
  }

  /**
   * Merges background and committed ink onto compositeCanvas
   * Done only when background or committed ink changes, NEVER on active stroke frames!
   */
  private rebuildComposite() {
    this.compositeCtx.drawImage(this.bgCanvas, 0, 0);
    this.compositeCtx.drawImage(this.inkCanvas, 0, 0);
    this.isCompositeDirty = false;
  }

  /**
   * Ultra-fast 60 FPS composite render:
   * 1. 1 GPU blit of pre-composited (background + ink) canvas
   * 2. Render only the active stroke currently in progress
   */
  public render() {
    const { ctx, dpr, width, height } = this;
    if (width === 0 || height === 0) return;

    if (this.isBgDirty) {
      this.rebuildBackground();
    }
    if (this.isInkDirty) {
      this.rebuildInk();
    }
    if (this.isCompositeDirty) {
      this.rebuildComposite();
    }

    const activeStroke = this.history.getActiveStroke();

    // 1. Single GPU blit of pre-composited canvas (no active stroke)
    if (!activeStroke) {
      ctx.drawImage(this.compositeCanvas, 0, 0);
      return;
    }

    // 2. Active stroke is an eraser: apply onto scratch and composite
    if (activeStroke.tool === 'eraser') {
      const sCtx = this.scratchCtx;
      sCtx.clearRect(0, 0, this.scratchCanvas.width, this.scratchCanvas.height);
      sCtx.drawImage(this.inkCanvas, 0, 0);

      sCtx.save();
      sCtx.scale(dpr, dpr);
      this.renderStroke(sCtx, activeStroke, width, height);
      sCtx.restore();

      ctx.drawImage(this.bgCanvas, 0, 0);
      ctx.drawImage(this.scratchCanvas, 0, 0);
      return;
    }

    // 3. Active stroke is a drawing tool (pen/highlighter/shape):
    // Single blit of composite canvas + draw active stroke on top!
    ctx.drawImage(this.compositeCanvas, 0, 0);

    ctx.save();
    ctx.scale(dpr, dpr);
    this.renderStroke(ctx, activeStroke, width, height);
    ctx.restore();
  }

  /**
   * Draw background grid (clean white, dots, lines, ruled, or blueprint)
   */
  private drawBackgroundGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: GridStyle
  ) {
    if (style === 'blueprint') {
      ctx.fillStyle = '#1e293b'; // Slate 800
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)'; // Cyan grid
      ctx.lineWidth = 1;
      const step = 28;
      ctx.beginPath();
      for (let x = 0; x <= width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    } else if (style === 'grid') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      const step = 24;
      ctx.beginPath();
      for (let x = 0; x <= width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    } else if (style === 'ruled') {
      ctx.fillStyle = '#fdfbf7'; // Warm notebook tint
      ctx.fillRect(0, 0, width, height);

      // Pink left margin
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(64, 0);
      ctx.lineTo(64, height);
      ctx.stroke();

      // Horizontal ruled lines
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      const lineSpacing = 32;
      ctx.beginPath();
      for (let y = lineSpacing * 2; y <= height; y += lineSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    } else if (style === 'dots') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#cbd5e1';
      const step = 24;
      const radius = 1.25;
      for (let x = step; x < width; x += step) {
        for (let y = step; y < height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Blank clean white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
  }

  /**
   * Render a single stroke with smooth quadratic curve interpolation or shape geometry
   */
  private renderStroke(
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    width: number,
    height: number
  ) {
    const points = stroke.points;
    if (!points || points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.size;

    if (stroke.tool === 'eraser') {
      // Pure destination-out erasing: reduces ink opacity to 0
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    } else if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size * 2.2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = stroke.color;
    }

    const p0 = points[0];
    const pLast = points[points.length - 1];

    if (points.length === 1) {
      // Single dot tap
      const px = p0.x * width;
      const py = p0.y * height;
      ctx.beginPath();
      ctx.arc(px, py, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Specialized geometry shapes
    if (stroke.tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(p0.x * width, p0.y * height);
      ctx.lineTo(pLast.x * width, pLast.y * height);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (stroke.tool === 'rectangle') {
      const x1 = p0.x * width;
      const y1 = p0.y * height;
      const x2 = pLast.x * width;
      const y2 = pLast.y * height;
      ctx.beginPath();
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (stroke.tool === 'circle') {
      const x1 = p0.x * width;
      const y1 = p0.y * height;
      const x2 = pLast.x * width;
      const y2 = pLast.y * height;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.max(1, Math.abs(x2 - x1) / 2);
      const ry = Math.max(1, Math.abs(y2 - y1) / 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Freehand pen & highlighter with quadratic bezier curve interpolation
    ctx.beginPath();
    ctx.moveTo(p0.x * width, p0.y * height);

    if (points.length === 2) {
      const p1 = points[1];
      ctx.lineTo(p1.x * width, p1.y * height);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];

        const currX = curr.x * width;
        const currY = curr.y * height;
        const nextX = next.x * width;
        const nextY = next.y * height;

        const midX = (currX + nextX) / 2;
        const midY = (currY + nextY) / 2;

        ctx.quadraticCurveTo(currX, currY, midX, midY);
      }

      ctx.lineTo(pLast.x * width, pLast.y * height);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Export the whiteboard drawing to clean PNG.
   *
   * Crucial Fix for Eraser Marks:
   * 1. Render all strokes onto an isolated transparent ink layer. Erasers apply with destination-out,
   *    erasing only the ink without touching any background.
   * 2. Composite that isolated ink layer onto a clean opaque background (or leave transparent).
   * Result: ONLY the visible writings exist. ZERO eraser marks, ZERO transparent holes or white streaks.
   */
  public exportToPNG(options: ExportOptions = {}): string {
    const {
      includeGrid = false,
      backgroundWhite = true,
      transparentBackground = false,
    } = options;

    const exportWidth = Math.max(1920, this.width || 1920);
    const exportHeight = Math.max(1080, Math.round((exportWidth * (this.height || 1080)) / (this.width || 1920)));

    // Step 1: Create isolated high-resolution ink canvas (alpha: true)
    const inkExportCanvas = document.createElement('canvas');
    inkExportCanvas.width = exportWidth;
    inkExportCanvas.height = exportHeight;
    const inkExpCtx = inkExportCanvas.getContext('2d', { alpha: true });
    if (!inkExpCtx) return '';

    // Render all strokes onto isolated ink layer
    const strokes = this.history.getStrokes();
    const scaleFactor = exportWidth / (this.width || exportWidth);

    for (const stroke of strokes) {
      const scaledStroke: Stroke = {
        ...stroke,
        size: stroke.size * scaleFactor,
      };
      this.renderStroke(inkExpCtx, scaledStroke, exportWidth, exportHeight);
    }

    // Step 2: Create final export canvas
    const finalExportCanvas = document.createElement('canvas');
    finalExportCanvas.width = exportWidth;
    finalExportCanvas.height = exportHeight;
    const finalCtx = finalExportCanvas.getContext('2d', { alpha: !backgroundWhite || transparentBackground });
    if (!finalCtx) return '';

    // Step 3: Draw background (if not transparent)
    if (!transparentBackground) {
      if (includeGrid) {
        if (this.gridStyle === 'blueprint') {
          finalCtx.fillStyle = '#1e293b';
          finalCtx.fillRect(0, 0, exportWidth, exportHeight);
        } else if (this.gridStyle === 'ruled') {
          finalCtx.fillStyle = '#fdfbf7';
          finalCtx.fillRect(0, 0, exportWidth, exportHeight);
        } else {
          finalCtx.fillStyle = '#ffffff';
          finalCtx.fillRect(0, 0, exportWidth, exportHeight);
        }
        this.drawBackgroundGrid(finalCtx, exportWidth, exportHeight, this.gridStyle);
      } else {
        // Pristine solid white canvas background
        finalCtx.fillStyle = '#ffffff';
        finalCtx.fillRect(0, 0, exportWidth, exportHeight);
      }
    }

    // Step 4: Composite clean ink on top with source-over
    // Because the erased parts on inkExportCanvas have alpha 0, they do not affect the background at all!
    finalCtx.drawImage(inkExportCanvas, 0, 0);

    return finalExportCanvas.toDataURL('image/png');
  }

  public downloadPNG(
    filename: string = `AirCanvas-${new Date().toISOString().slice(0, 10)}.png`,
    options: ExportOptions = { includeGrid: false, backgroundWhite: true }
  ) {
    const dataUrl = this.exportToPNG(options);
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
