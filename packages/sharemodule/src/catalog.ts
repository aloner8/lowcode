import type { JsonSchema, SharedServiceDefinition } from './contracts.js';

const object = (properties: Record<string, JsonSchema>, required: string[] = [], additionalProperties = false): JsonSchema => ({
  type: 'object', properties, required, additionalProperties,
});
const resultSchema = object({});

const definitions: SharedServiceDefinition[] = [
  {
    serviceKey: 'auth.session', displayName: 'Auth Session', kind: 'auth', version: '1.0.0', lifecycle: 'active',
    defaultConfig: { identityField: 'email', providers: ['local'], allowRegister: false, afterLogin: '/', accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800, requiredStatus: 'active' },
    propertySchema: object({
      identityField: { type: 'string', title: 'Login identity', description: 'Field used to sign in on the generated Login page.', enum: ['email', 'username'] },
      providers: { type: 'array', title: 'Login providers', items: { type: 'string', enum: ['local', 'google', 'line', 'facebook', 'ldap', 'ad-ds', 'entra'] } },
      allowRegister: { type: 'boolean', title: 'Allow member registration' },
      afterLogin: { type: 'string', title: 'After login path', pattern: '^/(?!/)[^\\s]*$' },
      directoryUrl: { type: 'string', title: 'Directory URL', pattern: '^ldaps://[^\\s]+$' },
      directoryBaseDn: { type: 'string', title: 'Directory base DN', minLength: 3, maxLength: 500 },
      directoryUserFilter: { type: 'string', title: 'Directory user filter', minLength: 5, maxLength: 500 },
      directoryGroupBaseDn: { type: 'string', title: 'Group base DN', maxLength: 500 },
      directoryGroupFilter: { type: 'string', title: 'Group filter', maxLength: 500 },
      directoryGroupRoleMap: { type: 'object', title: 'Group to App role map', additionalProperties: true },
      directoryRejectUnauthorized: { type: 'boolean', title: 'Verify directory TLS certificate' },
      accessTokenTtlSeconds: { type: 'integer', minimum: 300, maximum: 86400 },
      refreshTokenTtlSeconds: { type: 'integer', minimum: 3600, maximum: 2592000 },
      requiredStatus: { type: 'string', enum: ['active'] },
      issuer: { type: 'string', minLength: 1, maxLength: 160 }, audience: { type: 'string', minLength: 1, maxLength: 160 },
      algorithm: { type: 'string', enum: ['HS256'] }, secretEnvKey: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,100}$' },
    }, ['accessTokenTtlSeconds']),
    operations: {
      register: { inputSchema: object({ email: { type: 'string', minLength: 3, maxLength: 320 }, password: { type: 'string', minLength: 10, maxLength: 1024 }, displayName: { type: 'string', minLength: 1, maxLength: 255 } }, ['email', 'password', 'displayName']), outputSchema: resultSchema, execution: 'sync', idempotency: 'required' },
      login: { inputSchema: object({ email: { type: 'string', minLength: 1, maxLength: 320 }, username: { type: 'string', minLength: 1, maxLength: 100 }, password: { type: 'string', minLength: 1, maxLength: 1024 } }, ['password']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      listProviders: { inputSchema: object({}), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      startExternalLogin: { inputSchema: object({ provider: { type: 'string', enum: ['google', 'line', 'facebook', 'entra'] }, redirectUri: { type: 'string', minLength: 8, maxLength: 1000 } }, ['provider', 'redirectUri']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      completeExternalLogin: { inputSchema: object({ provider: { type: 'string', enum: ['google', 'line', 'facebook', 'entra'] }, code: { type: 'string', minLength: 1, maxLength: 4096 }, state: { type: 'string', minLength: 20, maxLength: 500 }, redirectUri: { type: 'string', minLength: 8, maxLength: 1000 } }, ['provider', 'code', 'state', 'redirectUri']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      directoryLogin: { inputSchema: object({ provider: { type: 'string', enum: ['ldap', 'ad-ds'] }, username: { type: 'string', minLength: 1, maxLength: 320 }, password: { type: 'string', minLength: 1, maxLength: 1024 } }, ['provider', 'username', 'password']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      logout: { inputSchema: object({}), outputSchema: resultSchema, execution: 'sync', idempotency: 'supported' },
      me: { inputSchema: object({}), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      refresh: { inputSchema: object({}), outputSchema: resultSchema, execution: 'sync', idempotency: 'supported' },
      revokeSessions: { inputSchema: object({}), outputSchema: resultSchema, execution: 'sync', idempotency: 'supported' },
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
      upload: { inputSchema: object({ files: { type: 'array' }, path: { type: 'string', maxLength: 300 } }, ['files']), outputSchema: resultSchema, execution: 'sync', idempotency: 'supported' },
      list: { inputSchema: object({ path: { type: 'string', maxLength: 300 } }), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      getMetadata: { inputSchema: object({ assetId: { type: 'string' } }, ['assetId']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      delete: { inputSchema: object({ assetId: { type: 'string' } }, ['assetId']), outputSchema: resultSchema, requiredPermission: 'storage.delete', execution: 'sync', idempotency: 'supported' },
    },
  },
  {
    serviceKey: 'notification.email', displayName: 'Email Notification', kind: 'notification', version: '1.0.0', lifecycle: 'active',
    defaultConfig: { transport: 'smtp', smtpPort: 587, smtpTlsMode: 'starttls', smtpAuthMode: 'basic', smtpRejectUnauthorized: true, smtpConnectionTimeoutMs: 10000, smtpSocketTimeoutMs: 60000, allowedTemplateIds: [], allowedRecipientMode: 'field', dailyQuota: 5000, maxAttachmentBytes: 26214400 },
    propertySchema: object({
      fromName: { type: 'string', minLength: 1, maxLength: 160 }, fromAddress: { type: 'string', minLength: 3, maxLength: 320 }, replyTo: { type: 'string', maxLength: 320 },
      transport: { type: 'string', enum: ['http', 'smtp'] }, smtpHost: { type: 'string', minLength: 1, maxLength: 255 },
      smtpPort: { type: 'integer', minimum: 1, maximum: 65535 }, smtpTlsMode: { type: 'string', enum: ['none', 'starttls', 'tls'] },
      smtpAuthMode: { type: 'string', enum: ['none', 'basic'] }, smtpRejectUnauthorized: { type: 'boolean' },
      smtpConnectionTimeoutMs: { type: 'integer', minimum: 100, maximum: 60000 }, smtpSocketTimeoutMs: { type: 'integer', minimum: 1000, maximum: 300000 },
      allowedTemplateIds: { type: 'array', items: { type: 'string', maxLength: 160 } }, allowedRecipientMode: { type: 'string', enum: ['user', 'field', 'fixed-domain'] },
      allowedRecipientDomain: { type: 'string', maxLength: 255 }, dailyQuota: { type: 'integer', minimum: 1, maximum: 100000 },
      maxAttachmentBytes: { type: 'integer', minimum: 1, maximum: 52428800 }, templates: { type: 'object' },
    }, ['fromName', 'fromAddress', 'allowedTemplateIds']),
    operations: {
      sendTemplate: { inputSchema: object({ templateId: { type: 'string' }, to: {}, cc: { type: 'array', items: { type: 'string' } }, variables: { type: 'object' }, attachments: { type: 'array', items: { type: 'string' } } }, ['templateId', 'to', 'variables']), outputSchema: resultSchema, execution: 'async', idempotency: 'required' },
      previewTemplate: { inputSchema: object({ templateId: { type: 'string' }, to: {}, cc: { type: 'array', items: { type: 'string' } }, variables: { type: 'object' } }, ['templateId', 'to', 'variables']), outputSchema: resultSchema, requiredPermission: 'mail.preview', execution: 'sync', idempotency: 'none' },
      getDeliveryStatus: { inputSchema: object({ jobId: { type: 'string' } }, ['jobId']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
    },
  },
  {
    serviceKey: 'google.workspace', displayName: 'Google Workspace', kind: 'google', version: '1.0.0', lifecycle: 'active',
    defaultConfig: { features: ['calendar', 'drive', 'forms'], maxPageSize: 100, requestTimeoutMs: 10000 },
    propertySchema: object({
      features: { type: 'array', items: { type: 'string', enum: ['maps', 'calendar', 'drive', 'forms', 'vision', 'ai'] } },
      maxPageSize: { type: 'integer', minimum: 1, maximum: 1000 },
      requestTimeoutMs: { type: 'integer', minimum: 1000, maximum: 60000 },
      browserMapsKey: { type: 'string', maxLength: 500 },
      geminiModel: { type: 'string', maxLength: 160 },
    }, ['features']),
    operations: {
      mapsEmbedUrl: { inputSchema: object({ lat: { type: 'number', minimum: -90, maximum: 90 }, lng: { type: 'number', minimum: -180, maximum: 180 }, zoom: { type: 'integer', minimum: 1, maximum: 21 } }, ['lat', 'lng']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      calendarList: { inputSchema: object({ calendarId: { type: 'string' }, timeMin: { type: 'string' }, timeMax: { type: 'string' }, pageToken: { type: 'string' } }, ['calendarId']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      calendarCreate: { inputSchema: object({ calendarId: { type: 'string' }, title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, description: { type: 'string' } }, ['calendarId', 'title', 'start', 'end']), outputSchema: resultSchema, execution: 'sync', idempotency: 'required' },
      driveList: { inputSchema: object({ folderId: { type: 'string' }, query: { type: 'string' }, pageToken: { type: 'string' } }), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      formsGet: { inputSchema: object({ formId: { type: 'string' } }, ['formId']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      formsResponses: { inputSchema: object({ formId: { type: 'string' }, pageToken: { type: 'string' } }, ['formId']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      visionOcr: { inputSchema: object({ file: { type: 'string' } }, ['file']), outputSchema: resultSchema, execution: 'async', idempotency: 'supported' },
      aiGenerate: { inputSchema: object({ prompt: { type: 'string', minLength: 1, maxLength: 20000 }, data: {}, outputSchema: { type: 'object', additionalProperties: true } }, ['prompt']), outputSchema: resultSchema, execution: 'async', idempotency: 'supported' },
    },
  },
  {
    serviceKey: 'media.local', displayName: 'Local Media', kind: 'media', version: '1.0.0', lifecycle: 'active',
    defaultConfig: { rootNamespace: 'shared', outputPath: 'generated', maxInputBytes: 20971520, maxPixels: 24000000 },
    propertySchema: object({
      rootNamespace: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,199}$' },
      outputPath: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,199}$' },
      maxInputBytes: { type: 'integer', minimum: 1, maximum: 104857600 },
      maxPixels: { type: 'integer', minimum: 1024, maximum: 100000000 },
    }, ['rootNamespace', 'outputPath']),
    operations: {
      qrCode: { inputSchema: object({ value: { type: 'string', minLength: 1, maxLength: 4096 }, size: { type: 'integer', minimum: 64, maximum: 2048 }, format: { type: 'string', enum: ['svg', 'png'] } }, ['value']), outputSchema: resultSchema, execution: 'sync', idempotency: 'none' },
      imageResize: { inputSchema: object({ file: { type: 'string' }, width: { type: 'integer', minimum: 1, maximum: 12000 }, height: { type: 'integer', minimum: 1, maximum: 12000 }, fit: { type: 'string', enum: ['cover', 'contain', 'inside', 'outside'] }, format: { type: 'string', enum: ['jpeg', 'png', 'webp'] }, quality: { type: 'integer', minimum: 1, maximum: 100 } }, ['file']), outputSchema: resultSchema, execution: 'sync', idempotency: 'supported' },
    },
  },
];

export const SERVICE_CATALOG = Object.freeze(definitions);
export const getServiceDefinition = (serviceKey: string, version?: string) => SERVICE_CATALOG.find((item) => item.serviceKey === serviceKey && (!version || item.version === version));
export const listServiceDefinitions = () => [...SERVICE_CATALOG];
