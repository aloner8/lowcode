import 'server-only';
import { ServiceError } from './errors';
import type { StudioServiceDefinition } from '@/types';
import { serviceKeyOf } from './bindings';

const ENV_REF = /^env:\/\/([A-Z][A-Z0-9_]{2,100})$/;
const CONNECTION_ENV_REF = /^env:\/\/LOWCODE_CONNECTION_[A-Z0-9_]{1,80}$/;

export function resolveSecretReference(reference: string | undefined): string {
  if (!reference) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'Secret reference is not configured', 503);
  const match = ENV_REF.exec(reference);
  if (!match) throw new ServiceError('SERVICE_INPUT_INVALID', 'Unsupported secret reference', 400);
  const value = process.env[match[1]];
  if (!value) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', `Secret '${match[1]}' is unavailable`, 503);
  return value;
}

export function secretReferenceStatus(reference: string): { configured: boolean; provider: string } {
  const match = ENV_REF.exec(reference);
  return { configured: Boolean(match && process.env[match[1]]), provider: match ? 'environment' : 'unsupported' };
}

export function validateBindingSecretReferences(binding: StudioServiceDefinition): string[] {
  const providers = Array.isArray(binding.config.providers) ? binding.config.providers : ['local'];
  const socialSecretKeys = providers.flatMap((provider) => ['google', 'line', 'facebook', 'entra'].includes(String(provider)) ? [`${provider}ClientId`, `${provider}ClientSecret`] : []);
  const directorySecretKeys = providers.some((provider) => provider === 'ldap' || provider === 'ad-ds') ? ['directoryBindDn', 'directoryBindPassword'] : [];
  const googleFeatures = Array.isArray(binding.config.features) ? binding.config.features.map(String) : [];
  const googleWorkspaceKeys = googleFeatures.some((feature) => ['calendar', 'drive', 'forms'].includes(feature)) ? ['googleClientId', 'googleClientSecret', 'googleRefreshToken'] : [];
  const googleFeatureKeys = [...(googleFeatures.includes('vision') ? ['googleVisionApiKey'] : []), ...(googleFeatures.includes('ai') ? ['googleGeminiApiKey'] : [])];
  const required = serviceKeyOf(binding) === 'auth.session'
    ? ['signingKey', ...socialSecretKeys, ...directorySecretKeys]
    : serviceKeyOf(binding) === 'google.workspace'
      ? [...googleWorkspaceKeys, ...googleFeatureKeys]
    : serviceKeyOf(binding) === 'notification.email'
      ? binding.config.transport === 'smtp'
        ? binding.config.smtpAuthMode === 'none' ? [] : ['smtpUsername', 'smtpPassword']
        : ['providerEndpoint', 'providerToken']
      : [];
  const errors = required.flatMap((key) => {
    const reference = binding.secretRefs?.[key];
    if (!reference) return [`Secret reference '${key}' is required`];
    const status = secretReferenceStatus(reference);
    return status.provider === 'unsupported' ? [`Secret reference '${key}' has an unsupported format`] : !status.configured ? [`Secret reference '${key}' is not configured`] : [];
  });
  if (serviceKeyOf(binding) === 'notification.email' && binding.config.transport === 'smtp') {
    for (const [key, reference] of Object.entries(binding.secretRefs || {})) {
      if (!CONNECTION_ENV_REF.test(reference)) errors.push(`SMTP secret reference '${key}' must use the LOWCODE_CONNECTION_ namespace`);
    }
  }
  if (serviceKeyOf(binding) === 'auth.session') {
    for (const key of [...socialSecretKeys, ...directorySecretKeys]) {
      const reference = binding.secretRefs?.[key];
      if (reference && !CONNECTION_ENV_REF.test(reference)) errors.push(`External Auth secret reference '${key}' must use the LOWCODE_CONNECTION_ namespace`);
    }
  }
  if (serviceKeyOf(binding) === 'google.workspace') {
    for (const key of [...googleWorkspaceKeys, ...googleFeatureKeys]) {
      const reference = binding.secretRefs?.[key];
      if (reference && !CONNECTION_ENV_REF.test(reference)) errors.push(`Google secret reference '${key}' must use the LOWCODE_CONNECTION_ namespace`);
    }
  }
  return errors;
}
