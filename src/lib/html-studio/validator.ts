import type { HtmlStudioDocument, StudioDiagnostic, StudioNode } from './types';
import { isAllowedTag } from './sanitizer';

const REF_PATTERN = /^(page|route|asset|component|collection|template):\/\/[A-Za-z0-9._-]+$/;

export function validateDocument(document: HtmlStudioDocument): StudioDiagnostic[] {
  const diagnostics: StudioDiagnostic[] = [];
  const ids = new Set<string>();
  const visit = (node: StudioNode) => {
    if (!node.id) diagnostics.push({ severity: 'error', code: 'NODE_ID_REQUIRED', message: 'Every Studio node requires a stable ID.' });
    else if (ids.has(node.id)) diagnostics.push({ severity: 'error', code: 'DUPLICATE_NODE_ID', message: `Duplicate node ID '${node.id}'.`, nodeId: node.id });
    else ids.add(node.id);
    if (node.kind === 'element' && (!node.tag || !isAllowedTag(node.tag))) diagnostics.push({ severity: 'error', code: 'TAG_NOT_ALLOWED', message: `Element '${node.tag || '(empty)'}' is not allowed.`, nodeId: node.id });
    if (node.kind === 'component' && !node.componentRef?.id) diagnostics.push({ severity: 'error', code: 'COMPONENT_REF_REQUIRED', message: 'Shared component node requires a component reference.', nodeId: node.id });
    Object.values(node.attributes || {}).forEach((value) => {
      if (typeof value === 'string' && value.includes('://') && !REF_PATTERN.test(value)) diagnostics.push({ severity: 'warning', code: 'UNKNOWN_REFERENCE', message: `Value '${value}' is not a supported stable reference.`, nodeId: node.id });
    });
    node.children?.forEach(visit);
  };
  document.root.forEach(visit);
  if (document.settings.scriptPolicy !== 'none') diagnostics.push({ severity: 'error', code: 'SCRIPT_POLICY', message: 'HTML Studio does not allow user scripts.' });
  return diagnostics;
}

