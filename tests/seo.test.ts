import { describe, expect, it } from 'vitest';
import { truncate } from '@/lib/seo/metadata';
import { validatePageSeo, validateSeoPayload } from '@/lib/seo/validateSeo';
import {
  absoluteUrl,
  buildJsonLdGraph,
  findImagesWithoutAlt,
} from '@/lib/seo/structuredData';
import { treeHasHeading } from '@/lib/engine/componentTree';
import type { ComponentNode } from '@/types';

describe('truncate', () => {
  it('leaves short text untouched', () => {
    expect(truncate('สั้น', 60)).toBe('สั้น');
  });

  it('collapses whitespace', () => {
    expect(truncate('a   b\n c', 60)).toBe('a b c');
  });

  it('cuts on a word boundary and marks the ellipsis', () => {
    const result = truncate('the quick brown fox jumps over the lazy dog', 20);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('  ');
  });
});

describe('validateSeoPayload', () => {
  it('accepts a complete payload', () => {
    const { value, error } = validateSeoPayload({
      siteName: 'เทศบาลตัวอย่าง',
      description: 'คำอธิบาย',
      keywords: ['ข่าว', 'บริการ', 'ข่าว'],
      locale: 'th_TH',
      language: 'th',
      ogImage: 'https://example.go.th/og.png',
      twitterHandle: '@example',
      organizationType: 'GovernmentOrganization',
      robots: 'index,follow',
    });
    expect(error).toBeUndefined();
    expect(value?.keywords).toEqual(['ข่าว', 'บริการ']);
  });

  it('accepts keywords as a comma-separated string', () => {
    const { value } = validateSeoPayload({ keywords: 'a, b , c' });
    expect(value?.keywords).toEqual(['a', 'b', 'c']);
  });

  it('strips angle brackets that could break out of an attribute', () => {
    const { value } = validateSeoPayload({ siteName: 'x<script>alert(1)</script>' });
    expect(value?.siteName).not.toContain('<');
  });

  it('rejects an unsafe ogImage URL', () => {
    expect(validateSeoPayload({ ogImage: 'javascript:alert(1)' }).error).toBeTruthy();
  });

  it('rejects malformed locale, robots, twitter handle and organization type', () => {
    expect(validateSeoPayload({ locale: 'thai-TH' }).error).toBeTruthy();
    expect(validateSeoPayload({ robots: 'index,maybe' }).error).toBeTruthy();
    expect(validateSeoPayload({ twitterHandle: 'no-at-sign' }).error).toBeTruthy();
    expect(validateSeoPayload({ organizationType: 'EvilCorp' }).error).toBeTruthy();
  });

  it('rejects an over-long description', () => {
    expect(validateSeoPayload({ description: 'ก'.repeat(400) }).error).toBeTruthy();
  });

  it('rejects a non-object payload', () => {
    expect(validateSeoPayload(null).error).toBeTruthy();
    expect(validateSeoPayload('nope').error).toBeTruthy();
  });
});

describe('validatePageSeo', () => {
  it('defaults changeFrequency and priority', () => {
    const { value } = validatePageSeo({ title: 'หน้าหลัก' });
    expect(value?.changeFrequency).toBe('weekly');
    expect(value?.priority).toBe(0.5);
  });

  it('rejects an out-of-range priority', () => {
    expect(validatePageSeo({ priority: 2 }).error).toBeTruthy();
    expect(validatePageSeo({ priority: -1 }).error).toBeTruthy();
  });

  it('rejects an unknown changeFrequency', () => {
    expect(validatePageSeo({ changeFrequency: 'sometimes' }).error).toBeTruthy();
  });

  it('carries noindex through', () => {
    expect(validatePageSeo({ noindex: true }).value?.noindex).toBe(true);
  });
});

describe('absoluteUrl', () => {
  it('leaves absolute URLs alone', () => {
    expect(absoluteUrl('https://cdn.example/x.png', 'https://site')).toBe('https://cdn.example/x.png');
  });

  it('resolves relative paths against the base, with or without a slash', () => {
    expect(absoluteUrl('/x.png', 'https://site')).toBe('https://site/x.png');
    expect(absoluteUrl('x.png', 'https://site')).toBe('https://site/x.png');
  });
});

describe('buildJsonLdGraph', () => {
  it('drops nulls and emits a single @context', () => {
    const graph = JSON.parse(buildJsonLdGraph([{ '@type': 'WebSite' }, null, { '@type': 'WebPage' }]));
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph']).toHaveLength(2);
  });
});

describe('treeHasHeading', () => {
  const node = (id: string, content?: string, children?: ComponentNode[]): ComponentNode => ({
    id, type: 'DynamicHtmlComponent', props: content ? { content } : {}, children,
  });

  it('detects an h1 at the top level', () => {
    expect(treeHasHeading([node('a', '<h1>hi</h1>')])).toBe(true);
  });

  it('detects an h1 nested in children', () => {
    expect(treeHasHeading([node('a', undefined, [node('b', '<H1>hi</H1>')])])).toBe(true);
  });

  it('returns false when only lower headings exist', () => {
    expect(treeHasHeading([node('a', '<h2>hi</h2>')])).toBe(false);
  });
});

describe('findImagesWithoutAlt', () => {
  it('flags gallery items and raw <img> tags missing alt text', () => {
    const nodes: ComponentNode[] = [
      { id: 'gallery', type: 'GalleryComponent', props: { items: [{ imageUrl: '/a.png' }] } },
      { id: 'html', type: 'DynamicHtmlComponent', props: { content: '<img src="/b.png">' } },
      { id: 'ok', type: 'DynamicHtmlComponent', props: { content: '<img src="/c.png" alt="ok">' } },
    ];
    expect(findImagesWithoutAlt(nodes)).toEqual(['gallery', 'html']);
  });
});
