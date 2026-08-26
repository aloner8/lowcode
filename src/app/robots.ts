import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { loadSiteRuntimeByHost } from '@/lib/seo/siteSeo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-host robots.txt.
 *
 * A published site advertises its sitemap and allows crawling unless it opted
 * out. The control plane is never indexable.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerList = await headers();
  const host = headerList.get('host') ?? '';
  const site = await loadSiteRuntimeByHost(host).catch(() => null);

  const isLocal = /(^localhost)|(\.localhost$)|(^127\.)/.test(host.split(':')[0]);
  const protocol = isLocal ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Control plane, or a host that maps to no published site.
  if (!site) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  const blocked = /noindex/i.test(site.seo.robots);
  if (blocked) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      host: baseUrl,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Never expose the API surface or the control plane to crawlers.
        disallow: ['/api/', '/admin', '/studio', '/flow-studio', '/audit-logs'],
      },
    ],
    ...(site.seo.sitemapEnabled ? { sitemap: `${baseUrl}/sitemap.xml` } : {}),
    host: baseUrl,
  };
}
