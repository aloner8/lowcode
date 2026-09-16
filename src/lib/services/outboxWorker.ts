import 'server-only';
import { getCoreDb } from '@/lib/db/coreDb';
import { resolveSecretReference } from './secrets';
import { randomUUID } from 'node:crypto';
import { deliverSmtpMail, type SmtpTransportConfig } from './smtpTransport';
import type { QueuedMailAttachment } from './mailContent';
import { renderMailHtml, renderMailSubject } from './mailContent';

interface OutboxJob { id: string; payload: Record<string, any>; config_snapshot: Record<string, any>; secret_refs: Record<string, string>; attempts: number; max_attempts: number }

const deliver = async (job: OutboxJob) => {
  // Jobs created before P8 rendered at delivery time. Keep them drainable while
  // every new job carries an immutable subject/html snapshot.
  const variables = job.payload.variables && typeof job.payload.variables === 'object' ? job.payload.variables : {};
  const subject = typeof job.payload.subject === 'string'
    ? job.payload.subject
    : renderMailSubject(String(job.payload.template?.subject || ''), variables);
  const html = typeof job.payload.html === 'string'
    ? job.payload.html
    : renderMailHtml(String(job.payload.template?.html || ''), variables);
  if (job.config_snapshot.transport === 'smtp') {
    const auth = job.config_snapshot.authMode === 'none' ? {} : {
      username: resolveSecretReference(job.secret_refs.smtpUsername),
      password: resolveSecretReference(job.secret_refs.smtpPassword),
    };
    return deliverSmtpMail({
      config: job.config_snapshot as SmtpTransportConfig,
      message: {
        fromName: job.payload.fromName,
        fromAddress: String(job.payload.fromAddress),
        replyTo: job.payload.replyTo,
        to: job.payload.to,
        cc: job.payload.cc || [],
        subject,
        html,
        attachments: (job.payload.attachments || []) as QueuedMailAttachment[],
      },
      ...auth,
    });
  }
  const endpoint = resolveSecretReference(job.secret_refs.providerEndpoint);
  const token = resolveSecretReference(job.secret_refs.providerToken);
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ from: { name: job.payload.fromName, email: job.payload.fromAddress }, to: job.payload.to, cc: job.payload.cc, replyTo: job.payload.replyTo, subject, html, attachments: job.payload.attachments }) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const result = await response.json().catch(() => ({})) as { id?: string };
  return { messageId: result.id || null, accepted: job.payload.to, rejected: [] };
};

export async function processEmailOutbox(limit = 20): Promise<{ processed: number; delivered: number; failed: number }> {
  const workerId = `mail-${process.pid}-${randomUUID()}`;
  const claimed = await getCoreDb().query<OutboxJob>(
    `UPDATE public.service_outbox_jobs SET status='processing',locked_at=now(),locked_by=$2,
       lease_expires_at=now()+interval '2 minutes',last_attempt_at=now(),attempts=attempts+1,updated_at=now()
     WHERE id IN (SELECT id FROM public.service_outbox_jobs
       WHERE ((status IN ('queued','pending','failed') AND available_at<=now())
          OR (status='processing' AND lease_expires_at<=now()))
         AND attempts<max_attempts ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1)
     RETURNING id,payload,config_snapshot,secret_refs,attempts,max_attempts`, [Math.min(Math.max(limit, 1), 100), workerId],
  );
  let delivered = 0; let failed = 0;
  for (const job of claimed.rows) {
    try {
      const result = await deliver(job);
      await getCoreDb().query("UPDATE public.service_outbox_jobs SET status='accepted',accepted_at=now(),delivered_at=now(),provider_message_id=$2,last_error=NULL,locked_by=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND locked_by=$3", [job.id, result.messageId, workerId]); delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email provider failed'; const terminal = job.attempts >= job.max_attempts;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const ambiguous = job.config_snapshot.transport === 'smtp' && ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET'].includes(code);
      await getCoreDb().query("UPDATE public.service_outbox_jobs SET status=CASE WHEN $5 THEN 'unknown' ELSE 'failed' END,available_at=CASE WHEN $3 OR $5 THEN available_at ELSE now()+make_interval(secs=>LEAST(3600,30*power(2,attempts))) END,last_error=$2,locked_by=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND locked_by=$4", [job.id, message.slice(0, 1000), terminal, workerId, ambiguous]); failed += 1;
    }
  }
  return { processed: claimed.rowCount || 0, delivered, failed };
}
