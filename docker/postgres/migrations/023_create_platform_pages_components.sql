-- Reusable component instances placed on Platform Master pages.
-- The instance stores bindings/overrides only; its live definition remains in
-- platform_components so a template update is visible to every page at once.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.platform_pages_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_page_id UUID NOT NULL REFERENCES public.platform_pages(id) ON DELETE CASCADE,
  platform_component_id UUID NOT NULL REFERENCES public.platform_components(id) ON DELETE RESTRICT,
  instance_key VARCHAR(180) NOT NULL,
  instance_name VARCHAR(255) NOT NULL,
  layout_region VARCHAR(80) NOT NULL DEFAULT 'content',
  sort_order INTEGER NOT NULL DEFAULT 0,
  props_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_bindings JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_bindings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_pages_components_page_key_unique UNIQUE (platform_page_id, instance_key),
  CONSTRAINT platform_pages_components_key_not_blank CHECK (BTRIM(instance_key) <> ''),
  CONSTRAINT platform_pages_components_props_object CHECK (jsonb_typeof(props_overrides) = 'object'),
  CONSTRAINT platform_pages_components_request_object CHECK (jsonb_typeof(request_bindings) = 'object'),
  CONSTRAINT platform_pages_components_response_object CHECK (jsonb_typeof(response_bindings) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_platform_pages_components_page
  ON public.platform_pages_components(platform_page_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_platform_pages_components_component
  ON public.platform_pages_components(platform_component_id);

DROP TRIGGER IF EXISTS set_platform_pages_components_updated_at ON public.platform_pages_components;
CREATE TRIGGER set_platform_pages_components_updated_at
BEFORE UPDATE ON public.platform_pages_components
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

COMMIT;
