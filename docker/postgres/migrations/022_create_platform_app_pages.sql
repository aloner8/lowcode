-- App-scoped Page instances. platform_pages remains the canonical Master.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.platform_pages
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.platform_app_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  platform_page_id UUID NOT NULL REFERENCES public.platform_pages(id) ON DELETE CASCADE,
  instance_key VARCHAR(160) NOT NULL,
  sync_mode VARCHAR(20) NOT NULL DEFAULT 'FOLLOW_MASTER'
    CHECK (sync_mode IN ('FOLLOW_MASTER', 'PINNED', 'DETACHED')),
  base_master_version INTEGER NOT NULL DEFAULT 1,
  base_master_updated_at TIMESTAMPTZ,
  page_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  component_tree_override JSONB,
  style_overrides JSONB NOT NULL DEFAULT '{"rules":[]}'::jsonb,
  collection_bindings JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  disabled_component_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  detached_component_tree JSONB,
  detached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_app_pages_app_master_unique UNIQUE (app_id, platform_page_id),
  CONSTRAINT platform_app_pages_instance_key_unique UNIQUE (app_id, instance_key),
  CONSTRAINT platform_app_pages_component_override_array
    CHECK (component_tree_override IS NULL OR jsonb_typeof(component_tree_override) = 'array'),
  CONSTRAINT platform_app_pages_detached_tree_array
    CHECK (detached_component_tree IS NULL OR jsonb_typeof(detached_component_tree) = 'array'),
  CONSTRAINT platform_app_pages_disabled_ids_array
    CHECK (jsonb_typeof(disabled_component_ids) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_platform_app_pages_app
  ON public.platform_app_pages(app_id);
CREATE INDEX IF NOT EXISTS idx_platform_app_pages_master
  ON public.platform_app_pages(platform_page_id);

DROP TRIGGER IF EXISTS set_platform_app_pages_updated_at ON public.platform_app_pages;
CREATE TRIGGER set_platform_app_pages_updated_at
BEFORE UPDATE ON public.platform_app_pages
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

COMMIT;
