import 'server-only';

import { cache } from 'react';
import { getCoreDb } from '@/lib/db/coreDb';
import { mergePlatformMasterWithTenantOverrides } from '@/lib/engine/PlatformMergeEngine';
import type { ComponentNode, PageStyleSheet, TenantOverrides, ThemeConfig } from '@/types';

/**
 * Everything a public site needs to render server-side, resolved in one query.
 *
 * The runtime player used to fetch this from its own API in the browser, which
 * left crawlers with an empty shell. Loading it here means the HTML that leaves
 * the server already contains the page content and its metadata.
 */

export interface SeoConfig {
  siteName: string;
  description: string;
  keywords: string[];
  locale: string;
  language: string;
  ogImage: string | null;
  twitterHandle: string | null;
  organizationType: string;
  robots: string;
  googleSiteVerification: string | null;
  bingSiteVerification: string | null;
  sitemapEnabled: boolean;
  contact: Record<string, string>;
}

export interface PageSeo {
  title: string | null;
  description: string | null;
  keywords: string[];
  ogImage: string | null;
  noindex: boolean;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export interface SitePage {
  id: string;
  title: string;
  componentTree: ComponentNode[];
  styleSheet?: PageStyleSheet;
  isDefaultPage: boolean;
  seo: PageSeo;
  updatedAt: string;
}

export interface SiteRuntime {
  appId: string | null;
  appSlug: string;
  appName: string;
  platformId: string;
  platformSlug: string;
  primaryDomain: string;
  domains: string[];
  themeConfig: ThemeConfig;
  tenantOverrides: TenantOverrides;
  seo: SeoConfig;
  pages: SitePage[];
  routes: Array<Record<string, any>>;
  services: Array<Record<string, any>>;
  flows: Array<Record<string, any>>;
  forms: Array<{ id: string; componentTree: ComponentNode[] }>;
  collections: Array<{
    id: string;
    name?: string;
    standardFlows?: Record<string, unknown>;
    components: Array<{ id: string; type: string; componentTree: ComponentNode[] }>;
  }>;
  updatedAt: string;
}

const DEFAULT_SEO: SeoConfig = {
  siteName: '',
  description: '',
  keywords: [],
  locale: 'th_TH',
  language: 'th',
  ogImage: null,
  twitterHandle: null,
  organizationType: 'GovernmentOrganization',
  robots: 'index,follow',
  googleSiteVerification: null,
  bingSiteVerification: null,
  sitemapEnabled: true,
  contact: {},
};

const DEFAULT_PAGE_SEO: PageSeo = {
  title: null,
  description: null,
  keywords: [],
  ogImage: null,
  noindex: false,
  changeFrequency: 'weekly',
  priority: 0.5,
};

type RawSeo = Partial<Record<keyof SeoConfig, unknown>> | null;

/** Site settings win over platform defaults, but only where they are actually set. */
function mergeSeo(platformDefaults: RawSeo, siteOverrides: RawSeo, fallbackName: string): SeoConfig {
  const pick = <K extends keyof SeoConfig>(key: K, fallback: SeoConfig[K]): SeoConfig[K] => {
    const site = siteOverrides?.[key];
    if (site !== undefined && site !== null && site !== '') return site as SeoConfig[K];
    const platform = platformDefaults?.[key];
    if (platform !== undefined && platform !== null && platform !== '') return platform as SeoConfig[K];
    return fallback;
  };

  const keywords = [
    ...(Array.isArray(platformDefaults?.keywords) ? (platformDefaults.keywords as string[]) : []),
    ...(Array.isArray(siteOverrides?.keywords) ? (siteOverrides.keywords as string[]) : []),
  ];

  return {
    siteName: pick('siteName', fallbackName),
    description: pick('description', ''),
    keywords: [...new Set(keywords.filter((keyword) => typeof keyword === 'string' && keyword.trim()))],
    locale: pick('locale', DEFAULT_SEO.locale),
    language: pick('language', DEFAULT_SEO.language),
    ogImage: pick('ogImage', null),
    twitterHandle: pick('twitterHandle', null),
    organizationType: pick('organizationType', DEFAULT_SEO.organizationType),
    robots: pick('robots', DEFAULT_SEO.robots),
    googleSiteVerification: pick('googleSiteVerification', null),
    bingSiteVerification: pick('bingSiteVerification', null),
    sitemapEnabled: siteOverrides?.sitemapEnabled !== false,
    contact: (siteOverrides?.contact ?? platformDefaults?.contact ?? {}) as Record<string, string>,
  };
}

function normalizePageSeo(value: unknown): PageSeo {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PAGE_SEO };
  const raw = value as Partial<Record<keyof PageSeo, unknown>>;
  const priority = Number(raw.priority);

