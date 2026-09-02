import type { StudioServiceDefinition } from '@/types';
import { normalizeServiceBinding, validateServiceBinding } from './bindings';
import { getServiceDefinition } from './catalog';
import { validateBindingSecretReferences } from './secrets';

export interface ServicePublishValidation { valid: boolean; errors: string[]; services: StudioServiceDefinition[] }

export function validateServicesForPublish(servicesInput: unknown, flowsInput: unknown, options: { checkSecrets?: boolean } = {}): ServicePublishValidation {
  const source = Array.isArray(servicesInput) ? servicesInput as StudioServiceDefinition[] : [];
  const errors: string[] = []; const seen = new Set<string>();
  const services = source.map((entry) => {
    const result = validateServiceBinding(entry);
    if (seen.has(entry.id)) errors.push(`Duplicate service binding '${entry.id}'`); seen.add(entry.id);
    if (entry.enabled && !result.valid) errors.push(...result.errors.map((message) => `${entry.id}: ${message}`));
    if (entry.enabled && options.checkSecrets) errors.push(...validateBindingSecretReferences(result.binding).map((message) => `${entry.id}: ${message}`));
    return { ...result.binding, status: result.valid ? 'published' as const : 'invalid' as const };
  });
  const byId = new Map(services.map((service) => [service.id, service]));
  for (const flow of Array.isArray(flowsInput) ? flowsInput : []) {
    const nodes = Array.isArray((flow as any)?.nodes) ? (flow as any).nodes : [];
    for (const node of nodes) {
      if (node?.data?.actionType !== 'serviceCall') continue;
      const bindingId = String(node.data.config?.bindingId || ''); const operation = String(node.data.config?.operation || ''); const binding = byId.get(bindingId);
      if (!binding) { errors.push(`Flow node '${node.id}' references missing binding '${bindingId}'`); continue; }
      const definition = getServiceDefinition(normalizeServiceBinding(binding).serviceRef!.serviceKey, normalizeServiceBinding(binding).serviceRef!.version);
      if (!definition?.operations[operation]) errors.push(`Flow node '${node.id}' references invalid operation '${operation}'`);
    }
  }
  return { valid: errors.length === 0, errors, services };
}
