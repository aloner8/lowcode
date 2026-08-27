/**
 * Builds a government site palette from two seed colours.
 *
 * A site's identity comes from its own emblem, so the theme carries only the
 * two seeds and the shades are derived here. Without this the stylesheet has to
 * hard-code every tint, which is exactly how the sheet ended up green while the
 * theme said red — the colours had no single source.
 *
 * Gold is fixed across every agency: it is the shared accent of Thai government
 * sites, not a per-agency choice.
 */

export interface GovSeeds {
  /** The agency's identity colour, from its emblem. */
  primary: string;
  /** The formal colour — footers, official sections. Defaults to the deep blue. */
  secondary?: string;
}

const GOLD = {
  '--gov-gold-light': '#fff3a3',
  '--gov-gold': '#ffd700',
  '--gov-gold-mid': '#f2b705',
  '--gov-gold-dark': '#d89000',
  '--gov-gold-soft': '#fff7c2',
  /* White on gold is about 1.5:1. Text on gold is always this brown. */
  '--gov-on-gold': '#3a2a00',
} as const;

const DEFAULT_SECONDARY = '#063b7a';

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

/** Accepts `#rgb` and `#rrggbb`; anything else is refused rather than guessed. */
export function parseHex(input: string): [number, number, number] | null {
  const value = input.trim().replace(/^#/, '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const toHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((channel) => clamp(channel).toString(16).padStart(2, '0')).join('')}`;

/** Mixes towards black (negative) or white (positive) by `amount` of 0..1. */
export function shade(color: string, amount: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const target = amount >= 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  return toHex(rgb.map((channel) => channel + (target - channel) * ratio) as [number, number, number]);
}

export function rgbChannels(color: string): string {
  const rgb = parseHex(color);
  return rgb ? rgb.join(', ') : '0, 0, 0';
}

/**
 * Relative luminance, for deciding whether text on this colour should be white
 * or near-black. Follows the WCAG definition rather than a brightness average,
 * which gets green badly wrong.
 */
export function luminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White text needs a reasonably dark ground; below this it is unreadable. */
export const readableOn = (color: string): string => (luminance(color) > 0.45 ? '#1a1a1a' : '#ffffff');

export function buildGovPalette(seeds: GovSeeds): Record<string, string> {
  const primary = parseHex(seeds.primary) ? seeds.primary : '#d91113';
  const secondary = seeds.secondary && parseHex(seeds.secondary) ? seeds.secondary : DEFAULT_SECONDARY;

  return {
    '--gov-primary': primary,
    '--gov-primary-dark': shade(primary, -0.35),
    '--gov-primary-darker': shade(primary, -0.55),
    '--gov-primary-light': shade(primary, 0.25),
    '--gov-primary-soft': shade(primary, 0.92),
    '--gov-primary-rgb': rgbChannels(primary),
    '--gov-on-primary': readableOn(primary),

    '--gov-secondary': secondary,
    '--gov-secondary-dark': shade(secondary, -0.35),
    '--gov-secondary-light': shade(secondary, 0.25),
    '--gov-secondary-soft': shade(secondary, 0.92),
    '--gov-secondary-rgb': rgbChannels(secondary),
    '--gov-on-secondary': readableOn(secondary),

    ...GOLD,
  };
}

/** `style` attribute value, so the colours are in the server-rendered HTML. */
export const paletteStyle = (seeds: GovSeeds): React.CSSProperties =>
  buildGovPalette(seeds) as unknown as React.CSSProperties;
