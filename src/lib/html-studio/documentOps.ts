import { isAllowedTag, sanitizeAttribute } from './sanitizer';
import type { HtmlStudioDocument, StudioNode } from './types';

export const createNodeId = (prefix = 'node') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function findNode(nodes: StudioNode[], id: string): StudioNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.children || [], id);
    if (nested) return nested;
  }
  return null;
}

export function updateNode(nodes: StudioNode[], id: string, update: (node: StudioNode) => StudioNode): StudioNode[] {
  return nodes.map((node) => node.id === id ? update(node) : { ...node, children: node.children ? updateNode(node.children, id, update) : undefined });
}

export function removeNode(nodes: StudioNode[], id: string): StudioNode[] {
  return nodes.filter((node) => node.id !== id).map((node) => ({ ...node, children: node.children ? removeNode(node.children, id) : undefined }));
}

export function appendNode(nodes: StudioNode[], parentId: string | null, child: StudioNode): StudioNode[] {
  if (!parentId) return [...nodes, child];
  return updateNode(nodes, parentId, (parent) => ({ ...parent, children: [...(parent.children || []), child] }));
}

const serializeAttributes = (node: StudioNode) => {
  const attributes = Object.entries(node.attributes || {}).filter(([, value]) => typeof value !== 'object').map(([key, value]) => `${key}="${String(value ?? '').replace(/"/g, '&quot;')}"`);
  if (node.classList?.length) attributes.push(`class="${node.classList.join(' ')}"`);
  return attributes.length ? ` ${attributes.join(' ')}` : '';
};

export function serializeStudioNodes(nodes: StudioNode[], depth = 0): string {
  const indent = '  '.repeat(depth);
  return nodes.map((node) => {
    if (node.kind === 'text') return `${indent}${node.text || ''}`;
    if (node.kind === 'component') return `${indent}<Shared:Component ref="component://${node.componentRef?.id || ''}" instance-id="${node.id}"${serializeAttributes(node)} />`;
    const tag = node.tag || 'div';
    const children = node.children || [];
    if (!children.length) return `${indent}<${tag}${serializeAttributes(node)}></${tag}>`;
    return `${indent}<${tag}${serializeAttributes(node)}>\n${serializeStudioNodes(children, depth + 1)}\n${indent}</${tag}>`;
  }).join('\n');
}

export function parseHtmlSource(source: string): { nodes: StudioNode[]; errors: string[] } {
  if (typeof DOMParser === 'undefined') return { nodes: [], errors: ['HTML parser is available in the browser only.'] };
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const errors: string[] = [];
  const convert = (domNode: ChildNode): StudioNode | null => {
    if (domNode.nodeType === Node.TEXT_NODE) {
      const text = domNode.textContent || '';
      if (!text.trim()) return null;
      return { id: createNodeId('text'), kind: 'text', text: text.trim() };
    }
    if (!(domNode instanceof HTMLElement)) return null;
    const tag = domNode.tagName.toLowerCase();
    if (tag === 'shared:component') {
      const ref = domNode.getAttribute('ref') || '';
      const id = ref.startsWith('component://') ? ref.slice('component://'.length) : ref;
      const attributes: Record<string, string> = {};
      Array.from(domNode.attributes).forEach((attribute) => { if (attribute.name !== 'ref' && attribute.name !== 'instance-id') attributes[attribute.name] = attribute.value; });
      return { id: domNode.getAttribute('instance-id') || createNodeId('shared'), kind: 'component', componentRef: { id, scope: 'platform', displayName: id }, attributes, children: Array.from(domNode.childNodes).map(convert).filter((item): item is StudioNode => Boolean(item)) };
    }
    if (!isAllowedTag(tag)) { errors.push(`Tag <${tag}> is not supported.`); return null; }
    const attributes: Record<string, string> = {};
    Array.from(domNode.attributes).forEach((attribute) => {
      if (attribute.name === 'class' || attribute.name === 'data-studio-id') return;
      const value = sanitizeAttribute(attribute.name, attribute.value);
      if (value === null) errors.push(`Attribute '${attribute.name}' on <${tag}> is not allowed.`);
      else attributes[attribute.name] = value;
    });
    return { id: domNode.dataset.studioId || createNodeId(tag), kind: 'element', tag, classList: (domNode.className || '').split(/\s+/).filter(Boolean), attributes, children: Array.from(domNode.childNodes).map(convert).filter((item): item is StudioNode => Boolean(item)) };
  };
  return { nodes: Array.from(parsed.body.childNodes).map(convert).filter((item): item is StudioNode => Boolean(item)), errors };
}

export function cloneDocument(document: HtmlStudioDocument): HtmlStudioDocument {
  return JSON.parse(JSON.stringify(document)) as HtmlStudioDocument;
}
