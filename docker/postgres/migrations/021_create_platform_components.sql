-- A page owns component instances; users own reusable component definitions.
-- Definitions stay private until their owner explicitly snapshots a version
-- into share_components.
BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    component_key VARCHAR(160) NOT NULL,
    component_name VARCHAR(255) NOT NULL,
    component_type VARCHAR(120) NOT NULL,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_components_key_not_blank CHECK (BTRIM(component_key) <> ''),
    CONSTRAINT platform_components_name_not_blank CHECK (BTRIM(component_name) <> ''),
    CONSTRAINT platform_components_definition_object CHECK (jsonb_typeof(definition) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_components_owner_key
    ON public.platform_components (platform_id, owner_user_id, LOWER(BTRIM(component_key)));
CREATE INDEX IF NOT EXISTS platform_components_owner_updated
    ON public.platform_components (platform_id, owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.share_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    source_component_id UUID REFERENCES public.platform_components(id) ON DELETE SET NULL,
    shared_by_user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE RESTRICT,
    component_key VARCHAR(160) NOT NULL,
    component_name VARCHAR(255) NOT NULL,
    component_type VARCHAR(120) NOT NULL,
    definition JSONB NOT NULL,
    source_version INTEGER NOT NULL CHECK (source_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT share_components_key_not_blank CHECK (BTRIM(component_key) <> ''),
    CONSTRAINT share_components_name_not_blank CHECK (BTRIM(component_name) <> ''),
    CONSTRAINT share_components_definition_object CHECK (jsonb_typeof(definition) = 'object'),
    CONSTRAINT share_components_source_version UNIQUE (source_component_id, source_version)
);

CREATE INDEX IF NOT EXISTS share_components_platform_updated
    ON public.share_components (platform_id, created_at DESC);

DROP TRIGGER IF EXISTS set_platform_components_updated_at ON public.platform_components;
CREATE TRIGGER set_platform_components_updated_at
BEFORE UPDATE ON public.platform_components
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

COMMIT;
