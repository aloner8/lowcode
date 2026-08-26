import { describe, expect, it } from 'vitest';
import { escapeHtml, interpolate, renderSafeHtml, sanitizeHtml } from '@/lib/security/sanitizeHtml';

describe('sanitizeHtml', () => {
  it('keeps allow-listed markup intact', () => {
    const html = '<section class="p-4"><h2>หัวข้อ</h2><p>เนื้อหา</p></section>';
    expect(sanitizeHtml(html)).toBe(html.replace('<section class="p-4">', '<section class="p-4">'));
  });

  it('drops script elements together with their contents', () => {
    const result = sanitizeHtml('<p>ok</p><script>alert(1)</script><p>after</p>');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('<script');
    expect(result).toContain('<p>ok</p>');
    expect(result).toContain('<p>after</p>');
  });

  it('strips inline event handlers', () => {
    const result = sanitizeHtml('<div onclick="steal()" onmouseover="x()">hi</div>');
    expect(result).toBe('<div>hi</div>');
  });

  it('rejects javascript: URLs including obfuscated variants', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="java\tscript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="JaVaScRiPt:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('allows safe URL schemes', () => {
    expect(sanitizeHtml('<a href="https://example.com">x</a>')).toContain('href="https://example.com"');
    expect(sanitizeHtml('<a href="/page">x</a>')).toContain('href="/page"');
    expect(sanitizeHtml('<a href="mailto:a@b.co">x</a>')).toContain('mailto:a@b.co');
  });

  it('removes iframes, forms and inputs entirely', () => {
    const result = sanitizeHtml('<iframe src="https://evil"></iframe><form><input name="pw"></form><p>keep</p>');
    expect(result).toBe('<p>keep</p>');
  });

  it('blocks CSS that can execute or exfiltrate', () => {
    expect(sanitizeHtml('<div style="width:10px">x</div>')).toContain('style="width:10px"');
    expect(sanitizeHtml('<div style="background:url(javascript:alert(1))">x</div>')).toBe('<div>x</div>');
    expect(sanitizeHtml('<div style="behavior:url(#x)">x</div>')).toBe('<div>x</div>');
  });

  it('closes unbalanced tags rather than leaking them', () => {
    expect(sanitizeHtml('<div><p>text')).toBe('<div><p>text</p></div>');
  });

  it('escapes stray text and unknown tags', () => {
    const result = sanitizeHtml('<marquee>hello</marquee> 5 < 6');
    expect(result).toContain('hello');
    expect(result).not.toContain('<marquee');
    expect(result).toContain('&lt;');
  });

  it('strips HTML comments that can hide payloads', () => {
    expect(sanitizeHtml('<!--[if IE]><script>x()</script><![endif]--><p>a</p>')).toBe('<p>a</p>');
  });
});

describe('interpolate', () => {
  it('escapes interpolated values so data cannot inject markup', () => {
    const result = interpolate('<p>{{ name }}</p>', { name: '<img src=x onerror=alert(1)>' });
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('resolves nested paths and renders missing values as empty', () => {
    expect(interpolate('{{ user.profile.name }}', { user: { profile: { name: 'Ann' } } })).toBe('Ann');
    expect(interpolate('{{ missing.deep }}', {})).toBe('');
  });
});

describe('renderSafeHtml', () => {
  it('sanitizes after interpolation, not before', () => {
    const result = renderSafeHtml('<div>{{ payload }}</div>', { payload: '</div><script>alert(1)</script>' });
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)</script>');
  });
});

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#039;');
  });

  it('renders null and undefined as an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
