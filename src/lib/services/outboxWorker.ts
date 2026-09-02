import 'server-only';
import { getCoreDb } from '@/lib/db/coreDb';
import { resolveSecretReference } from './secrets';

interface OutboxJob { id: string; payload: Record<string, any>; secret_refs: Record<string, string>; attempts: number; max_attempts: number }

const safeText = (value: unknown) => {
  const text = value === undefined || value === null ? '' : String(value).replace(/[\u0000-\u001f\u007f]/g, '');
  if (/^\s*(?:javascript|data|vbscript):/i.test(text)) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
const render = (template: string, variables: Record<string, unknown>) => template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
  const value = key.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined, variables);
  return safeText(value);
});
const renderSubject = (template: string, variables: Record<string, unknown>) => template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
  const value = key.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined, variables);
  return String(value ?? '').replace(/[\r\n\u0000-\u001f\u007f]/g, '').slice(0, 500);
});

export async function processEmailOutbox(limit = 20): Promise<{ processed: number; delivered: number; failed: number }> {
  const claimed = await getCoreDb().query<OutboxJob>(
    `UPDATE public.service_outbox_jobs SET status='processing',locked_at=now(),attempts=attempts+1,updated_at=now()
     WHERE id IN (SELECT id FROM public.service_outbox_jobs WHERE status IN ('pending','failed') AND available_at<=now() AND attempts<max_attempts ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1)
     RETURNING id,payload,secret_refs,attempts,max_attempts`, [Math.min(Math.max(limit, 1), 100)],
  );
  let delivered = 0; let failed = 0;
  for (const job of claimed.rows) {
    try {
      const endpoint = resolveSecretReference(job.secret_refs.providerEndpoint);
      const token = resolveSecretReference(job.secret_refs.providerToken);
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ from: { name: job.payload.fromName, email: job.payload.fromAddress }, to: job.payload.to, replyTo: job.payload.replyTo, subject: renderSubject(job.payload.template.subject, job.payload.variables), html: render(job.payload.template.html, job.payload.variables) }) });
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
      const result = await response.json().catch(() => ({})) as { id?: string };
      await getCoreDb().query("UPDATE public.service_outbox_jobs SET status='delivered',delivered_at=now(),provider_message_id=$2,last_error=NULL,updated_at=now() WHERE id=$1", [job.id, result.id || null]); delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email provider failed'; const terminal = job.attempts >= job.max_attempts;
      await getCoreDb().query("UPDATE public.service_outbox_jobs SET status='failed',available_at=CASE WHEN $3 THEN available_at ELSE now()+make_interval(secs=>LEAST(3600,30*power(2,attempts))) END,last_error=$2,updated_at=now() WHERE id=$1", [job.id, message.slice(0, 1000), terminal]); failed += 1;
    }
  }
  return { processed: claimed.rowCount || 0, delivered, failed };
}
