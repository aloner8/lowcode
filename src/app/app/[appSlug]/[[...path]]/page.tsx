import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { SiteRuntimeView } from '@/components/site/SiteRuntimeView';
import { treeHasHeading } from '@/lib/engine/componentTree';
import { resolveDataBindings } from '@/lib/seo/resolveDataBindings';
import { buildSiteMetadata, notFoundMetadata } from '@/lib/seo/metadata';
import {
  loadSiteRuntime,
  pagePath,
  resolvePage,
  siteBaseUrl,
} from '@/lib/seo/siteSeo';
import {
  breadcrumbSchema,
  buildJsonLdGraph,
  organizationSchema,
  webPageSchema,
  websiteSchema,
} from '@/lib/seo/structuredData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ appSlug: string; path?: string[] }>;
};

/**
 * Server-rendered page of a published site.
 *
 * Content and metadata are resolved on the server, so the HTML that reaches a
 * crawler is already complete — no client fetch, no empty shell.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { appSlug, path } = await params;
  const site = await loadSiteRuntime(appSlug);
  if (!site) return notFoundMetadata;

  const page = resolvePage(site, path ?? []);
  if (!page) return notFoundMetadata;

  // Canonical and Open Graph URLs must use the host the visitor actually asked
  // for, not the site's stored default.
  const host = (await headers()).get('host') ?? undefined;
  return buildSiteMetadata(site, page, host);
}

export default async function SitePage({ params }: PageProps) {
  const { appSlug, path } = await params;
  const site = await loadSiteRuntime(appSlug);
  if (!site) notFound();

  const page = resolvePage(site, path ?? []);
  if (!page) notFound();

  const host = (await headers()).get('host') ?? undefined;
  const baseUrl = siteBaseUrl(site, host);
  const canonicalPath = pagePath(site, page);

  // Data-bound components are filled here so news and announcements are part of
  // the server-rendered HTML rather than a client-side fetch.
  const componentTree = await resolveDataBindings(site.platformId, page.componentTree);

  const jsonLd = buildJsonLdGraph([
    organizationSchema(site, baseUrl),
    websiteSchema(site, baseUrl),
    webPageSchema(site, page, baseUrl, canonicalPath),
    breadcrumbSchema(site, page, baseUrl, canonicalPath),
  ]);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      {/* Structured data is rendered server-side so it is present without JS. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* Guarantee exactly one H1: only added when the page tree has none. */}
      {!treeHasHeading(componentTree) && (
        <h1 className="visually-hidden">{page.seo.title || page.title}</h1>
      )}

      <div className="flex-grow-1">
        <SiteRuntimeView
          appSlug={site.appSlug}
          themeConfig={site.themeConfig}
          componentTree={componentTree}
          forms={site.forms}
          collections={site.collections}
        />
      </div>
    </div>
  );
}
