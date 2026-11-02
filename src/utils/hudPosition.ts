/**
 * Utility functions for movable Camera HUD positioning, boundary clamping, and corner docking
 */

export type DockCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-right';

export interface Position {
  x: number;
  y: number;
}

export const HUD_BOUNDS_CONFIG = {
  marginX: 12,
  marginTop: 64, // Space below Header bar
  marginBottom: 88, // Space above bottom Toolbar
};

/**
 * Clamps coordinates within the visible viewport bounds
 */
export function clampHudPosition(
  x: number,
  y: number,
  hudWidth: number,
  hudHeight: number,
  screenWidth: number,
  screenHeight: number,
  config = HUD_BOUNDS_CONFIG
): Position {
  const minX = config.marginX;
  const maxX = Math.max(minX, screenWidth - hudWidth - config.marginX);

  const minY = config.marginTop;
  const maxY = Math.max(minY, screenHeight - hudHeight - config.marginBottom);

  return {
    x: Math.round(Math.max(minX, Math.min(maxX, x))),
    y: Math.round(Math.max(minY, Math.min(maxY, y))),
  };
}

/**
 * Calculates preset corner dock coordinates
 */
export function getCornerDockPosition(
  corner: DockCorner,
  hudWidth: number,
  hudHeight: number,
  screenWidth: number,
  screenHeight: number,
  config = HUD_BOUNDS_CONFIG
): Position {
  switch (corner) {
    case 'top-left':
      return {
        x: config.marginX,
        y: config.marginTop,
      };
    case 'top-right':
      return {
        x: Math.max(config.marginX, screenWidth - hudWidth - config.marginX),
        y: config.marginTop,
      };
    case 'bottom-left':
      return {
        x: config.marginX,
        y: Math.max(config.marginTop, screenHeight - hudHeight - config.marginBottom),
      };
    case 'bottom-right':
      return {
        x: Math.max(config.marginX, screenWidth - hudWidth - config.marginX),
        y: Math.max(config.marginTop, screenHeight - hudHeight - config.marginBottom),
      };
    case 'center-right':
      return {
        x: Math.max(config.marginX, screenWidth - hudWidth - config.marginX),
        y: Math.max(config.marginTop, Math.round((screenHeight - hudHeight) / 2)),
      };
  }
}
