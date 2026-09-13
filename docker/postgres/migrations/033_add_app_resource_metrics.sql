-- P6: background resource measurements that remain available while an App is stopped.

BEGIN;

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS resource_metrics JSONB,
  ADD COLUMN IF NOT EXISTS resource_metrics_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resource_metrics_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'apps_resource_metrics_object' AND conrelid = 'public.apps'::regclass
  ) THEN
    ALTER TABLE public.apps ADD CONSTRAINT apps_resource_metrics_object CHECK (
      resource_metrics IS NULL OR jsonb_typeof(resource_metrics) = 'object'
    );
  END IF;
END $$;

COMMIT;
