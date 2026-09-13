-- P6: controller-observed health and resource samples for tenant App processes.

BEGIN;

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS runtime_pid INTEGER,
  ADD COLUMN IF NOT EXISTS health_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS runtime_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS runtime_stopped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS runtime_metrics JSONB,
  ADD COLUMN IF NOT EXISTS runtime_metrics_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'apps_runtime_metrics_object' AND conrelid = 'public.apps'::regclass
  ) THEN
    ALTER TABLE public.apps ADD CONSTRAINT apps_runtime_metrics_object CHECK (
      runtime_metrics IS NULL OR jsonb_typeof(runtime_metrics) = 'object'
    );
  END IF;
END $$;

DROP VIEW IF EXISTS public.site_registry;
CREATE VIEW public.site_registry AS
SELECT
    a.id AS app_id, a.app_slug, a.app_name, a.port, a.subdomain,
    a.tenant_db_name, a.is_active, a.theme_config, a.tenant_overrides,
    a.seo_settings, a.desired_state, a.observed_state, a.runtime_error_detail,
    a.health_checked_at, a.runtime_started_at, a.runtime_stopped_at,
    a.runtime_metrics, a.runtime_metrics_at,
    p.id AS platform_id, p.platform_slug,
    COALESCE(
        (SELECT ARRAY_AGG(LOWER(BTRIM(d.domain)) ORDER BY d.is_primary DESC, d.domain)
         FROM public.app_domains d
         WHERE d.app_id = a.id AND d.is_active AND d.readiness_status = 'READY'),
        ARRAY[]::text[]
    ) AS domains
FROM public.apps a
LEFT JOIN public.platforms p ON p.id = a.platform_id;

COMMIT;
