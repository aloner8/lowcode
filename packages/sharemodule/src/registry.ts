export * from './catalog.js';

/** Operations belong to the library, never to a page's JSON. */
export const MODULE_CATALOG = {
  auth: { serviceKey: 'auth.session', operations: { register: 'register', login: 'login', directoryLogin: 'directoryLogin', providers: 'listProviders', startExternalLogin: 'startExternalLogin', completeExternalLogin: 'completeExternalLogin', logout: 'logout', me: 'me', refresh: 'refresh', revokeSessions: 'revokeSessions', changePassword: 'changePassword' } },
  files: { serviceKey: 'storage.object', operations: { list: 'list', upload: 'upload', metadata: 'getMetadata', delete: 'delete' } },
  mail: { serviceKey: 'notification.email', operations: { send: 'sendTemplate', preview: 'previewTemplate', status: 'getDeliveryStatus' } },
} as const;

export type ModuleName = keyof typeof MODULE_CATALOG;

export function resolveModuleOperation(module: string, operation: string): { serviceKey: string; operation: string } | null {
  if (!Object.hasOwn(MODULE_CATALOG, module)) return null;
  const definition = MODULE_CATALOG[module as ModuleName];
  if (!Object.hasOwn(definition.operations, operation)) return null;
  return { serviceKey: definition.serviceKey, operation: (definition.operations as Record<string, string>)[operation] };
}
