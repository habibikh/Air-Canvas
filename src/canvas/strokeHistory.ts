/**
 * Stroke data structure and undo/redo history manager
 */

import { Stroke, StrokePoint, StrokeTool } from '../types';

export class StrokeHistory {
  private strokes: Stroke[] = [];
  private redoStack: Stroke[] = [];
  private activeStroke: Stroke | null = null;
  private maxHistory: number = 100;

  constructor(maxHistory: number = 100) {
    this.maxHistory = maxHistory;
  }

  /**
   * Start a new stroke (pen or eraser)
   */
  public startStroke(
    tool: StrokeTool,
    color: string,
    size: number,
    startPoint: { x: number; y: number }
  ): Stroke {
    const newStroke: Stroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      tool,
      color,
      size,
      points: [
        {
          x: Math.max(0, Math.min(1, startPoint.x)),
          y: Math.max(0, Math.min(1, startPoint.y)),
          timestamp: Date.now(),
        },
      ],
    };

    this.activeStroke = newStroke;
    // Starting a new stroke clears redo history
    this.redoStack = [];
    return newStroke;
  }

  /**
   * Append a point to the current stroke
   */
  public appendPoint(point: { x: number; y: number }): boolean {
    if (!this.activeStroke) return false;

    const normX = Math.max(0, Math.min(1, point.x));
    const normY = Math.max(0, Math.min(1, point.y));

    const lastPoint = this.activeStroke.points[this.activeStroke.points.length - 1];

    // Filter duplicate or micro-distance points (< 0.001 normalized distance) to avoid redundant vertices
    if (lastPoint) {
      const dist = Math.hypot(normX - lastPoint.x, normY - lastPoint.y);
      if (dist < 0.001) {
        return false;
      }
    }

    this.activeStroke.points.push({
      x: normX,
      y: normY,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Finish the active stroke and commit to history
   */
  public endStroke(): Stroke | null {
    if (!this.activeStroke) return null;

    const stroke = this.activeStroke;
    this.activeStroke = null;

    // Only keep strokes that have points
    if (stroke.points.length > 0) {
      this.strokes.push(stroke);
      if (this.strokes.length > this.maxHistory) {
        this.strokes.shift();
      }
      return stroke;
    }

    return null;
  }

  /**
   * Cancel active stroke without committing
   */
  public cancelActiveStroke() {
    this.activeStroke = null;
  }

  public getActiveStroke(): Stroke | null {
    return this.activeStroke;
  }

  public getStrokes(): Stroke[] {
    return this.strokes;
  }

  public canUndo(): boolean {
    return this.strokes.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): Stroke | null {
    if (this.strokes.length === 0) return null;
    const removed = this.strokes.pop()!;
    this.redoStack.push(removed);
    return removed;
  }

  public redo(): Stroke | null {
    if (this.redoStack.length === 0) return null;
    const restored = this.redoStack.pop()!;
    this.strokes.push(restored);
    return restored;
  }

  public clear(): Stroke[] {
    const previous = [...this.strokes];
    this.strokes = [];
    this.redoStack = [];
    this.activeStroke = null;
    return previous;
  }

  public loadStrokes(strokes: Stroke[]) {
    this.strokes = [...strokes];
    this.redoStack = [];
    this.activeStroke = null;
  }

  public strokeCount(): number {
    return this.strokes.length;
  }
}