  return {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : null,
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : null,
    keywords: Array.isArray(raw.keywords) ? (raw.keywords as string[]).filter((k) => typeof k === 'string') : [],
    ogImage: typeof raw.ogImage === 'string' && raw.ogImage.trim() ? raw.ogImage.trim() : null,
    noindex: raw.noindex === true,
    changeFrequency: (['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'] as const)
      .includes(raw.changeFrequency as PageSeo['changeFrequency'])
      ? (raw.changeFrequency as PageSeo['changeFrequency'])
      : 'weekly',
    priority: Number.isFinite(priority) ? Math.min(Math.max(priority, 0), 1) : 0.5,
  };
}

interface RuntimeRow {
  platform_id: string;
  platform_slug: string;
  platform_name: string;
  master_theme_config: ThemeConfig;
  seo_defaults: RawSeo;
  runtime_snapshot: {
    pages?: Array<Record<string, unknown>>;
    forms?: unknown[];
    collections?: unknown[];
    routes?: unknown[];
    services?: unknown[];
    flows?: unknown[];
    generatedAt?: string;
  } | null;
  app_id: string | null;
  app_slug: string | null;
  app_name: string | null;
  app_subdomain: string | null;
  app_theme: ThemeConfig | null;
  app_overrides: TenantOverrides | null;
  app_seo: RawSeo;
  domains: string[] | null;
}

const SELECT_RUNTIME = `
  SELECT p.id  AS platform_id, p.platform_slug, p.platform_name,
         p.master_theme_config, p.seo_defaults, p.runtime_snapshot,
         a.id AS app_id, a.app_slug, a.app_name, a.subdomain AS app_subdomain,
         a.theme_config AS app_theme, a.tenant_overrides AS app_overrides,
         a.seo_settings AS app_seo,
         COALESCE(
           (SELECT ARRAY_AGG(LOWER(BTRIM(d.domain)) ORDER BY d.is_primary DESC, d.domain)
            FROM public.app_domains d WHERE d.app_id = a.id AND d.is_active),
           ARRAY[]::text[]
         ) AS domains
  FROM public.platforms p
  LEFT JOIN public.apps a ON a.platform_id = p.id AND a.is_active
`;

