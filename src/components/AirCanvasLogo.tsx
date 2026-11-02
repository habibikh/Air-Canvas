import React from 'react';

interface AirCanvasLogoProps {
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showGlow?: boolean;
  animated?: boolean;
}

export const AirCanvasLogo: React.FC<AirCanvasLogoProps> = ({
  size = 'md',
  className = '',
  showGlow = true,
  animated = false,
}) => {
  const pixelSize = typeof size === 'number'
    ? size
    : size === 'sm'
    ? 28
    : size === 'md'
    ? 36
    : size === 'lg'
    ? 56
    : 96;

  const id = React.useId();
  const gradId = `aircanvas-grad-${id.replace(/:/g, '')}`;
  const glowId = `aircanvas-glow-${id.replace(/:/g, '')}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full ${animated ? 'hover:scale-105 transition-transform duration-300' : ''}`}
      >
        <defs>
          {/* Main dynamic gradient: Deep Indigo -> Electric Violet -> Radiant Cyan */}
          <linearGradient id={gradId} x1="12" y1="88" x2="88" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3730a3" />
            <stop offset="28%" stopColor="#4f46e5" />
            <stop offset="65%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          {/* Fingertip radiant spark gradient */}
          <radialGradient id={`${gradId}-spark`} cx="78" cy="22" r="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>

          {/* Ambient Glow Filter */}
          {showGlow && (
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          )}
        </defs>

        {/* Ambient background aura (optional) */}
        {showGlow && (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="url(#aircanvas-grad)"
            opacity="0.12"
            filter={`url(#${glowId})`}
          />
        )}

        {/* Squircle App Icon Base */}
        <rect
          x="6"
          y="6"
          width="88"
          height="88"
          rx="24"
          fill="#0f172a"
          className="shadow-inner"
        />

        {/* Subtle grid lines inside badge */}
        <path
          d="M6 34 H94 M6 66 H94 M34 6 V94 M66 6 V94"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth="1"
        />

        {/* The Continuous Aerial "A" Ribbon Stroke */}
        {/* Begins from lower left, loops up through the drawing apex, curls down and forms the horizontal bridge */}
        <path
          d="M24 74 C24 50, 40 22, 54 22 C66 22, 78 36, 78 52 C78 68, 62 76, 44 76 C28 76, 30 52, 48 52 C62 52, 76 54, 76 54"
          stroke={`url(#${gradId})`}
          strokeWidth="8.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={showGlow ? `url(#${glowId})` : undefined}
        />

        {/* Inner high-contrast core light vector */}
        <path
          d="M26 72 C26 52, 42 24, 54 24 C64 24, 76 38, 76 52 C76 66, 62 74, 46 74 C32 74, 34 54, 48 54 C60 54, 74 55, 74 55"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Fingertip Spatial Spark & Landmark Reticle */}
        {/* Active drawing point at the apex */}
        <circle cx="76" cy="54" r="5" fill="#ffffff" />
        <circle cx="76" cy="54" r="8" stroke="#38bdf8" strokeWidth="1.5" opacity="0.85" />
        <circle cx="76" cy="54" r="14" fill={`url(#${gradId}-spark)`} opacity="0.6" />

        {/* Origin gesture spark at top apex */}
        <circle cx="54" cy="22" r="3" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>
  );
};

export const AIR_CANVAS_SVG_STRING = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="aircanvas-grad" x1="12" y1="88" x2="88" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3730a3"/>
      <stop offset="28%" stop-color="#4f46e5"/>
      <stop offset="65%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <radialGradient id="aircanvas-spark" cx="78" cy="22" r="16" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#4f46e5" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="6" y="6" width="88" height="88" rx="24" fill="#0f172a"/>
  <path d="M6 34 H94 M6 66 H94 M34 6 V94 M66 6 V94" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1"/>
  <path d="M24 74 C24 50, 40 22, 54 22 C66 22, 78 36, 78 52 C78 68, 62 76, 44 76 C28 76, 30 52, 48 52 C62 52, 76 54, 76 54" stroke="url(#aircanvas-grad)" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M26 72 C26 52, 42 24, 54 24 C64 24, 76 38, 76 52 C76 66, 62 74, 46 74 C32 74, 34 54, 48 54 C60 54, 74 55, 74 55" stroke="rgba(255, 255, 255, 0.45)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="76" cy="54" r="5" fill="#ffffff"/>
  <circle cx="76" cy="54" r="8" stroke="#38bdf8" stroke-width="1.5" opacity="0.85"/>
  <circle cx="54" cy="22" r="3" fill="#ffffff" opacity="0.9"/>
</svg>`;
