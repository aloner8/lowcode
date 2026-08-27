import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * Apple touch icon.
 *
 * iOS only accepts a raster icon, so the SVG mark is rasterised at build time
 * rather than shipping a hand-exported PNG that could drift from the source.
 * It is drawn on a solid tile because iOS gives the icon square corners of
 * its own.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0C58A9 0%, #0B4485 55%, #083A6E 100%)',
        }}
      >
        <svg width="128" height="128" viewBox="0 0 64 64">
          <path
            d="M13 44.5 L23.5 21.5 L32 34 L40.5 21.5 L51 44.5"
            fill="none"
            stroke="#FFD700"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 51.5 Q32 45.5 44 51.5"
            fill="none"
            stroke="#F2B705"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
