/**
 * Which page numbers a pager should print.
 *
 * A long archive must not print one link per page, but a short run should show
 * every number — a gap among five pages hides nothing and only puzzles the
 * reader. Kept out of the component so the rule is testable on its own and the
 * component and the test cannot drift apart.
 */
export function pageNumbers(
  current: number,
  pageCount: number,
  { window = 2, showAllUpTo = 7 } = {},
): Array<number | 'gap'> {
  if (pageCount <= showAllUpTo) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const out: Array<number | 'gap'> = [];
  for (let n = 1; n <= pageCount; n += 1) {
    if (n === 1 || n === pageCount || Math.abs(n - current) <= window) out.push(n);
    else if (out[out.length - 1] !== 'gap') out.push('gap');
  }
  return out;
}
