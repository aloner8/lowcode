import 'server-only';
import { resolveModuleOperation, selectModuleBinding } from '@matchanu/sharemodule/server';
import { dispatchService, type DispatchOptions } from './dispatcher';
import { normalizeServiceBinding } from './bindings';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';

/** Used by HTTP adapters and trusted server actions alike. */
export async function dispatchModule(ctx: ServiceExecutionContext, module: string, operation: string, input: Record<string, unknown>, options?: DispatchOptions) {
  const target = resolveModuleOperation(module, operation);
  if (!target) throw new ServiceError('OPERATION_NOT_ALLOWED', 'Unknown module operation', 404);
  const bindings = (Array.isArray(ctx.snapshot.services) ? ctx.snapshot.services as StudioServiceDefinition[] : []).map(normalizeServiceBinding);
  const defaultId = ctx.snapshot.moduleDefaults?.[module];
  const binding = selectModuleBinding(bindings, target.serviceKey, typeof defaultId === 'string' ? defaultId : undefined);
  if (ctx.scope.authRealm === 'platform' && module === 'auth') throw new ServiceError('OPERATION_NOT_ALLOWED', 'Use the platform account sign-in for the administrator realm', 403);
  const result = await dispatchService(ctx, binding.id, target.operation, input, options);
  return { result, serviceKey: target.serviceKey, version: binding.serviceRef!.version };
}
