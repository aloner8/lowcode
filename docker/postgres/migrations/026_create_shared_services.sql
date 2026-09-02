BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.service_definitions (
  service_key varchar(120) NOT NULL,
  version varchar(30) NOT NULL,
  display_name varchar(255) NOT NULL,
  kind varchar(30) NOT NULL CHECK (kind IN ('auth', 'data', 'storage', 'notification')),
  lifecycle varchar(20) NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'deprecated', 'retired')),
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_key, version)
);

CREATE TABLE IF NOT EXISTS public.app_service_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_key varchar(160) NOT NULL,
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  app_id uuid REFERENCES public.apps(id) ON DELETE CASCADE,
  service_key varchar(120) NOT NULL,
  service_version varchar(30) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy jsonb NOT NULL DEFAULT '{"allowedOperations":[]}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'valid', 'invalid', 'published')),
  revision integer NOT NULL DEFAULT 1,
  updated_by varchar(255) NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_id, app_id, binding_key),
  FOREIGN KEY (service_key, service_version) REFERENCES public.service_definitions(service_key, version)
);

CREATE TABLE IF NOT EXISTS public.service_invocation_audit (
  id bigserial PRIMARY KEY,
  request_id uuid NOT NULL,
  trace_id varchar(120) NOT NULL,
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  app_id uuid REFERENCES public.apps(id) ON DELETE SET NULL,
  actor_type varchar(30) NOT NULL,
  actor_id varchar(255),
  binding_key varchar(160) NOT NULL,
  service_key varchar(120) NOT NULL,
  service_version varchar(30) NOT NULL,
  operation varchar(100) NOT NULL,
  outcome varchar(30) NOT NULL,
  error_code varchar(100),
  duration_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_audit_scope_created ON public.service_invocation_audit(platform_id, app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_audit_request ON public.service_invocation_audit(request_id);

CREATE TABLE IF NOT EXISTS public.service_idempotency_keys (
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  app_scope varchar(80) NOT NULL,
  binding_key varchar(160) NOT NULL,
  operation varchar(100) NOT NULL,
  idempotency_key varchar(255) NOT NULL,
  request_hash char(64) NOT NULL,
  response_status integer,
  response_body jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform_id, app_scope, binding_key, operation, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_service_idempotency_expiry ON public.service_idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS public.service_outbox_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  app_id uuid REFERENCES public.apps(id) ON DELETE SET NULL,
  binding_key varchar(160) NOT NULL,
  operation varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  config_snapshot jsonb NOT NULL,
  secret_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  provider_message_id varchar(255),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_outbox_ready ON public.service_outbox_jobs(status, available_at) WHERE status IN ('pending', 'failed');

COMMIT;
