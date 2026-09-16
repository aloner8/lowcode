-- P8 Mail: durable SMTP delivery states and recoverable worker leases.
BEGIN;

ALTER TABLE public.connection_profiles
  DROP CONSTRAINT IF EXISTS connection_profiles_profile_type_check;
ALTER TABLE public.connection_profiles
  ADD CONSTRAINT connection_profiles_profile_type_check
  CHECK (profile_type IN ('POSTGRES', 'HTTP', 'OBJECT_STORAGE', 'SMTP'));

ALTER TABLE public.service_outbox_jobs
  DROP CONSTRAINT IF EXISTS service_outbox_jobs_status_check;

UPDATE public.service_outbox_jobs
SET status = CASE status
  WHEN 'pending' THEN 'queued'
  WHEN 'delivered' THEN 'accepted'
  ELSE status
END;

ALTER TABLE public.service_outbox_jobs
  ADD CONSTRAINT service_outbox_jobs_status_check
  CHECK (status IN ('queued', 'pending', 'processing', 'accepted', 'delivered', 'failed', 'unknown'));

ALTER TABLE public.service_outbox_jobs
  ADD COLUMN IF NOT EXISTS locked_by VARCHAR(160),
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.idx_service_outbox_ready;
CREATE INDEX IF NOT EXISTS idx_service_outbox_ready
  ON public.service_outbox_jobs(status, available_at, created_at)
  WHERE status IN ('queued', 'pending', 'failed', 'processing');

COMMIT;
