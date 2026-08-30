import type { ComponentNode, PageStyleRule, PageStyleSheet } from '@/types';

const CSS_PROPERTY = /^(?:--[A-Za-z][A-Za-z0-9-]*|-?[A-Za-z][A-Za-z0-9-]*)$/;
const UNSAFE_VALUE = /[{}]|expression\s*\(|javascript:/i;
const UNSAFE_SELECTOR = /[{}]|(?:^|[\s,>+~])(?:html|body|:root)(?:$|[\s.#:[>+~])/i;

const cssAttributeValue = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, (character) => `\\${character.codePointAt(0)?.toString(16)} `);
const safeScopeId = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '-');

function compileRule(rule: PageStyleRule, scopeId: string): string | null {
  const descendant = (rule.selector || '').trim();
  if (descendant && UNSAFE_SELECTOR.test(descendant)) return null;

  const declarations = Object.entries(rule.declarations || {})
    .filter(([property, value]) => CSS_PROPERTY.test(property) && typeof value === 'string' && value.trim() && !UNSAFE_VALUE.test(value))
    .map(([property, value]) => `${property}:${value.trim()}`)
    .join(';');
  if (!declarations) return null;

  const state = rule.state ? `:${rule.state}` : '';
  const scope = `[data-page-style-scope="${safeScopeId(scopeId)}"]`;
  const target = rule.componentId
    ? `${scope} [data-component-instance-id="${cssAttributeValue(rule.componentId)}"]`
    : rule.layoutRegion
      ? `${scope} [data-layout-region="${cssAttributeValue(rule.layoutRegion)}"]`
      : scope;
  const selector = descendant ? `${target} ${descendant}${state}` : `${target}${state}`;
  return `${selector}{${declarations}}`;
}

export function compilePageStyleSheet(styleSheet?: PageStyleSheet): string {
  if (!styleSheet?.scopeId || !Array.isArray(styleSheet.rules)) return '';
  const base: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];

  styleSheet.rules.forEach((rule) => {
    const css = compileRule(rule, styleSheet.scopeId);
    if (!css) return;
    if (rule.breakpoint === 'tablet') tablet.push(css);
    else if (rule.breakpoint === 'mobile') mobile.push(css);
    else base.push(css);
  });

  if (tablet.length) base.push(`@media(max-width:991.98px){${tablet.join('')}}`);
  if (mobile.length) base.push(`@media(max-width:575.98px){${mobile.join('')}}`);
  return base.join('\n');
}

const reactStylePropertyToCss = (property: string) => property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^ms-/, '-ms-');

/** Complete readable page CSS, including base styles stored inline on component instances. */
export function compilePageCss(styleSheet: PageStyleSheet | undefined, nodes: ComponentNode[]): string {
  const scopeId = styleSheet?.scopeId;
  const inlineRules: string[] = [];
  const visit = (node: ComponentNode) => {
    if (scopeId && node.style && Object.keys(node.style).length) {
      const declarations = Object.entries(node.style)
        .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
        .map(([property, value]) => `${reactStylePropertyToCss(property)}:${String(value)}`)
        .join(';');
      if (declarations) inlineRules.push(`[data-page-style-scope="${safeScopeId(scopeId)}"] [data-component-instance-id="${cssAttributeValue(node.id)}"]{${declarations}}`);
    }
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return [...inlineRules, compilePageStyleSheet(styleSheet)].filter(Boolean).join('\n');
}
