export { ServiceError } from './errors.js';
export { validateSchema } from './schemaValidator.js';
export { resolveModuleOperation } from './registry.js';

import { ServiceError } from './errors.js';

interface BindingReference {
  id: string;
  enabled: boolean;
  serviceRef?: { serviceKey: string; version: string };
}

/** Never guess among multiple connections or silently resurrect a disabled binding. */
export function selectModuleBinding<T extends BindingReference>(bindings: T[], serviceKey: string, defaultId?: string): T {
  const candidates = bindings.filter(binding => binding.serviceRef?.serviceKey === serviceKey);
  const selected = defaultId ? candidates.find(binding => binding.id === defaultId) : candidates.length === 1 ? candidates[0] : undefined;
  if (!selected) throw new ServiceError('SERVICE_NOT_FOUND', candidates.length > 1 ? 'Select a default connection for this module in app settings' : 'This module has not been configured for this app', 409);
  if (!selected.enabled) throw new ServiceError('BINDING_DISABLED', 'This module is disabled', 409);
  return selected;
}
