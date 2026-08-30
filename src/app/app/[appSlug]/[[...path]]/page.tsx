import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { SiteRuntimeView } from '@/components/site/SiteRuntimeView';
import { PostArticleView } from '@/components/site/PostArticleView';
import { treeHasHeading } from '@/lib/engine/componentTree';
import { applyBasePath, siteBasePath } from '@/lib/seo/basePath';
import { resolveDataBindings } from '@/lib/seo/resolveDataBindings';
import { buildSiteMetadata, notFoundMetadata } from '@/lib/seo/metadata';
import { resolvePost, type SitePost } from '@/lib/seo/sitePost';
import type { ComponentNode } from '@/types';
import {
  loadSiteRuntime,
  pagePath,
  resolvePage,
  siteBaseUrl,
} from '@/lib/seo/siteSeo';
import {
  articleBreadcrumbSchema,
  articleSchema,
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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** `?page=` from the URL, clamped so a hand-typed value cannot break a query. */
function readPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10_000 ? parsed : 1;
}

const excerptOf = (html: string, max = 160) => {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

/**
 * Server-rendered page of a published site.
 *
 * Content and metadata are resolved on the server, so the HTML that reaches a
 * crawler is already complete — no client fetch, no empty shell. A path of
 * `/{page}/{id}` resolves to a single article rather than 404: a listing whose
 * items lead nowhere is not a usable site.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { appSlug, path } = await params;
  const site = await loadSiteRuntime(appSlug);
  if (!site) return notFoundMetadata;

  const segments = path ?? [];
  const page = resolvePage(site, segments);

  if (!page) {
    const post = await resolvePost(site, segments);
    if (!post) return notFoundMetadata;

    const host = (await headers()).get('host') ?? undefined;
    const base = await buildSiteMetadata(site, post.parent, host);
    const description = excerptOf(post.body) || base.description || undefined;

    return {
      ...base,
      title: { absolute: `${post.title} | ${site.appName}` },
      description,
      openGraph: {
        ...base.openGraph,
        title: post.title,
        description,
        type: 'article',
        ...(post.image ? { images: [post.image] } : {}),
      },
    };
  }

  // Canonical and Open Graph URLs must use the host the visitor actually asked
  // for, not the site's stored default.
  const host = (await headers()).get('host') ?? undefined;
  return buildSiteMetadata(site, page, host);
}

export default async function SitePage({ params, searchParams }: PageProps) {
  const { appSlug, path } = await params;
  const query = (await searchParams) ?? {};
  const site = await loadSiteRuntime(appSlug);
  if (!site) notFound();

  const segments = path ?? [];
  const page = resolvePage(site, segments);

  const host = (await headers()).get('host') ?? undefined;
  const baseUrl = siteBaseUrl(site, host);

  if (!page) {
    const post = await resolvePost(site, segments);
    if (!post) notFound();
    return <ArticlePage site={site} post={post} baseUrl={baseUrl} host={host} />;
  }

  const canonicalPath = pagePath(site, page);

  // Data-bound components are filled here so news and announcements are part of
  // the server-rendered HTML rather than a client-side fetch. Links are then
  // prefixed so they resolve on whichever host this request arrived at.
  const basePath = siteBasePath(site, host);
  const componentTree = withPagerBase(
    applyBasePath(
      await resolveDataBindings(site.platformId, page.componentTree, readPage(query.page)),
      basePath,
    ),
    `${basePath}${canonicalPath === '/' ? '' : canonicalPath}`,
  );

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
          appId={site.appId}
          initialContent={componentTree}
          runtimeData={{
            appConfig: {
              id: site.platformId,
              appSlug: site.appSlug,
              appName: site.appName,
              port: 0,
              subdomain: site.primaryDomain,
              // Internal topology stays on the server: the visitor's page has no
              // use for the database behind it, and naming it publicly tells an
              // attacker exactly what to aim at.
              tenantDbName: '',
              themeConfig: site.themeConfig,
              createdAt: site.updatedAt,
              updatedAt: site.updatedAt,
            },
            pageLayout: {
              id: `${site.platformId}:${page.id}`,
              appId: site.platformId,
              pageSlug: page.id,
              title: page.title,
              isDefaultPage: page.isDefaultPage,
              componentTree,
              styleSheet: page.styleSheet,
              createdAt: site.updatedAt,
              updatedAt: site.updatedAt,
            },
            forms: site.forms,
            collections: site.collections,
            routes: site.routes as never,
            pages: clientPages(site),
            services: site.services as never,
            flows: site.flows as never,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Page list for the browser.
 *
 * The client can swap a page in without a request, but only for pages a route
 * or a service points at. Every other page is reached by an ordinary link and
 * rendered by the server, so sending its component tree is pure weight — on a
 * site with a large menu the same navigation was serialised once per page and
 * came to most of the response.
 */
function clientPages(site: NonNullable<Awaited<ReturnType<typeof loadSiteRuntime>>>) {
  const reachable = new Set<string>();

  for (const route of site.routes ?? []) {
    if (route?.targetType === 'page' && typeof route.targetId === 'string') reachable.add(route.targetId);
  }
  for (const service of site.services ?? []) {
    const bundle = (service as { bundle?: Record<string, unknown> }).bundle ?? {};
    for (const key of ['loginPageId', 'adminPageId', 'successPageId']) {
      const value = bundle[key];
      if (typeof value === 'string') reachable.add(value);
    }
  }

  return site.pages.map((item) => (reachable.has(item.id)
    ? { id: item.id, title: item.title, componentTree: item.componentTree, styleSheet: item.styleSheet }
    : { id: item.id, title: item.title }));
}

/**
 * Tells every pager which URL its page numbers hang off, so a link reads
 * `/news?page=2` rather than a bare `?page=2` that would reset the path.
 */
function withPagerBase(nodes: ComponentNode[], basePath: string): ComponentNode[] {
  const visit = (node: ComponentNode): ComponentNode => ({
    ...node,
    props: node.props?.pageCount ? { ...node.props, basePath } : node.props,
    children: node.children?.map(visit),
  });
  return nodes.map(visit);
}

/**
 * The article view reuses its listing page's header and footer, so an article
 * is not a bare document detached from the rest of the site. Only the nodes
 * that are page furniture are kept; the listing itself is replaced by the
 * article body.
 */
async function ArticlePage({
  site,
  post,
  baseUrl,
  host,
}: {
  site: Awaited<ReturnType<typeof loadSiteRuntime>> & object;
  post: SitePost;
  baseUrl: string;
  host?: string;
}) {
  const articlePath = `/${post.parent.id}/${post.id}`;

  const jsonLd = buildJsonLdGraph([
    organizationSchema(site, baseUrl),
    websiteSchema(site, baseUrl),
    articleSchema(site, post, baseUrl, articlePath),
    articleBreadcrumbSchema(post.parent.title, `/${post.parent.id}`, post.title, baseUrl, articlePath),
  ]);

  /*
   * Page furniture is whatever sits before the first content section and after
   * the last one, in the order the page itself declares. Taking the first chrome
   * node as the header and the last as the footer worked only while there were
   * two of them; with a contact strip, a dock, complaint cards and a cookie bar
   * it rendered the strip and the cookie bar and dropped everything between.
   */
  const isChrome = (node: ComponentNode) =>
    node.type === 'NavMenuComponent' || node.props?.__chrome === true;

  const tree = post.parent.componentTree;
  const firstContent = tree.findIndex((node) => !isChrome(node));
  const lastContent = tree.map(isChrome).lastIndexOf(false);

  const base = siteBasePath(site, host);
  const head = applyBasePath(
    firstContent === -1 ? tree : tree.slice(0, firstContent),
    base,
  );
  const tail = applyBasePath(
    firstContent === -1 ? [] : tree.slice(lastContent + 1).filter(isChrome),
    base,
  );

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {head.length > 0 && (
        <SiteRuntimeView
          appSlug={site.appSlug}
          appId={site.appId}
          initialContent={head}
          runtimeData={emptyRuntime(site)}
          fillViewport={false}
        />
      )}

      <div className="flex-grow-1">
        <PostArticleView post={post} basePath={base} />
      </div>

      {tail.length > 0 && (
        <SiteRuntimeView
          appSlug={site.appSlug}
          appId={site.appId}
          initialContent={tail}
          runtimeData={emptyRuntime(site)}
          fillViewport={false}
        />
      )}
    </div>
  );
}

/** Runtime shell for the chrome nodes, which need no page data of their own. */
function emptyRuntime(site: NonNullable<Awaited<ReturnType<typeof loadSiteRuntime>>>) {
  return {
    appConfig: {
      id: site.platformId,
      appSlug: site.appSlug,
      appName: site.appName,
      port: 0,
      subdomain: site.primaryDomain,
      tenantDbName: '',
      themeConfig: site.themeConfig,
      createdAt: site.updatedAt,
      updatedAt: site.updatedAt,
    },
    pageLayout: {
      id: `${site.platformId}:article`,
      appId: site.platformId,
      pageSlug: 'article',
      title: site.appName,
      isDefaultPage: false,
      componentTree: [],
      createdAt: site.updatedAt,
      updatedAt: site.updatedAt,
    },
    forms: site.forms,
    collections: site.collections,
    routes: site.routes as never,
    pages: clientPages(site),
    services: site.services as never,
    flows: site.flows as never,
  };
}
