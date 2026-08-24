import type { AssetManifestEntry, CollectionManifest, HtmlStudioManifests, ResolveContext, SharedComponentManifest, SiteMapEntry } from './types';

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');
const referenceId = (ref: string, scheme: string) => ref.startsWith(`${scheme}://`) ? ref.slice(scheme.length + 3) : ref;

export class ReferenceResolutionError extends Error {
  constructor(message: string, public readonly ref: string) {
    super(message);
    this.name = 'ReferenceResolutionError';
  }
}

export class PlatformReferenceResolver {
  constructor(private readonly context: ResolveContext, private readonly manifests: HtmlStudioManifests) {}

  page(ref: string, params: Record<string, unknown> = {}): string {
    const id = referenceId(ref, 'page');
    const routeId = referenceId(ref, 'route');
    const entry = this.manifests.pages.find((item) => item.id === id || item.pageId === id || item.slug === routeId);
    if (!entry || entry.status === 'disabled') throw new ReferenceResolutionError(`Page reference '${ref}' was not found or is disabled.`, ref);
    const merged = { ...this.context.routeParams, ...params };
    const localized = entry.localePaths?.[this.context.locale] || entry.pathPattern;
    const missing = entry.requiredParams.filter((key) => merged[key] === undefined || merged[key] === null || merged[key] === '');
    if (missing.length) throw new ReferenceResolutionError(`Page '${ref}' requires route parameter(s): ${missing.join(', ')}.`, ref);
    const path = localized.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => encodeURIComponent(String(merged[key])));
    const base = trimSlashes(this.context.basePath);
    return `/${[base, trimSlashes(path)].filter(Boolean).join('/')}`;
  }

  asset(ref: string, options: { variant?: string; revision?: string } = {}): string {
    const id = referenceId(ref, 'asset');
    const entry = this.manifests.assets.find((item) => item.id === id || item.logicalName === id);
    if (!entry) throw new ReferenceResolutionError(`Asset reference '${ref}' was not found.`, ref);
    this.assertScope(entry.scope, ref);
    const variant = options.variant || 'original';
    const variantEntry = entry.variants[variant] || entry.variants.original;
    if (!variantEntry) throw new ReferenceResolutionError(`Asset '${ref}' has no '${variant}' or original variant.`, ref);
    const base = this.context.assetBaseUrl.replace(/\/$/, '');
    const revision = encodeURIComponent(options.revision || entry.revision);
    return `${base}/${encodeURIComponent(entry.id)}/${revision}/${encodeURIComponent(variant)}`;
  }

  component(ref: string): SharedComponentManifest {
    const id = referenceId(ref, 'component');
    const entry = this.manifests.components.find((item) => item.id === id || item.tagName === id);
    if (!entry) throw new ReferenceResolutionError(`Shared component '${ref}' was not found.`, ref);
    this.assertScope(entry.scope, ref);
    return entry;
  }

  collection(ref: string): CollectionManifest {
    const id = referenceId(ref, 'collection');
    const entry = this.manifests.collections.find((item) => item.id === id);
    if (!entry) throw new ReferenceResolutionError(`Collection '${ref}' was not found.`, ref);
    this.assertScope(entry.scope, ref);
    return entry;
  }

  private assertScope(scope: AssetManifestEntry['scope'], ref: string) {
    if (scope === 'tenant' && !this.context.tenantId) throw new ReferenceResolutionError(`Tenant-scoped reference '${ref}' requires a tenant context.`, ref);
  }
}

export const createEmptyManifests = (): HtmlStudioManifests => ({ pages: [], assets: [], components: [], collections: [] });
export type { SiteMapEntry };

