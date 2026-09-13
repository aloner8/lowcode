import 'server-only';
import { resolveModuleOperation, selectModuleBinding } from '@matchanu/sharemodule/server';
import { dispatchService, type DispatchOptions } from './dispatcher';
import { normalizeServiceBinding } from './bindings';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';
import { validateModuleSetting } from '@/lib/modules/moduleSettings';

interface RuntimeModuleSetting {
  moduleKey: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

const appModuleSetting = (ctx: ServiceExecutionContext, moduleKey: string): RuntimeModuleSetting | null => {
  const modules = Array.isArray(ctx.snapshot.templateModules) ? ctx.snapshot.templateModules : [];
  const value = modules.find((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return (entry as Record<string, unknown>).moduleKey === moduleKey;
  });
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const setting = value as Record<string, unknown>;
  return {
    moduleKey,
    enabled: setting.enabled === true,
    config: setting.config && typeof setting.config === 'object' && !Array.isArray(setting.config)
      ? setting.config as Record<string, unknown>
      : {},
  };
};

/** Used by HTTP adapters and trusted server actions alike. */
export async function dispatchModule(ctx: ServiceExecutionContext, module: string, operation: string, input: Record<string, unknown>, options?: DispatchOptions) {
  const target = resolveModuleOperation(module, operation);
  if (!target) throw new ServiceError('OPERATION_NOT_ALLOWED', 'Unknown module operation', 404);
  let dispatchedInput = input;
  if (ctx.scope.appId) {
    const setting = appModuleSetting(ctx, module);
    if (!setting) throw new ServiceError('MODULE_NOT_CONFIGURED', `Module '${module}' is not configured in this App revision`, 409);
    if (!setting.enabled) throw new ServiceError('MODULE_DISABLED', `Module '${module}' is disabled in this App revision`, 409);
    const validation = validateModuleSetting(setting);
    if (!validation.valid) {
      throw new ServiceError(
        'MODULE_CONFIG_UNSUPPORTED',
        validation.issues.map((issue) => issue.message).join('; '),
        409,
      );
    }
    if (module === 'files' && (operation === 'list' || operation === 'upload') && !('path' in input)) {
      dispatchedInput = { ...input, path: setting.config.workingPath };
    }
  }
  const bindings = (Array.isArray(ctx.snapshot.services) ? ctx.snapshot.services as StudioServiceDefinition[] : []).map(normalizeServiceBinding);
  const defaultId = ctx.snapshot.moduleDefaults?.[module];
  const binding = selectModuleBinding(bindings, target.serviceKey, typeof defaultId === 'string' ? defaultId : undefined);
  if (ctx.scope.authRealm === 'platform' && module === 'auth') throw new ServiceError('OPERATION_NOT_ALLOWED', 'Use the platform account sign-in for the administrator realm', 403);
  const result = await dispatchService(ctx, binding.id, target.operation, dispatchedInput, options);
  return { result, serviceKey: target.serviceKey, version: binding.serviceRef!.version };
}
