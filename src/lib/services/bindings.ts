import type { StudioServiceDefinition } from '@/types';
import { getServiceDefinition } from './catalog';
import { validateSchema } from './schemaValidator';

export function serviceKeyOf(binding: StudioServiceDefinition): string {
  if (binding.serviceRef?.serviceKey) return binding.serviceRef.serviceKey;
  if (binding.id === 'service.auth.jwt') return 'auth.session';
  return binding.kind === 'data' ? 'data.collection' : binding.kind === 'storage' ? 'storage.object' : binding.kind === 'notification' ? 'notification.email' : binding.kind === 'google' ? 'google.workspace' : binding.kind === 'media' ? 'media.local' : 'auth.session';
}

export function normalizeServiceBinding(binding: StudioServiceDefinition): StudioServiceDefinition {
  const serviceKey = serviceKeyOf(binding);
  const definition = getServiceDefinition(serviceKey, binding.serviceRef?.version);
  return {
    ...binding,
    serviceRef: { serviceKey, version: binding.serviceRef?.version ?? definition?.version ?? '1.0.0' },
    scope: binding.scope ?? 'app',
    containerBindings: binding.containerBindings ?? [],
    secretRefs: binding.secretRefs ?? (serviceKey === 'auth.session' ? { signingKey: `env://${binding.config.secretEnvKey || 'PLATFORM_JWT_SECRET'}` } : {}),
    policy: binding.policy ?? { allowedOperations: Object.keys(definition?.operations ?? {}) },
    status: binding.status ?? 'draft',
  };
}

export function validateServiceBinding(binding: StudioServiceDefinition): { valid: boolean; errors: string[]; binding: StudioServiceDefinition } {
  const normalized = normalizeServiceBinding(binding);
  const definition = getServiceDefinition(normalized.serviceRef!.serviceKey, normalized.serviceRef!.version);
  const errors: string[] = [];
  if (!definition) errors.push(`Service ${normalized.serviceRef!.serviceKey}@${normalized.serviceRef!.version} is unavailable`);
  if (definition) {
    errors.push(...validateSchema(definition.propertySchema, normalized.config).errors);
    if (definition.serviceKey === 'notification.email' && normalized.config.transport === 'smtp') {
      if (typeof normalized.config.smtpHost !== 'string' || !normalized.config.smtpHost.trim()) errors.push('SMTP host is required');
      if (!Number.isInteger(normalized.config.smtpPort)) errors.push('SMTP port is required');
      if (!['none', 'starttls', 'tls'].includes(String(normalized.config.smtpTlsMode))) errors.push('SMTP TLS mode is invalid');
      if (!['none', 'basic'].includes(String(normalized.config.smtpAuthMode))) errors.push('SMTP auth mode is invalid');
    }
    if (definition.serviceKey === 'auth.session') {
      const providers = Array.isArray(normalized.config.providers) ? normalized.config.providers.map(String) : ['local'];
      if (providers.some((provider) => provider === 'ldap' || provider === 'ad-ds')) {
        if (typeof normalized.config.directoryUrl !== 'string' || !normalized.config.directoryUrl.startsWith('ldaps://')) errors.push('Directory URL must use ldaps://');
        if (typeof normalized.config.directoryBaseDn !== 'string' || !normalized.config.directoryBaseDn.trim()) errors.push('Directory base DN is required');
        if (typeof normalized.config.directoryUserFilter !== 'string' || !normalized.config.directoryUserFilter.includes('{{username}}')) errors.push('Directory user filter must include {{username}}');
      }
    }
    if (definition.serviceKey === 'google.workspace') {
      const features = Array.isArray(normalized.config.features) ? normalized.config.features.map(String) : [];
      if (features.includes('maps') && (typeof normalized.config.browserMapsKey !== 'string' || !normalized.config.browserMapsKey.trim())) errors.push('A domain-restricted browser Maps key is required when Maps is enabled');
    }
    for (const operation of normalized.policy?.allowedOperations ?? []) if (!definition.operations[operation]) errors.push(`Operation '${operation}' does not exist`);
  }
  return { valid: errors.length === 0, errors, binding: { ...normalized, status: errors.length ? 'invalid' : 'valid', validationErrors: errors } };
}

export function bindingFor(services: unknown, bindingId: string): StudioServiceDefinition | undefined {
  if (!Array.isArray(services)) return undefined;
  const found = services.find((item) => item && typeof item === 'object' && (item as { id?: string }).id === bindingId) as StudioServiceDefinition | undefined;
  return found ? normalizeServiceBinding(found) : undefined;
}
