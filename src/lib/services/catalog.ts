import type { JsonSchema, SharedServiceDefinition } from '@/types';

const object = (properties: Record<string, JsonSchema>, required: string[] = [], additionalProperties = false): JsonSchema => ({
  type: 'object', properties, required, additionalProperties,
});
const resultSchema = object({});

const definitions: SharedServiceDefinition[] = [
  {
    serviceKey: 'auth.session', displayName: 'Auth Session', kind: 'auth', version: '1.0.0', lifecycle: 'active',
    defaultConfig: { identityField: 'email', accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800, requiredStatus: 'active' },
    propertySchema: object({
      identityField: { type: 'string', title: 'Login identity', description: 'Field used to sign in on the generated Login page.', enum: ['email', 'username'] },
      accessTokenTtlSeconds: { type: 'integer', minimum: 300, maximum: 86400 },
      refreshTokenTtlSeconds: { type: 'integer', minimum: 3600, maximum: 2592000 },
      requiredStatus: { type: 'string', enum: ['active'] },
      issuer: { type: 'string', minLength: 1, maxLength: 160 }, audience: { type: 'string', minLength: 1, maxLength: 160 },
      algorithm: { type: 'string', enum: ['HS256'] }, secretEnvKey: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,100}$' },
    }, ['accessTokenTtlSeconds']),
    operations: {
      login: { inputSchema: object({ email: { type: 'string', minLength: 1, maxLength: 320 }, username: { type: 'string', minLength: 1, maxLength: 100 }, password: { type: 'string', minLength: 1, maxLength: 1024 } }, ['password']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      logout: { inputSchema: object({}), outputSchema: resultSchema, execution: 'sync', idempotency: 'supported' },
      me: { inputSchema: object({}), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      refresh: { inputSchema: object({}), outputSchema: resultSchema, execution: 'sync', idempotency: 'supported' },
      changePassword: { inputSchema: object({ currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 10, maxLength: 1024 } }, ['currentPassword', 'newPassword']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
    },
  },
  {
    serviceKey: 'data.collection', displayName: 'Collection Data', kind: 'data', version: '1.0.0', lifecycle: 'active',
    defaultConfig: { allowedOperations: ['list', 'get'], readableFields: ['*'], writableFields: [], allowedFilters: [], maxPageSize: 100 },
    propertySchema: object({
      collectionId: { type: 'string', minLength: 1, maxLength: 160 }, table: { type: 'string', pattern: '^[a-z_][a-z0-9_]{0,62}$' },
      allowedOperations: { type: 'array', items: { type: 'string', enum: ['list', 'get', 'create', 'update', 'delete', 'count'] } },
      readableFields: { type: 'array', items: { type: 'string', pattern: '^(\\*|[a-z_][a-z0-9_]*)$' } },
      writableFields: { type: 'array', items: { type: 'string', pattern: '^[a-z_][a-z0-9_]*$' } },
      allowedFilters: { type: 'array', items: { type: 'string', pattern: '^[a-z_][a-z0-9_]*:(eq|ne|gt|gte|lt|lte|contains|in)$' } },
      defaultSort: { type: 'string', maxLength: 100 }, maxPageSize: { type: 'integer', minimum: 1, maximum: 200 }, public: { type: 'boolean' },
    }, ['table', 'allowedOperations']),
    operations: Object.fromEntries(['list', 'get', 'create', 'update', 'delete', 'count'].map((name) => [name, { inputSchema: object({}, [], true), outputSchema: resultSchema, execution: 'sync', idempotency: ['create', 'update', 'delete'].includes(name) ? 'supported' : 'none' }])) as SharedServiceDefinition['operations'],
  },
  {
    serviceKey: 'storage.object', displayName: 'Tenant Object Storage', kind: 'storage', version: '1.0.0', lifecycle: 'active',
    defaultConfig: { rootNamespace: 'shared', allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'], maxFileBytes: 10485760, maxFilesPerRequest: 5, visibility: 'private' },
    propertySchema: object({
      rootNamespace: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,199}$' }, allowedMimeTypes: { type: 'array', items: { type: 'string', maxLength: 160 } },
      maxFileBytes: { type: 'integer', minimum: 1, maximum: 104857600 }, maxFilesPerRequest: { type: 'integer', minimum: 1, maximum: 20 },
      visibility: { type: 'string', enum: ['private', 'public'] }, retentionDays: { type: 'integer', minimum: 1, maximum: 3650 },
    }, ['rootNamespace', 'allowedMimeTypes', 'maxFileBytes']),
    operations: {
      upload: { inputSchema: object({ files: { type: 'array' } }, ['files']), outputSchema: resultSchema, execution: 'sync', idempotency: 'supported' },
      list: { inputSchema: object({ path: { type: 'string', maxLength: 300 } }), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      getMetadata: { inputSchema: object({ assetId: { type: 'string' } }, ['assetId']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      delete: { inputSchema: object({ assetId: { type: 'string' } }, ['assetId']), outputSchema: resultSchema, requiredPermission: 'storage.delete', execution: 'sync', idempotency: 'supported' },
    },
  },
  {
    serviceKey: 'notification.email', displayName: 'Email Notification', kind: 'notification', version: '1.0.0', lifecycle: 'active',
    defaultConfig: { allowedTemplateIds: [], allowedRecipientMode: 'field', dailyQuota: 5000 },
    propertySchema: object({
      fromName: { type: 'string', minLength: 1, maxLength: 160 }, fromAddress: { type: 'string', minLength: 3, maxLength: 320 }, replyTo: { type: 'string', maxLength: 320 },
      allowedTemplateIds: { type: 'array', items: { type: 'string', maxLength: 160 } }, allowedRecipientMode: { type: 'string', enum: ['user', 'field', 'fixed-domain'] },
      allowedRecipientDomain: { type: 'string', maxLength: 255 }, dailyQuota: { type: 'integer', minimum: 1, maximum: 100000 },
      templates: { type: 'object' },
    }, ['fromName', 'fromAddress', 'allowedTemplateIds']),
    operations: {
      sendTemplate: { inputSchema: object({ templateId: { type: 'string' }, to: { type: 'string' }, variables: { type: 'object' } }, ['templateId', 'to', 'variables']), outputSchema: resultSchema, execution: 'async', idempotency: 'required' },
      getDeliveryStatus: { inputSchema: object({ jobId: { type: 'string' } }, ['jobId']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
    },
  },
];

export const SERVICE_CATALOG = Object.freeze(definitions);
export const getServiceDefinition = (serviceKey: string, version?: string) => SERVICE_CATALOG.find((item) => item.serviceKey === serviceKey && (!version || item.version === version));
export const listServiceDefinitions = () => [...SERVICE_CATALOG];
