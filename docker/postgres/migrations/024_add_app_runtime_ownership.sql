-- App instances and Platform test runtimes belong to the user who created or
-- most recently built them. This allows "My websites" to stay user-scoped,
-- including for service-provider (GOD) accounts.
BEGIN;

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES public.platform_users(id) ON DELETE SET NULL;

ALTER TABLE public.platforms
  ADD COLUMN IF NOT EXISTS runtime_owner_user_id UUID REFERENCES public.platform_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apps_owner_user
  ON public.apps(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platforms_runtime_owner
  ON public.platforms(runtime_owner_user_id, runtime_built_at DESC);

-- Recover ownership of legacy rows from their latest audit entry when the
-- actor still maps to a current account.
UPDATE public.apps app
SET owner_user_id = (
  SELECT user_account.id AS user_id
  FROM public.platform_audit_logs audit
  JOIN public.platform_users user_account
    ON LOWER(user_account.username)=LOWER(audit.performed_by)
    OR LOWER(user_account.email)=LOWER(audit.performed_by)
  WHERE audit.entity_id=app.id AND audit.action='CREATE_APP'
  ORDER BY audit.created_at DESC
  LIMIT 1
)
WHERE app.owner_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.platform_audit_logs audit
    JOIN public.platform_users user_account
      ON LOWER(user_account.username)=LOWER(audit.performed_by)
      OR LOWER(user_account.email)=LOWER(audit.performed_by)
    WHERE audit.entity_id=app.id AND audit.action='CREATE_APP'
  );

UPDATE public.platforms platform
SET runtime_owner_user_id = (
  SELECT user_account.id AS user_id
  FROM public.platform_audit_logs audit
  JOIN public.platform_users user_account
    ON LOWER(user_account.username)=LOWER(audit.performed_by)
    OR LOWER(user_account.email)=LOWER(audit.performed_by)
  WHERE audit.platform_id=platform.id AND audit.action='BUILD_RUNTIME'
  ORDER BY audit.created_at DESC
  LIMIT 1
)
WHERE platform.runtime_owner_user_id IS NULL
  AND platform.runtime_built_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.platform_audit_logs audit
    JOIN public.platform_users user_account
      ON LOWER(user_account.username)=LOWER(audit.performed_by)
      OR LOWER(user_account.email)=LOWER(audit.performed_by)
    WHERE audit.platform_id=platform.id AND audit.action='BUILD_RUNTIME'
  );

COMMIT;
