import { describe, expect, it } from 'vitest';
import { createDefaultJwtAuthService } from '@/types';
import { getServiceDefinition, listServiceDefinitions } from '@/lib/services/catalog';
import { normalizeServiceBinding, validateServiceBinding } from '@/lib/services/bindings';
import { validateAppBindingOverridePolicy } from '@/lib/services/configPolicy';
import { validateSchema } from '@/lib/services/schemaValidator';
import { validateServicesForPublish } from '@/lib/services/publishValidation';
import { issueJwt, verifyJwt } from '@/lib/services/jwtAuthService';
import { validateBindingSecretReferences } from '@/lib/services/secrets';

describe('shared service catalog', () => {
  it('validates an SMTP binding and keeps credentials in the protected namespace', () => {
    const binding = {
      id: 'mail.office', name: 'Office SMTP', kind: 'notification' as const, enabled: true,
      serviceRef: { serviceKey: 'notification.email', version: '1.0.0' },
      config: {
        transport: 'smtp', smtpHost: 'smtp.internal', smtpPort: 587, smtpTlsMode: 'starttls', smtpAuthMode: 'basic',
        smtpRejectUnauthorized: true, smtpConnectionTimeoutMs: 10000, smtpSocketTimeoutMs: 60000,
        fromName: 'Office', fromAddress: 'noreply@example.test', allowedTemplateIds: ['welcome'], maxAttachmentBytes: 1024,
      },
      secretRefs: { smtpUsername: 'env://LOWCODE_CONNECTION_SMTP_USER', smtpPassword: 'env://LOWCODE_CONNECTION_SMTP_PASSWORD' },
      policy: { allowedOperations: ['sendTemplate', 'previewTemplate', 'getDeliveryStatus'] }, containerBindings: [],
    };
    expect(validateServiceBinding(binding).valid).toBe(true);
    expect(validateBindingSecretReferences(binding)).toEqual([
      "Secret reference 'smtpUsername' is not configured",
      "Secret reference 'smtpPassword' is not configured",
    ]);
    expect(validateBindingSecretReferences({ ...binding, secretRefs: { ...binding.secretRefs, smtpPassword: 'env://PLATFORM_JWT_SECRET' } }))
      .toContain("SMTP secret reference 'smtpPassword' must use the LOWCODE_CONNECTION_ namespace");
  });

  it('registers the four initial capabilities', () => {
    expect(listServiceDefinitions().map((item) => item.serviceKey)).toEqual([
      'auth.session', 'data.collection', 'storage.object', 'notification.email',
    ]);
  });

  it('migrates the legacy JWT binding without copying its implementation', () => {
    const legacy = createDefaultJwtAuthService('demo');
    delete legacy.serviceRef; delete legacy.policy; delete legacy.secretRefs;
    const migrated = normalizeServiceBinding(legacy);
    expect(migrated.serviceRef).toEqual({ serviceKey: 'auth.session', version: '1.0.0' });
    expect(migrated.secretRefs).toEqual({ signingKey: 'env://PLATFORM_JWT_SECRET' });
    expect(migrated.policy?.allowedOperations).toContain('login');
  });

  it('validates binding properties against the catalog schema', () => {
    const auth = validateServiceBinding(createDefaultJwtAuthService('demo'));
    expect(auth.valid, auth.errors.join('\n')).toBe(true);
    const data = validateServiceBinding({ id: 'app.news', name: 'News', kind: 'data', enabled: true, serviceRef: { serviceKey: 'data.collection', version: '1.0.0' }, config: { allowedOperations: ['list'] }, containerBindings: [] });
    expect(data.valid).toBe(false);
    expect(data.errors.join(' ')).toContain('table');
  });

  it('supports username as the configured login identity', () => {
    const definition = getServiceDefinition('auth.session')!;
    expect(definition.propertySchema.properties?.identityField.enum).toEqual(['email', 'username']);
    expect(validateSchema(definition.operations.login.inputSchema, { username: 'arthit', password: 'secret' }).valid).toBe(true);
    const auth = createDefaultJwtAuthService('demo');
    auth.config.identityField = 'username';
    expect(validateServiceBinding(auth).valid).toBe(true);
  });

  it('publishes registration, provider discovery, external login and revocation contracts', () => {
    const definition = getServiceDefinition('auth.session')!;
    expect(Object.keys(definition.operations)).toEqual(expect.arrayContaining([
      'register', 'listProviders', 'startExternalLogin', 'completeExternalLogin', 'revokeSessions',
    ]));
    expect(definition.propertySchema.properties?.providers.items?.enum).toEqual([
      'local', 'google', 'line', 'facebook', 'ldap', 'ad-ds', 'entra',
    ]);
  });

  it('rejects unknown object properties and bad numeric bounds', () => {
    const schema = getServiceDefinition('auth.session')!.propertySchema;
    expect(validateSchema(schema, { accessTokenTtlSeconds: 10, unexpected: true }).errors).toEqual(expect.arrayContaining([expect.stringContaining('at least'), expect.stringContaining('not allowed')]));
  });
});

