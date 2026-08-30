const ALLOWED_TAGS = new Set(['a', 'article', 'aside', 'blockquote', 'br', 'button', 'code', 'div', 'em', 'figure', 'figcaption', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'img', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'small', 'span', 'strong', 'ul']);
const VOID_TAGS = new Set(['br', 'hr', 'img']);
const ALLOWED_ATTRIBUTES = new Set(['alt', 'aria-hidden', 'aria-label', 'class', 'disabled', 'height', 'href', 'id', 'loading', 'rel', 'role', 'src', 'target', 'title', 'type', 'width']);
const SAFE_PROTOCOL = /^(?:https?:|mailto:|tel:|asset:|page:|\/|#)/i;

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));

export const isAllowedTag = (tag: string) => ALLOWED_TAGS.has(tag.toLowerCase());
export const isVoidTag = (tag: string) => VOID_TAGS.has(tag.toLowerCase());

export function sanitizeAttribute(name: string, value: unknown): string | null {
  const normalized = name.toLowerCase();
  if (!ALLOWED_ATTRIBUTES.has(normalized) && !normalized.startsWith('data-')) return null;
  const text = String(value ?? '');
  if ((normalized === 'href' || normalized === 'src') && !SAFE_PROTOCOL.test(text)) return null;
  if (normalized.startsWith('on') || normalized === 'style') return null;
  return text;
}

export const scopeCssSelector = (selector: string, scopeId: string) => {
  const safeScope = scopeId.replace(/[^A-Za-z0-9_-]/g, '-');
  const scopeSelector = `[data-hs-scope="${safeScope}"]`;
  const cleanSelector = selector.trim();
  if (!cleanSelector || /(?:^|[\s,>+~])(?:html|body|:root)(?:$|[\s.#:[>+~])/i.test(cleanSelector)) return null;
  return cleanSelector.split(',').map((part) => part.trim().startsWith('&') ? part.trim().replace(/^&/, scopeSelector) : `${scopeSelector} ${part.trim()}`).join(', ');
};
