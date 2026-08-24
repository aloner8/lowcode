CREATE TABLE IF NOT EXISTS public.platform_design_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  scope varchar(30) NOT NULL CHECK (scope IN ('backend','frontend','rbac','menu')),
  config_key varchar(120) NOT NULL,
  config_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_path text,
  version integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform_id, scope, config_key)
);
CREATE INDEX IF NOT EXISTS idx_platform_design_configs_scope ON public.platform_design_configs(platform_id,scope,enabled);
