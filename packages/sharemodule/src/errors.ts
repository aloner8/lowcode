export type ServiceErrorCode =
  | 'SERVICE_NOT_FOUND' | 'BINDING_DISABLED' | 'OPERATION_NOT_ALLOWED'
  | 'SERVICE_INPUT_INVALID' | 'AUTH_REQUIRED' | 'PERMISSION_DENIED'
  | 'RATE_LIMITED' | 'TENANT_RESOURCE_UNAVAILABLE'
  | 'PROVIDER_TEMPORARY_FAILURE' | 'SERVICE_VERSION_UNAVAILABLE'
  | 'MODULE_NOT_CONFIGURED' | 'MODULE_DISABLED' | 'MODULE_CONFIG_UNSUPPORTED'
  | 'PROVIDER_AUTH_FAILED' | 'PROVIDER_NOT_ALLOWED' | 'REGISTRATION_DISABLED'
  | 'IDENTITY_LINK_REQUIRED' | 'ACCOUNT_EXISTS'
  | 'IDEMPOTENCY_KEY_REQUIRED' | 'IDEMPOTENCY_CONFLICT' | 'INTERNAL_ERROR';

export class ServiceError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
    readonly status = 400,
    readonly retryable = false,
    readonly fieldErrors?: Record<string, string>,
  ) { super(message); this.name = 'ServiceError'; }
}
