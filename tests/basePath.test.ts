import { describe, expect, it } from 'vitest';
import { applyBasePath, siteBasePath, withBasePath } from '@/lib/seo/basePath';
import type { SiteRuntime } from '@/lib/seo/siteSeo';

const runtime = {
  appSlug: 'demo-muni',
  primaryDomain: 'demo-muni.localhost',
  domains: ['demo-muni.localhost', 'demo-muni.go.th'],
} as unknown as SiteRuntime;

describe('siteBasePath', () => {
  it('adds no prefix on the site’s own domain', () => {
    expect(siteBasePath(runtime, 'demo-muni.go.th')).toBe('');
    expect(siteBasePath(runtime, 'demo-muni.localhost:33001')).toBe('');
  });

  it('prefixes when the site is reached through the control plane', () => {
    expect(siteBasePath(runtime, 'localhost:33000')).toBe('/app/demo-muni');
  });

  it('prefixes when the host is unknown, which is the safe default', () => {
    expect(siteBasePath(runtime, undefined)).toBe('/app/demo-muni');
  });
});

describe('withBasePath', () => {
  it('prefixes internal paths', () => {
    expect(withBasePath('/app/x', '/news')).toBe('/app/x/news');
  });

  it('maps the site root onto the prefix itself', () => {
    expect(withBasePath('/app/x', '/')).toBe('/app/x');
  });

  it('leaves other origins, framework assets and anchors alone', () => {
    expect(withBasePath('/app/x', 'https://example.go.th/a')).toBe('https://example.go.th/a');
    expect(withBasePath('/app/x', '//cdn.example/a')).toBe('//cdn.example/a');
    expect(withBasePath('/app/x', '/_next/static/a.js')).toBe('/_next/static/a.js');
    expect(withBasePath('/app/x', '#section')).toBe('#section');
    expect(withBasePath('/app/x', 'mailto:a@b.go.th')).toBe('mailto:a@b.go.th');
  });
});

describe('applyBasePath', () => {
  it('rewrites hrefs nested inside props and arrays', () => {
    const [node] = applyBasePath(
      [{
        id: 'nav',
        type: 'NavMenuComponent',
        props: { items: [{ label: 'ข่าว', href: '/news' }], moreHref: '/all' },
      }] as never,
      '/app/x',
    );
    expect((node.props as never as { items: Array<{ href: string }> }).items[0].href).toBe('/app/x/news');
    expect((node.props as never as { moreHref: string }).moreHref).toBe('/app/x/all');
  });

  it('rewrites hrefs written by hand inside HTML content', () => {
    const [node] = applyBasePath(
      [{ id: 'f', type: 'DynamicHtmlComponent', props: { content: '<a href="/about">เกี่ยวกับ</a>' } }] as never,
      '/app/x',
    );
    expect((node.props as never as { content: string }).content).toContain('href="/app/x/about"');
  });

  it('returns the tree untouched when no prefix is needed', () => {
    const tree = [{ id: 'n', type: 'NavMenuComponent', props: { href: '/news' } }] as never;
    expect(applyBasePath(tree, '')).toBe(tree);
  });
});
