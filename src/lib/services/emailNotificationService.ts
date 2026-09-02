import 'server-only';
import { getCoreDb } from '@/lib/db/coreDb';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function executeEmailNotificationService(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, operation: string, input: Record<string, any>) {
  if (operation === 'getDeliveryStatus') {
    const result = await getCoreDb().query<{ status: string; attempts: number; delivered_at: Date | null; last_error: string | null }>(
      'SELECT status,attempts,delivered_at,last_error FROM public.service_outbox_jobs WHERE id=$1 AND platform_id=$2 AND app_id IS NOT DISTINCT FROM $3', [String(input.jobId || ''), ctx.scope.platformId, ctx.scope.appId || null],
    );
    if (!result.rowCount) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'Delivery job not found', 404);
    const row = result.rows[0]; return { jobId: input.jobId, status: row.status, attempts: row.attempts, deliveredAt: row.delivered_at?.toISOString() || null, error: row.last_error };
  }
  if (operation !== 'sendTemplate') throw new ServiceError('OPERATION_NOT_ALLOWED', `Unsupported email operation '${operation}'`, 405);
  const templateId = String(input.templateId || ''); const to = String(input.to || '').trim().toLowerCase();
  if (!EMAIL.test(to)) throw new ServiceError('SERVICE_INPUT_INVALID', 'Recipient email is invalid', 400, false, { to: 'invalid' });
  const allowedTemplates = (Array.isArray(binding.config.allowedTemplateIds) ? binding.config.allowedTemplateIds : []).map(String);
  const template = binding.config.templates?.[templateId];
  if (!allowedTemplates.includes(templateId) || !template || typeof template.subject !== 'string' || typeof template.html !== 'string') throw new ServiceError('PERMISSION_DENIED', `Email template '${templateId}' is not allowed`, 403);
  if (binding.config.allowedRecipientMode === 'fixed-domain' && !to.endsWith(`@${String(binding.config.allowedRecipientDomain || '').toLowerCase()}`)) throw new ServiceError('PERMISSION_DENIED', 'Recipient domain is not allowed', 403);
  const quota = Number(binding.config.dailyQuota || 5000);
  const used = await getCoreDb().query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.service_outbox_jobs WHERE platform_id=$1 AND app_id IS NOT DISTINCT FROM $2 AND binding_key=$3 AND created_at>=date_trunc(\'day\',now())', [ctx.scope.platformId, ctx.scope.appId || null, binding.id]);
  if (Number(used.rows[0].count) >= quota) throw new ServiceError('RATE_LIMITED', 'Daily email quota has been reached', 429, true);
  const payload = { templateId, to, variables: input.variables || {}, fromName: binding.config.fromName, fromAddress: binding.config.fromAddress, replyTo: binding.config.replyTo, template };
  const result = await getCoreDb().query<{ id: string }>(`INSERT INTO public.service_outbox_jobs(platform_id,app_id,binding_key,operation,payload,config_snapshot,secret_refs) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb) RETURNING id`, [ctx.scope.platformId, ctx.scope.appId || null, binding.id, operation, JSON.stringify(payload), JSON.stringify({ provider: binding.provider || 'http-email' }), JSON.stringify(binding.secretRefs || {})]);
  return { jobId: result.rows[0].id, status: 'pending' };
}
