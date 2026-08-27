import { describe, expect, it } from 'vitest';

/**
 * How an article picks up its listing page's furniture.
 *
 * Mirrors the split in the site route: everything before the first content
 * section is the head, everything after the last one is the tail. Taking the
 * first and last chrome node instead worked only while a page had exactly two.
 */
interface Node { id: string; type: string; props?: Record<string, unknown> }

const isChrome = (node: Node) =>
  node.type === 'NavMenuComponent' || node.props?.__chrome === true;

function splitChrome(tree: Node[]) {
  const firstContent = tree.findIndex((node) => !isChrome(node));
  const lastContent = tree.map(isChrome).lastIndexOf(false);
  return {
    head: firstContent === -1 ? tree : tree.slice(0, firstContent),
    tail: firstContent === -1 ? [] : tree.slice(lastContent + 1).filter(isChrome),
  };
}

const chrome = (id: string): Node => ({ id, type: 'X', props: { __chrome: true } });
const content = (id: string): Node => ({ id, type: 'PostListComponent' });

describe('splitChrome', () => {
  it('keeps every chrome node, not just the first and the last', () => {
    const { head, tail } = splitChrome([
      chrome('topbar'), chrome('header'),
      content('body'),
      chrome('footer'), chrome('dock'), chrome('notices'), chrome('cookie'),
    ]);
    expect(head.map((n) => n.id)).toEqual(['topbar', 'header']);
    expect(tail.map((n) => n.id)).toEqual(['footer', 'dock', 'notices', 'cookie']);
  });

  it('treats a legacy nav node as chrome even without the marker', () => {
    const { head } = splitChrome([
      { id: 'nav', type: 'NavMenuComponent' },
      content('body'),
      chrome('footer'),
    ]);
    expect(head.map((n) => n.id)).toEqual(['nav']);
  });

  it('spans several content sections rather than stopping at the first', () => {
    const { head, tail } = splitChrome([
      chrome('header'), content('a'), content('b'), content('c'), chrome('footer'),
    ]);
    expect(head.map((n) => n.id)).toEqual(['header']);
    expect(tail.map((n) => n.id)).toEqual(['footer']);
  });

  it('returns everything as head when the page is chrome only', () => {
    const { head, tail } = splitChrome([chrome('header'), chrome('footer')]);
    expect(head).toHaveLength(2);
    expect(tail).toHaveLength(0);
  });

  it('gives an empty head when the page opens with content', () => {
    const { head, tail } = splitChrome([content('body'), chrome('footer')]);
    expect(head).toHaveLength(0);
    expect(tail.map((n) => n.id)).toEqual(['footer']);
  });
});