function toRuntime(row: RuntimeRow): SiteRuntime {
  const snapshot = row.runtime_snapshot ?? {};
  const appSlug = row.app_slug ?? row.platform_slug;
  const appName = row.app_name ?? row.platform_name;
  const seo = mergeSeo(row.seo_defaults, row.app_seo, appName);

  const themeConfig: ThemeConfig = {
    ...row.master_theme_config,
    ...(row.app_theme ?? {}),
    ...(row.app_overrides?.themeOverrides ?? {}),
  };

  const pages: SitePage[] = (snapshot.pages ?? []).map((raw) => {
    const page = raw as {
      id?: string; title?: string; componentTree?: ComponentNode[]; styleSheet?: PageStyleSheet;
      isDefaultPage?: boolean; seo?: unknown; updatedAt?: string;
    };
    return {
      id: String(page.id ?? 'index'),
      title: String(page.title ?? appName),
      // Tenant overrides are applied here so what is indexed matches what is served.
      componentTree: mergePlatformMasterWithTenantOverrides(
        page.componentTree ?? [],
        row.app_overrides ?? undefined,
      ),
      styleSheet: page.styleSheet,
      isDefaultPage: page.isDefaultPage === true,
      seo: normalizePageSeo(page.seo),
      updatedAt: page.updatedAt ?? snapshot.generatedAt ?? new Date().toISOString(),
    };
  });

  const domains = row.domains ?? [];

  return {
    appId: row.app_id,
    appSlug,
    appName,
    platformId: row.platform_id,
    platformSlug: row.platform_slug,
    primaryDomain: domains[0] ?? row.app_subdomain ?? `${appSlug}.localhost`,
    domains,
    themeConfig,
    tenantOverrides: row.app_overrides ?? {},
    seo,
    pages,
    routes: (snapshot.routes ?? []) as SiteRuntime['routes'],
    services: (snapshot.services ?? []) as SiteRuntime['services'],
    flows: (snapshot.flows ?? []) as SiteRuntime['flows'],
    forms: (snapshot.forms ?? []) as SiteRuntime['forms'],
    collections: (snapshot.collections ?? []) as SiteRuntime['collections'],
    updatedAt: snapshot.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * Resolves a site by app slug, falling back to the platform slug.
 * Memoised per request so the layout, generateMetadata and the page itself
 * share a single database round-trip.
 */
export const loadSiteRuntime = cache(async (slug: string): Promise<SiteRuntime | null> => {
  const result = await getCoreDb().query<RuntimeRow>(
    `${SELECT_RUNTIME}
     WHERE (a.app_slug = $1 OR p.platform_slug = $1) AND p.runtime_snapshot IS NOT NULL
     ORDER BY a.app_slug NULLS LAST
     LIMIT 1`,
    [slug],
  );
  return result.rowCount ? toRuntime(result.rows[0]) : null;
});

/** Resolves a site from an incoming Host header — used by robots.txt and sitemap.xml. */
export const loadSiteRuntimeByHost = cache(async (host: string): Promise<SiteRuntime | null> => {
  const hostname = host.split(':')[0].trim().toLowerCase();
  if (!hostname) return null;

  const result = await getCoreDb().query<RuntimeRow>(
    `${SELECT_RUNTIME}
     WHERE p.runtime_snapshot IS NOT NULL
       AND (LOWER(a.subdomain) = $1
            OR EXISTS (SELECT 1 FROM public.app_domains d
                       WHERE d.app_id = a.id AND d.is_active AND LOWER(BTRIM(d.domain)) = $1))
     LIMIT 1`,
    [hostname],
  );
  return result.rowCount ? toRuntime(result.rows[0]) : null;
});

/** Picks the page for a URL path; an empty path resolves to the site's home page. */
export function resolvePage(runtime: SiteRuntime, segments: string[] = []): SitePage | null {
  if (!runtime.pages.length) return null;
  const slug = segments.filter(Boolean).join('/');

  if (!slug) {
    return (
      runtime.pages.find((page) => page.isDefaultPage) ||
      runtime.pages.find((page) => page.id === 'index') ||
      runtime.pages.find((page) => page.id === 'home') ||
      runtime.pages[0]
    );
  }
  return runtime.pages.find((page) => page.id === slug) ?? null;
}

/** Absolute base URL for canonical links, sitemaps and Open Graph tags. */
export function siteBaseUrl(runtime: SiteRuntime, host?: string): string {
  const configured = process.env.SITE_PUBLIC_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const hostname = host?.trim() || runtime.primaryDomain;
  const isLocal = /(^localhost)|(\.localhost$)|(^127\.)|(^0\.0\.0\.0)/.test(hostname.split(':')[0]);
  const protocol = isLocal ? 'http' : 'https';
  return `${protocol}://${hostname}`;
}

/** Canonical path for a page: the home page owns `/`. */
export function pagePath(runtime: SiteRuntime, page: SitePage): string {
  const home =
    runtime.pages.find((item) => item.isDefaultPage) ||
    runtime.pages.find((item) => item.id === 'index') ||
    runtime.pages[0];
  return page.id === home?.id ? '/' : `/${page.id}`;
}
