import 'server-only';
import { createHash } from 'node:crypto';
import { getCoreDb } from '@/lib/db/coreDb';
import { bindingFor, serviceKeyOf } from './bindings';
import { getServiceDefinition } from './catalog';
import { validateSchema } from './schemaValidator';
import { ServiceError } from './errors';
import { executeAuthSessionService } from './authSessionService';
import { executeCollectionService } from './collectionService';
import { executeStorageObjectService } from './storageObjectService';
import { executeEmailNotificationService } from './emailNotificationService';
import { executeGoogleWorkspaceService } from './googleWorkspaceService';
import { executeLocalMediaService } from './localMediaService';
import type { ServiceExecutionContext } from './runtimeContext';

export interface DispatchOptions { idempotencyKey?: string | null }
export interface DispatchResult { data: unknown; token?: string; refreshToken?: string; maxAge?: number; refreshMaxAge?: number; clearCookie?: boolean; replayed?: boolean }

const requestHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function audit(ctx: ServiceExecutionContext, bindingId: string, serviceKey: string, version: string, operation: string, outcome: string, durationMs: number, errorCode?: string) {
  await getCoreDb().query(`INSERT INTO public.service_invocation_audit(request_id,trace_id,platform_id,app_id,actor_type,actor_id,binding_key,service_key,service_version,operation,outcome,error_code,duration_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [ctx.requestId, ctx.traceId, ctx.scope.platformId, ctx.scope.appId || null, ctx.actor.type, ctx.actor.userId || null, bindingId, serviceKey, version, operation, outcome, errorCode || null, durationMs]).catch((error) => console.error('[service-audit] unable to write audit', error));
}

export async function dispatchService(ctx: ServiceExecutionContext, bindingId: string, operation: string, input: Record<string, any>, options: DispatchOptions = {}): Promise<DispatchResult> {
  const started = performance.now(); const binding = bindingFor(ctx.snapshot.services, bindingId);
  if (!binding) throw new ServiceError('SERVICE_NOT_FOUND', `Service binding '${bindingId}' was not found`, 404);
  const serviceKey = serviceKeyOf(binding); const version = binding.serviceRef?.version || '1.0.0';
  const hash = requestHash(input); const appScope = ctx.scope.appId || 'platform'; let idempotencyClaimed = false;
  try {
    if (!binding.enabled) throw new ServiceError('BINDING_DISABLED', `Service binding '${bindingId}' is disabled`, 409);
    const definition = getServiceDefinition(serviceKey, version);
    if (!definition) throw new ServiceError('SERVICE_VERSION_UNAVAILABLE', `${serviceKey}@${version} is unavailable`, 409);
    const operationDefinition = definition.operations[operation];
    if (!operationDefinition || !(binding.policy?.allowedOperations ?? Object.keys(definition.operations)).includes(operation)) throw new ServiceError('OPERATION_NOT_ALLOWED', `Operation '${operation}' is not allowed`, 403);
    const validation = validateSchema(operationDefinition.inputSchema, input);
    if (!validation.valid) throw new ServiceError('SERVICE_INPUT_INVALID', 'Service input is invalid', 400, false, Object.fromEntries(validation.errors.map((message, index) => [String(index), message])));
    const permissions = new Set(ctx.actor.permissions);
    if (ctx.actor.type === 'anonymous' && serviceKey !== 'auth.session' && binding.config.public !== true) throw new ServiceError('AUTH_REQUIRED', 'Authentication is required', 401);
    const required = binding.policy?.requiredPermissions?.[operation] ?? (operationDefinition.requiredPermission ? [operationDefinition.requiredPermission] : []);
    const platformAdmin = ctx.actor.type === 'platform-user' && ctx.actor.roles.some((role) => role === 'ADMIN' || role === 'GOD');
    if (!platformAdmin && required.length && !required.every((permission) => permissions.has(permission))) throw new ServiceError(ctx.actor.type === 'anonymous' ? 'AUTH_REQUIRED' : 'PERMISSION_DENIED', 'The caller is not allowed to use this operation', ctx.actor.type === 'anonymous' ? 401 : 403);
    if (operationDefinition.idempotency === 'required' && !options.idempotencyKey) throw new ServiceError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required', 400);
    if (options.idempotencyKey) {
      const existing = await getCoreDb().query<{ request_hash: string; response_body: DispatchResult | null }>('SELECT request_hash,response_body FROM public.service_idempotency_keys WHERE platform_id=$1 AND app_scope=$2 AND binding_key=$3 AND operation=$4 AND idempotency_key=$5 AND expires_at>now()', [ctx.scope.platformId, appScope, bindingId, operation, options.idempotencyKey]);
      if (existing.rowCount) { if (existing.rows[0].request_hash !== hash) throw new ServiceError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with different input', 409); if (!existing.rows[0].response_body) throw new ServiceError('IDEMPOTENCY_CONFLICT', 'An invocation with this key is still running', 409, true); return { ...existing.rows[0].response_body, replayed: true }; }
      const claim = await getCoreDb().query(`INSERT INTO public.service_idempotency_keys(platform_id,app_scope,binding_key,operation,idempotency_key,request_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '24 hours') ON CONFLICT DO NOTHING RETURNING idempotency_key`, [ctx.scope.platformId, appScope, bindingId, operation, options.idempotencyKey, hash]);
      if (!claim.rowCount) throw new ServiceError('IDEMPOTENCY_CONFLICT', 'An invocation with this key is already running', 409, true);
      idempotencyClaimed = true;
    }
    let result: DispatchResult;
    if (serviceKey === 'auth.session') result = await executeAuthSessionService(ctx, binding, operation, input);
    else if (serviceKey === 'data.collection') result = { data: await executeCollectionService(ctx, binding, operation, input) };
    else if (serviceKey === 'storage.object') result = { data: await executeStorageObjectService(ctx, binding, operation, input) };
    else if (serviceKey === 'notification.email') result = { data: await executeEmailNotificationService(ctx, binding, operation, input) };
    else if (serviceKey === 'google.workspace') result = { data: await executeGoogleWorkspaceService(ctx, binding, operation, input) };
    else if (serviceKey === 'media.local') result = { data: await executeLocalMediaService(ctx, binding, operation, input) };
    else throw new ServiceError('SERVICE_NOT_FOUND', `No handler is registered for '${serviceKey}'`, 501);
    if (options.idempotencyKey && idempotencyClaimed) await getCoreDb().query(`UPDATE public.service_idempotency_keys SET response_status=200,response_body=$6::jsonb WHERE platform_id=$1 AND app_scope=$2 AND binding_key=$3 AND operation=$4 AND idempotency_key=$5`, [ctx.scope.platformId, appScope, bindingId, operation, options.idempotencyKey, JSON.stringify(result)]);
    await audit(ctx, bindingId, serviceKey, version, operation, 'success', Math.round(performance.now() - started)); return result;
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : new ServiceError('INTERNAL_ERROR', 'Service execution failed', 500);
    if (idempotencyClaimed && options.idempotencyKey) await getCoreDb().query('DELETE FROM public.service_idempotency_keys WHERE platform_id=$1 AND app_scope=$2 AND binding_key=$3 AND operation=$4 AND idempotency_key=$5 AND response_body IS NULL', [ctx.scope.platformId, appScope, bindingId, operation, options.idempotencyKey]).catch(() => undefined);
    await audit(ctx, bindingId, serviceKey, version, operation, 'error', Math.round(performance.now() - started), serviceError.code); throw serviceError;
  }
}
