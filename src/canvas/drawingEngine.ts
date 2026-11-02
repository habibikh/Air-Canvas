/**
 * High-performance, high-DPI HTML Canvas drawing engine for AirCanvas
 */

import { GridStyle, Stroke, StrokePoint } from '../types';
import { StrokeHistory } from './strokeHistory';

export interface RenderOptions {
  gridStyle: GridStyle;
  backgroundColor?: string;
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

  constructor(canvas: HTMLCanvasElement, history: StrokeHistory) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { willReadFrequently: false });
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }
    this.ctx = context;
    this.history = history;
    this.handleResize();
  }

  public setGridStyle(style: GridStyle) {
    this.gridStyle = style;
    this.requestRender();
  }

  public handleResize() {
    const parent = this.canvas.parentElement;
    const clientWidth = parent ? parent.clientWidth : window.innerWidth;
    const clientHeight = parent ? parent.clientHeight : window.innerHeight;

    this.dpr = window.devicePixelRatio || 1;
    this.width = clientWidth;
    this.height = clientHeight;

    this.canvas.width = Math.floor(clientWidth * this.dpr);
    this.canvas.height = Math.floor(clientHeight * this.dpr);
    this.canvas.style.width = `${clientWidth}px`;
    this.canvas.style.height = `${clientHeight}px`;

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
   * Render all committed strokes and active stroke
   */
  public render() {
    const { ctx, canvas, dpr, width, height } = this;
    if (width === 0 || height === 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background grid if selected
    this.drawBackgroundGrid(ctx, width, height, this.gridStyle);

    // Render all saved strokes
    const strokes = this.history.getStrokes();
    for (let i = 0; i < strokes.length; i++) {
      this.renderStroke(ctx, strokes[i], width, height);
    }

    // Render active stroke in progress
    const activeStroke = this.history.getActiveStroke();
    if (activeStroke) {
      this.renderStroke(ctx, activeStroke, width, height);
    }

    ctx.restore();
  }

  /**
   * Draw background grid (dots, lines, or blueprint)
   */
  private drawBackgroundGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: GridStyle
  ) {
    if (style === 'blank') return;

    ctx.save();
    if (style === 'blueprint') {
      ctx.fillStyle = '#1e293b'; // Slate 800 background
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)'; // Cyan grid lines
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
      // Lined notebook paper background for handwriting practice
      ctx.fillStyle = '#fdfbf7'; // Warm notebook tint
      ctx.fillRect(0, 0, width, height);

      // Pink left margin line
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
      // 24px interval dot grid
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
    }
    ctx.restore();
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
      // If blueprint style, erase with blueprint background color, otherwise destination-out
      if (this.gridStyle === 'blueprint') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#1e293b';
      } else if (this.gridStyle === 'ruled') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#fdfbf7';
      } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
      }
    } else if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size * 2.2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }

    const p0 = points[0];
    const pLast = points[points.length - 1];

    if (points.length === 1) {
      // Single tap dot
      const px = p0.x * width;
      const py = p0.y * height;
      ctx.beginPath();
      ctx.arc(px, py, stroke.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.tool === 'eraser' ? (this.gridStyle === 'blueprint' ? '#1e293b' : 'rgba(0,0,0,1)') : stroke.color;
      ctx.fill();
      ctx.restore();
      return;
    }

    // Specialized shape tools
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
      const rectX = Math.min(x1, x2);
      const rectY = Math.min(y1, y2);
      const rectW = Math.abs(x2 - x1);
      const rectH = Math.abs(y2 - y1);
      ctx.beginPath();
      ctx.rect(rectX, rectY, rectW, rectH);
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
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
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

      // Draw final segment
      ctx.lineTo(pLast.x * width, pLast.y * height);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Export the whiteboard drawing to high-resolution PNG
   */
  public exportToPNG(options: { includeGrid?: boolean; backgroundWhite?: boolean } = {}): string {
    const { includeGrid = false, backgroundWhite = true } = options;
    const exportCanvas = document.createElement('canvas');
    const expWidth = Math.max(1920, this.width);
    const expHeight = Math.max(1080, Math.round((expWidth * this.height) / this.width));

    exportCanvas.width = expWidth;
    exportCanvas.height = expHeight;
    const expCtx = exportCanvas.getContext('2d');
    if (!expCtx) return '';

    // Draw background
    if (this.gridStyle === 'blueprint') {
      expCtx.fillStyle = '#1e293b';
      expCtx.fillRect(0, 0, expWidth, expHeight);
    } else if (backgroundWhite) {
      expCtx.fillStyle = '#ffffff';
      expCtx.fillRect(0, 0, expWidth, expHeight);
    }

    if (includeGrid) {
      this.drawBackgroundGrid(expCtx, expWidth, expHeight, this.gridStyle);
    }

    // Render strokes with proportional scale
    const strokes = this.history.getStrokes();
    for (const stroke of strokes) {
      // Adjust stroke size proportionally for high-res export
      const scaledStroke: Stroke = {
        ...stroke,
        size: stroke.size * (expWidth / this.width),
      };
      this.renderStroke(expCtx, scaledStroke, expWidth, expHeight);
    }

    return exportCanvas.toDataURL('image/png');
  }

  public downloadPNG(filename: string = `AirCanvas-${new Date().toISOString().slice(0, 10)}.png`) {
    const dataUrl = this.exportToPNG({ includeGrid: true, backgroundWhite: true });
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
