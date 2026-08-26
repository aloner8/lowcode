import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { loadSiteRuntimeByHost, pagePath, siteBaseUrl } from '@/lib/seo/siteSeo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-host sitemap built from the site's published pages.
 *
 * Pages marked `noindex` are excluded so the sitemap never contradicts the
 * robots directives on the page itself.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerList = await headers();
  const host = headerList.get('host') ?? '';
  const site = await loadSiteRuntimeByHost(host).catch(() => null);

  if (!site || !site.seo.sitemapEnabled) return [];

  const baseUrl = siteBaseUrl(site, host);

  return site.pages
    .filter((page) => !page.seo.noindex)
    .map((page) => {
      const path = pagePath(site, page);
      return {
        url: `${baseUrl}${path === '/' ? '' : path}`,
        lastModified: new Date(page.updatedAt),
        changeFrequency: page.seo.changeFrequency,
        // The home page always outranks inner pages.
        priority: path === '/' ? 1 : page.seo.priority,
      };
    });
}
