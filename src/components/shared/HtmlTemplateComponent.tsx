'use client';

import React, { useMemo } from 'react';
import { compileDocument, createEmptyManifests, PlatformReferenceResolver, sanitizeAttribute, type HtmlTemplateComponentProps, type StudioNode } from '@/lib/html-studio';

const RuntimeNode: React.FC<{ node: StudioNode; registry: NonNullable<HtmlTemplateComponentProps['componentRegistry']>; resolveAsset: (ref: string) => string }> = ({ node, registry, resolveAsset }) => {
  if (node.kind === 'text') return <>{node.text || ''}</>;
  if (node.kind === 'slot') return <>{node.children?.map((child) => <RuntimeNode key={child.id} node={child} registry={registry} resolveAsset={resolveAsset}/>)}</>;
  if (node.kind === 'component') {
    const Target = registry[node.componentRef?.id as keyof typeof registry];
    if (!Target) return <div className="alert alert-warning mb-2">Shared component &apos;{node.componentRef?.displayName || node.componentRef?.id}&apos; is unavailable.</div>;
    const props = { ...(node.attributes || {}) };
    return <div id={typeof node.attributes?.id === 'string' ? node.attributes.id : undefined} data-component-instance-id={node.id} data-layout-region={typeof node.attributes?.__layoutRegion === 'string' ? node.attributes.__layoutRegion : typeof node.attributes?.__sectionId === 'string' ? node.attributes.__sectionId : undefined}><Target {...props}>{node.children?.map((child) => <RuntimeNode key={child.id} node={child} registry={registry} resolveAsset={resolveAsset}/>)}</Target></div>;
  }
  const Tag = (node.tag || 'div') as keyof React.JSX.IntrinsicElements;
  const props: Record<string, unknown> = {};
  Object.entries(node.attributes || {}).forEach(([name, value]) => { if (typeof value !== 'object') { const safe = sanitizeAttribute(name, value); if (safe !== null) props[name] = name === 'src' && safe.startsWith('asset://') ? resolveAsset(safe) : safe; } });
  if (node.classList?.length) props.className = node.classList.join(' ');
  return <Tag {...props}>{node.children?.map((child) => <RuntimeNode key={child.id} node={child} registry={registry} resolveAsset={resolveAsset}/>)}</Tag>;
};

export const HtmlTemplateComponent: React.FC<HtmlTemplateComponentProps> = ({ document, artifact, className = '', componentRegistry = {}, runtimeContext, manifests }) => {
  const compiled = useMemo(() => artifact || (document ? compileDocument(document) : null), [artifact, document]);
  if (!compiled) return <div className="alert alert-secondary mb-0">HTML template is not configured.</div>;
  const errors = compiled.diagnostics.filter((item) => item.severity === 'error');
  if (errors.length) return <div className="alert alert-danger mb-0"><strong>HTML template cannot be rendered.</strong><ul className="mb-0 mt-2">{errors.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul></div>;
  const scopeId = document?.styleSheet.scopeId || `artifact-${compiled.templateId}`;
  const resolveAsset = (ref: string) => {
    if (runtimeContext) {
      try { return new PlatformReferenceResolver(runtimeContext, { ...createEmptyManifests(), ...manifests }).asset(ref); } catch { /* use stable runtime endpoint below */ }
    }
    const id = ref.replace(/^asset:\/\//, '');
    return `/api/runtime/assets/${encodeURIComponent(id)}/published/original`;
  };
  return <div className={`html-template-component ${className}`} data-hs-scope={scopeId} data-template-id={compiled.templateId}>
    {compiled.cssText && <style>{compiled.cssText}</style>}
    {document ? document.root.map((node) => <RuntimeNode key={node.id} node={node} registry={componentRegistry} resolveAsset={resolveAsset}/>) : <div dangerouslySetInnerHTML={{ __html: compiled.html }} />}
  </div>;
};
