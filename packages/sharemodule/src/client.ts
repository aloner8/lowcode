export { createFilePicker } from './fileSelection.js';
export type { FilePickOptions, FilePicker } from './fileSelection.js';

export class ModuleError extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly retryable = false, readonly requestId?: string, readonly fields?: Record<string, string>) {
    super(message); this.name = 'ModuleError';
  }
}

export interface RequestOptions { signal?: AbortSignal; idempotencyKey?: string }
export interface ModuleClientOptions {
  /** Supplied once by the application shell; components do not configure URLs. */
  baseUrl?: string;
  platformId?: string;
  fetch?: typeof globalThis.fetch;
}
export interface MailInput {
  to: string | string[];
  cc?: string[];
  template: string;
  data?: Record<string, unknown>;
  /** Immutable FileRef IDs returned by the Files module. */
  attachments?: string[];
}
export interface ModuleUser { id?: string; userId?: string; email?: string; roles: string[]; permissions: string[] }
export type AuthProvider = 'local' | 'google' | 'line' | 'facebook' | 'ldap' | 'ad-ds' | 'entra';

export function createModules(options: ModuleClientOptions = {}) {
  const base = (options.baseUrl ?? '/api/share/v1').replace(/\/$/, '');
  const fetcher = options.fetch ?? globalThis.fetch;
  async function call<T>(module: string, operation: string, input: unknown, request: RequestOptions = {}, mutation = false): Promise<T> {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (mutation) headers.set('Idempotency-Key', request.idempotencyKey ?? globalThis.crypto.randomUUID());
    const url = `${base}/${module}/${operation}${options.platformId ? `?platformId=${encodeURIComponent(options.platformId)}` : ''}`;
    const response = await fetcher(url, {
      method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(input), signal: request.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.error) {
      throw new ModuleError(result?.error?.code ?? 'REQUEST_FAILED', result?.error?.message ?? 'The request could not be completed', response.status, result?.error?.retryable ?? false, result?.meta?.requestId, result?.error?.fields ?? result?.error?.fieldErrors);
    }
    if (!result || !Object.hasOwn(result, 'data')) throw new ModuleError('INVALID_RESPONSE', 'The server returned an invalid module response', response.status);
    return result.data as T;
  }
  return {
    auth: {
      register: (input: { email: string; password: string; displayName: string }, request?: RequestOptions) => call<{ user: ModuleUser }>('auth', 'register', input, request, true),
      login: (input: { email?: string; username?: string; password: string }, request?: RequestOptions) => call<{ user: ModuleUser }>('auth', 'login', input, request),
      directoryLogin: (input: { provider: 'ldap' | 'ad-ds'; username: string; password: string }, request?: RequestOptions) => call<{ user: ModuleUser }>('auth', 'directoryLogin', input, request),
      providers: (request?: RequestOptions) => call<{ providers: AuthProvider[] }>('auth', 'providers', {}, request),
      externalLoginUrl: (provider: Exclude<AuthProvider, 'local' | 'ldap' | 'ad-ds'>, runtimeSlug: string) => `/api/runtime/${encodeURIComponent(runtimeSlug)}/auth/providers/${provider}/start`,
      logout: (request?: RequestOptions) => call<{ loggedOut: boolean }>('auth', 'logout', {}, request),
      me: async (request?: RequestOptions) => (await call<{ user: ModuleUser }>('auth', 'me', {}, request)).user,
      can: async (permission: string, request?: RequestOptions) => (await call<{ user: ModuleUser }>('auth', 'me', {}, request)).user.permissions.includes(permission),
      refresh: (request?: RequestOptions) => call<{ user: ModuleUser }>('auth', 'refresh', {}, request),
      revokeSessions: (request?: RequestOptions) => call<{ revoked: boolean }>('auth', 'revokeSessions', {}, request),
      changePassword: (input: { currentPassword: string; newPassword: string }, request?: RequestOptions) => call<{ changed: boolean }>('auth', 'changePassword', input, request),
    },
    mail: {
      send: (input: MailInput, request?: RequestOptions) => call<{ jobId: string; status: string }>('mail', 'send', { to: input.to, cc: input.cc ?? [], templateId: input.template, variables: input.data ?? {}, attachments: input.attachments ?? [] }, request, true),
      preview: (input: Omit<MailInput, 'attachments'>, request?: RequestOptions) => call<{ subject: string; html: string; to: string[]; cc: string[] }>('mail', 'preview', { to: input.to, cc: input.cc ?? [], templateId: input.template, variables: input.data ?? {} }, request),
      status: (jobId: string, request?: RequestOptions) => call<{ jobId: string; status: string; attempts: number }>('mail', 'status', { jobId }, request),
    },
  };
}
export type Modules = ReturnType<typeof createModules>;
