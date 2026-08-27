import { describe, expect, it } from 'vitest';
import { buildGovPalette, luminance, parseHex, readableOn, shade } from '@/lib/theme/palette';

describe('parseHex', () => {
  it('reads both short and long form', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('D91113')).toEqual([217, 17, 19]);
  });

  it('refuses anything it cannot read rather than guessing', () => {
    expect(parseHex('red')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
  });
});

describe('shade', () => {
  it('darkens towards black and lightens towards white', () => {
    expect(shade('#808080', -1)).toBe('#000000');
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', 0)).toBe('#808080');
  });

  it('returns the input untouched when it is not a colour', () => {
    expect(shade('inherit', -0.5)).toBe('inherit');
  });
});

describe('readableOn', () => {
  it('puts white on dark grounds and near-black on light ones', () => {
    expect(readableOn('#063b7a')).toBe('#ffffff');
    expect(readableOn('#d91113')).toBe('#ffffff');
    expect(readableOn('#ffd700')).toBe('#1a1a1a');
    expect(readableOn('#ffffff')).toBe('#1a1a1a');
  });

  it('uses relative luminance, which ranks green above red', () => {
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#ff0000'));
  });
});

describe('buildGovPalette', () => {
  it('derives a full set from the two seeds', () => {
    const palette = buildGovPalette({ primary: '#d91113', secondary: '#063b7a' });
    expect(palette['--gov-primary']).toBe('#d91113');
    expect(palette['--gov-secondary']).toBe('#063b7a');
    expect(palette['--gov-primary-rgb']).toBe('217, 17, 19');
    expect(palette['--gov-primary-dark']).not.toBe(palette['--gov-primary']);
  });

  it('keeps gold fixed — it is the shared accent, not a per-agency choice', () => {
    const red = buildGovPalette({ primary: '#d91113' });
    const green = buildGovPalette({ primary: '#1f5c3d' });
    expect(red['--gov-gold']).toBe('#ffd700');
    expect(green['--gov-gold']).toBe(red['--gov-gold']);
  });

  it('falls back to a valid palette when the seed is unusable', () => {
    expect(buildGovPalette({ primary: 'not-a-colour' })['--gov-primary']).toBe('#d91113');
  });

  it('states the text colour for gold, which white fails against', () => {
    expect(buildGovPalette({ primary: '#d91113' })['--gov-on-gold']).toBe('#3a2a00');
  });
});