describe('publish validation', () => {
  it('catches missing bindings referenced by serviceCall nodes', () => {
    const result = validateServicesForPublish([createDefaultJwtAuthService('demo')], [{ nodes: [{ id: 'send', data: { actionType: 'serviceCall', config: { bindingId: 'app.mail', operation: 'sendTemplate' } } }] }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('missing binding');
  });

  it('freezes valid bindings as published', () => {
    const result = validateServicesForPublish([createDefaultJwtAuthService('demo')], []);
    expect(result.valid, result.errors.join('\n')).toBe(true);
    expect(result.services[0].status).toBe('published');
  });
});

describe('app service override policy', () => {
  it('lets app overrides narrow config policy without changing the connection contract', () => {
    const parent = createDefaultJwtAuthService('demo');
    parent.policy = {
      allowedOperations: ['login', 'me', 'refresh'],
      requiredPermissions: { me: ['profile.read', 'profile.audit'] },
      rateLimit: { requests: 100, windowSeconds: 60 },
    };
    const override = structuredClone(parent);
    override.scope = 'app';
    override.policy = {
      allowedOperations: ['login', 'me'],
      requiredPermissions: { me: ['profile.read'] },
      rateLimit: { requests: 50, windowSeconds: 120 },
    };

    const result = validateAppBindingOverridePolicy([parent], override);
    expect(result.valid, result.errors.join('\n')).toBe(true);
  });

  it('rejects app overrides that expand platform connection policy', () => {
    const parent = createDefaultJwtAuthService('demo');
    parent.enabled = false;
    parent.policy = {
      allowedOperations: ['login'],
      requiredPermissions: { login: ['auth.login'] },
      rateLimit: { requests: 10, windowSeconds: 60 },
    };
    const override = structuredClone(parent);
    override.enabled = true;
    override.serviceRef = { serviceKey: 'notification.email', version: '1.0.0' };
    override.policy = {
      allowedOperations: ['login', 'me'],
      requiredPermissions: { login: ['auth.login', 'admin.root'] },
      rateLimit: { requests: 20, windowSeconds: 10 },
    };

    const result = validateAppBindingOverridePolicy([parent], override);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('cannot change serviceKey');
    expect(result.errors.join(' ')).toContain('cannot enable a disabled platform connection');
    expect(result.errors.join(' ')).toContain('cannot add operations: me');
    expect(result.errors.join(' ')).toContain("cannot add permissions for 'login': admin.root");
    expect(result.errors.join(' ')).toContain('cannot raise rateLimit.requests');
    expect(result.errors.join(' ')).toContain('cannot shorten rateLimit.windowSeconds');
  });

  it('requires app overrides to point at a platform-published binding', () => {
    const override = createDefaultJwtAuthService('demo');
    override.id = 'service.auth.other';
    const result = validateAppBindingOverridePolicy([createDefaultJwtAuthService('demo')], override);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('must reference a platform-published connection');
  });
});

describe('tenant service token isolation', () => {
  it('pins issuer and audience and preserves token use', () => {
    const config = { algorithm: 'HS256' as const, issuer: 'app-a', audience: 'app-a-runtime', accessTokenTtlSeconds: 900, secretEnvKey: 'TEST' };
    const token = issueJwt({ sub: 'user-1', tokenUse: 'refresh' }, config, 'a-secret-long-enough-for-the-test');
    expect(verifyJwt(token, config, 'a-secret-long-enough-for-the-test').tokenUse).toBe('refresh');
    expect(() => verifyJwt(token, { ...config, issuer: 'app-b' }, 'a-secret-long-enough-for-the-test')).toThrow('claims');
  });
});
