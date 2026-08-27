import type { ComponentNode } from '@/types';
import type { SiteRuntime } from '@/lib/seo/siteSeo';

/**
 * Prefixes a site's internal links when it is reached through the mother.
 *
 * A site stores its links as root-relative paths (`/news`), which is right on
 * its own domain. Reached at `/app/<slug>` on the control plane, every one of
 * those links pointed at the control plane's own root instead — the whole menu
 * 404'd. The prefix is applied at render time rather than stored, so the same
 * page works on both hosts without duplicating the content.
 */

/** Left alone: framework assets, other origins, anchors and non-http schemes. */
const isInternalPath = (value: string) =>
  value.startsWith('/')
  && !value.startsWith('//')
  && !value.startsWith('/_next')
  && !value.startsWith('/api/');

/** `''` on the site's own host, `/app/<slug>` when served by the mother. */
export function siteBasePath(runtime: SiteRuntime, host?: string): string {
  /*
   * A site process serves exactly one site, whatever host the visitor typed —
   * `localhost:33001` reaches it as readily as its own domain. Matching on the
   * domain list alone prefixed every link with `/app/<slug>` there, and the
   * whole menu 404'd on the site's own port.
   */
  if (process.env.SITE_SLUG?.trim() === runtime.appSlug) return '';

  const hostname = host?.split(':')[0].trim().toLowerCase() ?? '';
  if (!hostname) return `/app/${runtime.appSlug}`;

  const own = [runtime.primaryDomain, ...runtime.domains]
    .filter(Boolean)
    .map((domain) => domain.toLowerCase());

  return own.includes(hostname) ? '' : `/app/${runtime.appSlug}`;
}

export const withBasePath = (basePath: string, value: string) =>
  basePath && isInternalPath(value) ? `${basePath}${value === '/' ? '' : value}` || '/' : value;

/** Props that hold a link, across every component that renders one. */
const LINK_KEYS = new Set(['href', 'url', 'moreHref', 'link', 'to', 'action']);

function rewriteValue(basePath: string, key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    return LINK_KEYS.has(key) ? withBasePath(basePath, value) : value;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteValue(basePath, key, item));
  if (value && typeof value === 'object') return rewriteProps(basePath, value as Record<string, unknown>);
  return value;
}

function rewriteProps(basePath: string, props: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    output[key] = rewriteValue(basePath, key, value);
  }
  return output;
}

/**
 * Returns a copy of the tree with every internal link prefixed.
 *
 * `content` holds author-written HTML, so its `href="/..."` attributes are
 * rewritten too — otherwise a hand-written footer link would still escape.
 */
export function applyBasePath(nodes: ComponentNode[], basePath: string): ComponentNode[] {
  if (!basePath) return nodes;

  const rewriteHtml = (html: string) =>
    html.replace(/(\shref=")(\/[^"]*)(")/g, (match, before: string, path: string, after: string) =>
      isInternalPath(path) ? `${before}${withBasePath(basePath, path)}${after}` : match);

  const visit = (node: ComponentNode): ComponentNode => {
    const props = node.props ? rewriteProps(basePath, node.props) : node.props;
    if (props && typeof props.content === 'string') {
      props.content = rewriteHtml(props.content);
    }
    return {
      ...node,
      props,
      children: node.children?.map(visit),
    };
  };

  return nodes.map(visit);
}
