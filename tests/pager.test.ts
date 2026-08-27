import { describe, expect, it } from 'vitest';
import { pageNumbers } from '@/lib/site/pageNumbers';

describe('pageNumbers', () => {
  it('lists every page when the run is short', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the first and last page reachable from the middle', () => {
    const out = pageNumbers(20, 40);
    expect(out[0]).toBe(1);
    expect(out[out.length - 1]).toBe(40);
    expect(out).toContain(20);
  });

  it('collapses long stretches into a single gap', () => {
    const out = pageNumbers(20, 40);
    expect(out.filter((n) => n === 'gap')).toHaveLength(2);
    expect(out.length).toBeLessThan(12);
  });

  it('never puts two gaps together', () => {
    const out = pageNumbers(30, 60);
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i] === 'gap' && out[i - 1] === 'gap').toBe(false);
    }
  });

  it('opens with no leading gap on the first pages', () => {
    expect(pageNumbers(1, 40).slice(0, 4)).toEqual([1, 2, 3, 'gap']);
  });

  it('closes with no trailing gap on the last pages', () => {
    expect(pageNumbers(40, 40).slice(-4)).toEqual(['gap', 38, 39, 40]);
  });
});
