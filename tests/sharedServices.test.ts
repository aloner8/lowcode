import { describe, expect, it } from 'vitest';
import { createDefaultJwtAuthService } from '@/types';
import { getServiceDefinition, listServiceDefinitions } from '@/lib/services/catalog';
import { normalizeServiceBinding, validateServiceBinding } from '@/lib/services/bindings';
import { validateSchema } from '@/lib/services/schemaValidator';
import { validateServicesForPublish } from '@/lib/services/publishValidation';
import { issueJwt, verifyJwt } from '@/lib/services/jwtAuthService';

describe('shared service catalog', () => {
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

describe('tenant service token isolation', () => {
  it('pins issuer and audience and preserves token use', () => {
    const config = { algorithm: 'HS256' as const, issuer: 'app-a', audience: 'app-a-runtime', accessTokenTtlSeconds: 900, secretEnvKey: 'TEST' };
    const token = issueJwt({ sub: 'user-1', tokenUse: 'refresh' }, config, 'a-secret-long-enough-for-the-test');
    expect(verifyJwt(token, config, 'a-secret-long-enough-for-the-test').tokenUse).toBe('refresh');
    expect(() => verifyJwt(token, { ...config, issuer: 'app-b' }, 'a-secret-long-enough-for-the-test')).toThrow('claims');
  });
});
