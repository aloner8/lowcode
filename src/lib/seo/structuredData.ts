import type { ComponentNode } from '@/types';
import type { SitePage, SiteRuntime } from './siteSeo';

/**
 * Schema.org JSON-LD.
 *
 * Emitted server-side alongside the page so search engines can read the
 * organisation, the site, the breadcrumb trail and any article content without
 * executing JavaScript.
 */

export type JsonLdNode = Record<string, unknown>;

export function organizationSchema(runtime: SiteRuntime, baseUrl: string): JsonLdNode {
  const contact = runtime.seo.contact ?? {};

  return {
    '@type': runtime.seo.organizationType || 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: runtime.seo.siteName,
    url: baseUrl,
    ...(runtime.seo.ogImage ? { logo: absoluteUrl(runtime.seo.ogImage, baseUrl) } : {}),
    ...(runtime.seo.description ? { description: runtime.seo.description } : {}),
    ...(contact.telephone || contact.email
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            ...(contact.telephone ? { telephone: contact.telephone } : {}),
            ...(contact.email ? { email: contact.email } : {}),
            ...(runtime.seo.language ? { availableLanguage: runtime.seo.language } : {}),
          },
        }
      : {}),
    ...(contact.streetAddress || contact.addressLocality
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(contact.streetAddress ? { streetAddress: contact.streetAddress } : {}),
            ...(contact.addressLocality ? { addressLocality: contact.addressLocality } : {}),
            ...(contact.addressRegion ? { addressRegion: contact.addressRegion } : {}),
            ...(contact.postalCode ? { postalCode: contact.postalCode } : {}),
            addressCountry: contact.addressCountry ?? 'TH',
          },
        }
      : {}),
  };
}

export function websiteSchema(runtime: SiteRuntime, baseUrl: string): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    name: runtime.seo.siteName,
    url: baseUrl,
    ...(runtime.seo.description ? { description: runtime.seo.description } : {}),
    inLanguage: runtime.seo.language,
    publisher: { '@id': `${baseUrl}/#organization` },
  };
}

export function webPageSchema(
  runtime: SiteRuntime,
  page: SitePage,
  baseUrl: string,
  path: string,
): JsonLdNode {
  const url = `${baseUrl}${path === '/' ? '' : path}`;
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.seo.title || page.title,
    ...(page.seo.description || runtime.seo.description
      ? { description: page.seo.description || runtime.seo.description }
      : {}),
    isPartOf: { '@id': `${baseUrl}/#website` },
    inLanguage: runtime.seo.language,
    dateModified: page.updatedAt,
  };
}

/**
 * An article, for the search result that shows a headline, date and image.
 * `NewsArticle` rather than `Article`: these are government announcements.
 */
export function articleSchema(
  runtime: SiteRuntime,
  post: { title: string; body: string; image: string | null; publishedAt: string | null; updatedAt: string | null; categoryName: string | null },
  baseUrl: string,
  path: string,
): JsonLdNode {
  const url = `${baseUrl}${path}`;
  const summary = post.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

  return {
    '@type': 'NewsArticle',
    '@id': `${url}#article`,
    url,
    headline: post.title,
    ...(summary ? { description: summary } : {}),
    ...(post.image ? { image: absoluteUrl(post.image, baseUrl) } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
    ...(post.categoryName ? { articleSection: post.categoryName } : {}),
    inLanguage: runtime.seo.language,
    isPartOf: { '@id': `${baseUrl}/#website` },
    publisher: { '@id': `${baseUrl}/#organization` },
  };
}

/** Breadcrumb for an article, which sits one level below its listing page. */
export function articleBreadcrumbSchema(
  parentTitle: string,
  parentPath: string,
  title: string,
  baseUrl: string,
  path: string,
): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าหลัก', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: parentTitle, item: `${baseUrl}${parentPath}` },
      { '@type': 'ListItem', position: 3, name: title, item: `${baseUrl}${path}` },
    ],
  };
}

export function breadcrumbSchema(
  runtime: SiteRuntime,
  page: SitePage,
  baseUrl: string,
  path: string,
): JsonLdNode | null {
  if (path === '/') return null;

  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าหลัก', item: baseUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: page.seo.title || page.title,
        item: `${baseUrl}${path}`,
      },
    ],
  };
}

/** Turns an asset or page reference into an absolute URL. */
export function absoluteUrl(value: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
}

/** Collects `alt`-less images so the Studio can warn about them before publish. */
export function findImagesWithoutAlt(nodes: ComponentNode[]): string[] {
  const missing: string[] = [];

  const visit = (node: ComponentNode) => {
    const items = node.props?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === 'object' && 'imageUrl' in item && !('alt' in item)) {
          missing.push(node.id);
          break;
        }
      }
    }
    if (node.type === 'DynamicHtmlComponent' && typeof node.props?.content === 'string') {
      const imgTags = node.props.content.match(/<img\b[^>]*>/gi) ?? [];
      if (imgTags.some((tag: string) => !/\balt\s*=/i.test(tag))) missing.push(node.id);
    }
    node.children?.forEach(visit);
  };

  nodes.forEach(visit);
  return [...new Set(missing)];
}

/**
 * Wraps the graph in a single `@context`.
 * One script tag with a @graph is preferred over many separate blocks.
 */
export function buildJsonLdGraph(nodes: Array<JsonLdNode | null>): string {
  const graph = nodes.filter((node): node is JsonLdNode => Boolean(node));
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}
