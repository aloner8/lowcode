import type { ComponentNode } from '@/types';

/**
 * Helpers over a component tree that must run on both the server and the
 * client, so they deliberately live outside any `'use client'` module.
 */

/** True when the tree already renders an `<h1>`, so a page should not add one. */
export function treeHasHeading(nodes: ComponentNode[]): boolean {
  return nodes.some((node) => {
    const content = node.props?.content;
    if (typeof content === 'string' && /<h1\b/i.test(content)) return true;
    if (node.children?.length) return treeHasHeading(node.children);
    return false;
  });
}

/** Flattens a tree into a single list, depth-first. */
export function flattenTree(nodes: ComponentNode[]): ComponentNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children ?? [])]);
}
