import 'server-only';

import type { Metadata } from 'next';
import { absoluteUrl } from './structuredData';
import { pagePath, siteBaseUrl, type SitePage, type SiteRuntime } from './siteSeo';

/**
 * Builds the Next.js Metadata object for one page of a public site:
 * title, description, canonical, hreflang, Open Graph, Twitter cards,
 * robots directives and search-console verification.
 */

/** Search engines truncate around these lengths; trim on a word boundary. */
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

export function truncate(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function buildSiteMetadata(
  runtime: SiteRuntime,
  page: SitePage,
  host?: string,
): Metadata {
  const baseUrl = siteBaseUrl(runtime, host);
  const path = pagePath(runtime, page);
  const url = `${baseUrl}${path === '/' ? '' : path}`;

  const rawTitle = page.seo.title || page.title;
  const isHome = path === '/';
  // The home page owns the brand name; inner pages append it.
  const title = isHome
    ? truncate(rawTitle === runtime.seo.siteName ? rawTitle : `${rawTitle} | ${runtime.seo.siteName}`, TITLE_MAX)
    : truncate(`${rawTitle} | ${runtime.seo.siteName}`, TITLE_MAX);

  const description = truncate(
    page.seo.description || runtime.seo.description || rawTitle,
    DESCRIPTION_MAX,
  );

  const keywords = [...new Set([...runtime.seo.keywords, ...page.seo.keywords])];
  const image = page.seo.ogImage || runtime.seo.ogImage;
  const images = image ? [{ url: absoluteUrl(image, baseUrl), alt: rawTitle }] : undefined;

  const indexable = !page.seo.noindex && !/noindex/i.test(runtime.seo.robots);

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    ...(keywords.length ? { keywords } : {}),
    applicationName: runtime.seo.siteName,
    alternates: {
      canonical: url,
      languages: { [runtime.seo.language]: url },
    },
    robots: {
      index: indexable,
      follow: indexable,
      googleBot: {
        index: indexable,
        follow: indexable,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      siteName: runtime.seo.siteName,
      locale: runtime.seo.locale,
      title,
      description,
      url,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(runtime.seo.twitterHandle ? { site: runtime.seo.twitterHandle } : {}),
      ...(images ? { images: images.map((item) => item.url) } : {}),
    },
    ...(runtime.seo.googleSiteVerification || runtime.seo.bingSiteVerification
      ? {
          verification: {
            ...(runtime.seo.googleSiteVerification ? { google: runtime.seo.googleSiteVerification } : {}),
            ...(runtime.seo.bingSiteVerification ? { other: { 'msvalidate.01': runtime.seo.bingSiteVerification } } : {}),
          },
        }
      : {}),
    other: {
      'theme-color': runtime.themeConfig.primaryColor,
    },
  };
}

/** Metadata for a slug that does not resolve to a published page. */
export const notFoundMetadata: Metadata = {
  title: 'ไม่พบหน้าที่ต้องการ',
  robots: { index: false, follow: false },
};
