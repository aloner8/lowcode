import 'server-only';
import { getCoreDb } from '@/lib/db/coreDb';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { cleanRelative, resolveTenantStorage, resolveWritePath } from '@/lib/storage/tenantStorage';
import { attachmentSnapshot, renderMailHtml, renderMailSubject } from './mailContent';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 100;
const MAX_ATTACHMENTS = 10;
const DEFAULT_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const recipients = (value: unknown, field: string): string[] => {
  const values = (Array.isArray(value) ? value : [value])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(values)];
  if (!unique.length && field === 'to') throw new ServiceError('SERVICE_INPUT_INVALID', 'At least one recipient is required', 400, false, { [field]: 'required' });
  if (unique.length > MAX_RECIPIENTS || unique.some((email) => !EMAIL.test(email))) {
    throw new ServiceError('SERVICE_INPUT_INVALID', `${field} contains an invalid email address`, 400, false, { [field]: 'invalid' });
  }
  return unique;
};

const mimeFor = (filename: string) => ({
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.txt': 'text/plain', '.csv': 'text/csv', '.zip': 'application/zip',
}[path.extname(filename).toLowerCase()] || 'application/octet-stream');

const snapshotAttachments = async (ctx: ServiceExecutionContext, value: unknown, maxBytes: number) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS || value.some((item) => typeof item !== 'string')) {
    throw new ServiceError('SERVICE_INPUT_INVALID', `attachments must contain at most ${MAX_ATTACHMENTS} FileRef IDs`, 400);
  }
  const storage = await resolveTenantStorage(ctx.scope.appId ? { appId: ctx.scope.appId } : { platformId: ctx.scope.platformId });
  const snapshots = [];
  let total = 0;
  for (const item of [...new Set(value as string[])]) {
    const assetId = cleanRelative(item);
    const target = resolveWritePath(storage, assetId);
    const info = await stat(target).catch(() => null);
    if (!info?.isFile()) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', `Attachment '${assetId}' was not found`, 404);
    total += info.size;
    if (total > maxBytes) throw new ServiceError('SERVICE_INPUT_INVALID', 'Attachment size limit exceeded', 413);
    snapshots.push(attachmentSnapshot({ filename: path.basename(assetId), contentType: mimeFor(assetId), bytes: await readFile(target) }));
  }
  return snapshots;
};

export async function executeEmailNotificationService(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, operation: string, input: Record<string, any>) {
  if (operation === 'getDeliveryStatus') {
    const result = await getCoreDb().query<{ status: string; attempts: number; accepted_at: Date | null; delivered_at: Date | null; last_error: string | null }>(
      'SELECT status,attempts,accepted_at,delivered_at,last_error FROM public.service_outbox_jobs WHERE id=$1 AND platform_id=$2 AND app_id IS NOT DISTINCT FROM $3', [String(input.jobId || ''), ctx.scope.platformId, ctx.scope.appId || null],
    );
    if (!result.rowCount) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'Delivery job not found', 404);
    const row = result.rows[0]; return { jobId: input.jobId, status: row.status === 'delivered' ? 'accepted' : row.status, attempts: row.attempts, acceptedAt: (row.accepted_at || row.delivered_at)?.toISOString() || null, error: row.last_error };
  }
  if (operation !== 'sendTemplate' && operation !== 'previewTemplate') throw new ServiceError('OPERATION_NOT_ALLOWED', `Unsupported email operation '${operation}'`, 405);
  const templateId = String(input.templateId || '');
  const to = recipients(input.to, 'to');
  const cc = recipients(input.cc ?? [], 'cc');
  const allowedTemplates = (Array.isArray(binding.config.allowedTemplateIds) ? binding.config.allowedTemplateIds : []).map(String);
  const template = binding.config.templates?.[templateId];
  if (!allowedTemplates.includes(templateId) || !template || typeof template.subject !== 'string' || typeof template.html !== 'string') throw new ServiceError('PERMISSION_DENIED', `Email template '${templateId}' is not allowed`, 403);
  if (binding.config.allowedRecipientMode === 'fixed-domain') {
    const suffix = `@${String(binding.config.allowedRecipientDomain || '').toLowerCase()}`;
    if ([...to, ...cc].some((email) => !email.endsWith(suffix))) throw new ServiceError('PERMISSION_DENIED', 'Recipient domain is not allowed', 403);
  }
  const variables = input.variables && typeof input.variables === 'object' && !Array.isArray(input.variables) ? input.variables : {};
  const rendered = {
    subject: renderMailSubject(template.subject, variables),
    html: renderMailHtml(template.html, variables),
  };
  if (operation === 'previewTemplate') return { templateId, to, cc, ...rendered };
  const quota = Number(binding.config.dailyQuota || 5000);
  const used = await getCoreDb().query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.service_outbox_jobs WHERE platform_id=$1 AND app_id IS NOT DISTINCT FROM $2 AND binding_key=$3 AND created_at>=date_trunc(\'day\',now())', [ctx.scope.platformId, ctx.scope.appId || null, binding.id]);
  if (Number(used.rows[0].count) >= quota) throw new ServiceError('RATE_LIMITED', 'Daily email quota has been reached', 429, true);
  const attachments = await snapshotAttachments(ctx, input.attachments, Number(binding.config.maxAttachmentBytes || DEFAULT_ATTACHMENT_BYTES));
  const payload = { templateId, to, cc, ...rendered, attachments, fromName: binding.config.fromName, fromAddress: binding.config.fromAddress, replyTo: binding.config.replyTo };
  const transport = binding.config.transport === 'smtp' ? 'smtp' : 'http';
  const configSnapshot = transport === 'smtp' ? {
    transport,
    host: binding.config.smtpHost,
    port: binding.config.smtpPort,
    tlsMode: binding.config.smtpTlsMode || 'starttls',
    rejectUnauthorized: binding.config.smtpRejectUnauthorized !== false,
    connectionTimeoutMs: binding.config.smtpConnectionTimeoutMs || 10_000,
    socketTimeoutMs: binding.config.smtpSocketTimeoutMs || 60_000,
    authMode: binding.config.smtpAuthMode || 'basic',
  } : { transport, provider: binding.provider || 'http-email' };
  const result = await getCoreDb().query<{ id: string }>(`INSERT INTO public.service_outbox_jobs(platform_id,app_id,binding_key,operation,payload,config_snapshot,secret_refs,status) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,'queued') RETURNING id`, [ctx.scope.platformId, ctx.scope.appId || null, binding.id, operation, JSON.stringify(payload), JSON.stringify(configSnapshot), JSON.stringify(binding.secretRefs || {})]);
  return { jobId: result.rows[0].id, status: 'queued' };
}
