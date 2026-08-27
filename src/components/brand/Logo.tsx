import React from 'react';

interface LogoProps {
  /** Height in pixels; the mark stays square and the wordmark scales with it. */
  readonly size?: number;
  /** Hide the wordmark and render the square mark only. */
  readonly markOnly?: boolean;
  /** Wordmark colour — use 'light' on dark backgrounds. */
  readonly tone?: 'dark' | 'light';
  readonly className?: string;
}

/**
 * MATCHANU logo.
 *
 * Inlined rather than loaded as an <img> so it inherits the page's colour
 * scheme and never flashes before the asset arrives. Gradient ids are suffixed
 * per instance so several logos on one page cannot collide.
 */
export function Logo({ size = 36, markOnly = false, tone = 'dark', className = '' }: LogoProps) {
  const id = React.useId().replace(/:/g, '');
  const wordColor = tone === 'light' ? '#FFFFFF' : '#0B1F3A';
  const subColor = tone === 'light' ? 'rgba(255,255,255,0.65)' : '#5A6473';

  return (
    <span className={`d-inline-flex align-items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={markOnly ? 'MATCHANU' : undefined}
        aria-hidden={markOnly ? undefined : true}
        focusable="false"
      >
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0C58A9" />
            <stop offset="0.55" stopColor="#0B4485" />
            <stop offset="1" stopColor="#083A6E" />
          </linearGradient>
          <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF3A3" />
            <stop offset="0.45" stopColor="#FFD700" />
            <stop offset="1" stopColor="#D89000" />
          </linearGradient>
        </defs>

        <rect width="64" height="64" rx="15" fill={`url(#bg-${id})`} />
        {/* Peaks read as an M; the sweep beneath reads as Matchanu's tail. */}
        <path
          d="M13 44.5 L23.5 21.5 L32 34 L40.5 21.5 L51 44.5"
          fill="none"
          stroke={`url(#gold-${id})`}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 51.5 Q32 45.5 44 51.5"
          fill="none"
          stroke={`url(#gold-${id})`}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>

      {!markOnly && (
        <span className="d-inline-flex flex-column lh-1">
          <span style={{ color: wordColor, fontSize: size * 0.44, fontWeight: 700, letterSpacing: '0.06em' }}>
            MATCHANU
          </span>
          <span style={{ color: subColor, fontSize: size * 0.2, letterSpacing: '0.18em', marginTop: 2 }}>
            LOW-CODE PLATFORM
          </span>
        </span>
      )}
    </span>
  );
}
