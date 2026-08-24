import { escapeHtml, isVoidTag, sanitizeAttribute, scopeCssSelector } from './sanitizer';
import type { HtmlStudioDocument, HtmlTemplateArtifact, StudioNode } from './types';
import { validateDocument } from './validator';

const compileNode = (node: StudioNode): string => {
  if (node.kind === 'text') return escapeHtml(node.text || '');
  if (node.kind === 'component') return `<div class="alert alert-warning" data-component-ref="${escapeHtml(node.componentRef?.id || '')}">Shared component '${escapeHtml(node.componentRef?.displayName || node.componentRef?.id || '')}' requires the component runtime.</div>`;
  if (node.kind === 'slot') return (node.children || []).map(compileNode).join('');
  if (node.kind !== 'element' && node.kind !== 'svg') return '';
  const tag = node.kind === 'svg' ? 'div' : (node.tag || 'div').toLowerCase();
  const attributes: string[] = [`data-studio-id="${escapeHtml(node.id)}"`];
  if (node.classList?.length) attributes.push(`class="${escapeHtml(node.classList.join(' '))}"`);
  Object.entries(node.attributes || {}).forEach(([name, value]) => {
    if (Array.isArray(value) || (value && typeof value === 'object')) return;
    const sanitized = sanitizeAttribute(name, value);
    if (sanitized !== null) attributes.push(`${name.toLowerCase()}="${escapeHtml(sanitized)}"`);
  });
  const open = `<${tag} ${attributes.join(' ')}>`;
  if (isVoidTag(tag)) return open;
  return `${open}${(node.children || []).map(compileNode).join('')}</${tag}>`;
};

const compileCss = (document: HtmlStudioDocument) => {
  const scope = document.styleSheet.scopeId;
  const baseRules: string[] = [];
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];
  document.styleSheet.rules.forEach((rule) => {
    const selector = scopeCssSelector(`${rule.selector}${rule.state ? `:${rule.state}` : ''}`, scope);
    if (!selector) return;
    const declarations = Object.entries(rule.declarations)
      .filter(([property, value]) => /^--?[A-Za-z][A-Za-z0-9-]*$/.test(property) && !/[{}]|expression\s*\(|javascript:/i.test(value))
      .map(([property, value]) => `${property}:${value}`)
      .join(';');
    if (!declarations) return;
    const output = `${selector}{${declarations}}`;
    if (rule.breakpoint === 'tablet') tabletRules.push(output);
    else if (rule.breakpoint === 'mobile') mobileRules.push(output);
    else baseRules.push(output);
  });
  if (tabletRules.length) baseRules.push(`@media(max-width:991.98px){${tabletRules.join('')}}`);
  if (mobileRules.length) baseRules.push(`@media(max-width:575.98px){${mobileRules.join('')}}`);
  return baseRules.join('\n');
};

export function compileDocument(document: HtmlStudioDocument): HtmlTemplateArtifact {
  const diagnostics = validateDocument(document);
  const hasErrors = diagnostics.some((item) => item.severity === 'error');
  return {
    templateId: document.id,
    revision: String(document.version),
    schemaVersion: 1,
    html: hasErrors ? '' : document.root.map(compileNode).join(''),
    cssText: hasErrors ? '' : compileCss(document),
    dependencies: document.dependencies,
    diagnostics,
    compiledAt: new Date().toISOString(),
  };
}

