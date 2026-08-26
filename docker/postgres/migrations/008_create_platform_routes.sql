BEGIN;
ALTER TABLE public.platforms ADD COLUMN IF NOT EXISTS studio_routes JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS public.platform_route_conversions (
  id TEXT PRIMARY KEY,
  platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  source_system_id TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  status TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  UNIQUE(platform_id, source_system_id, source_fingerprint, rules_version)
);
COMMIT;
