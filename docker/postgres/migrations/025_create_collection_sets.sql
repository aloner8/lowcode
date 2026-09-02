-- User-owned Collection Set definitions and immutable public snapshots.
BEGIN;

CREATE TABLE IF NOT EXISTS public.collection_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    collection_key VARCHAR(160) NOT NULL,
    collection_name VARCHAR(255) NOT NULL,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT collection_sets_key_not_blank CHECK (BTRIM(collection_key) <> ''),
    CONSTRAINT collection_sets_name_not_blank CHECK (BTRIM(collection_name) <> ''),
    CONSTRAINT collection_sets_definition_object CHECK (jsonb_typeof(definition) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS collection_sets_owner_key
    ON public.collection_sets (platform_id, owner_user_id, LOWER(BTRIM(collection_key)));
CREATE INDEX IF NOT EXISTS collection_sets_owner_updated
    ON public.collection_sets (platform_id, owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.shared_collection_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    source_collection_id UUID REFERENCES public.collection_sets(id) ON DELETE SET NULL,
    shared_by_user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE RESTRICT,
    collection_key VARCHAR(160) NOT NULL,
    collection_name VARCHAR(255) NOT NULL,
    definition JSONB NOT NULL,
    source_version INTEGER NOT NULL CHECK (source_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT shared_collection_sets_key_not_blank CHECK (BTRIM(collection_key) <> ''),
    CONSTRAINT shared_collection_sets_name_not_blank CHECK (BTRIM(collection_name) <> ''),
    CONSTRAINT shared_collection_sets_definition_object CHECK (jsonb_typeof(definition) = 'object'),
    CONSTRAINT shared_collection_sets_source_version UNIQUE (source_collection_id, source_version)
);

CREATE INDEX IF NOT EXISTS shared_collection_sets_platform_updated
    ON public.shared_collection_sets (platform_id, created_at DESC);

DROP TRIGGER IF EXISTS set_collection_sets_updated_at ON public.collection_sets;
CREATE TRIGGER set_collection_sets_updated_at
BEFORE UPDATE ON public.collection_sets
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

-- Move legacy studio_collections JSON into the new ownership model. Legacy
-- Platforms are assigned to their runtime owner, first membership, or first
-- active account (in that order), while the JSON remains for compatibility.
INSERT INTO public.collection_sets
    (platform_id, owner_user_id, collection_key, collection_name, definition)
SELECT p.id,
       COALESCE(
         p.runtime_owner_user_id,
         (SELECT pm.user_id FROM public.platform_memberships pm WHERE pm.platform_id=p.id ORDER BY pm.created_at LIMIT 1),
         (SELECT u.id FROM public.platform_users u WHERE u.is_active=TRUE ORDER BY u.created_at LIMIT 1)
       ),
       item.value->>'id',
       COALESCE(NULLIF(item.value->>'name', ''), item.value->>'id'),
       item.value
FROM public.platforms p
CROSS JOIN LATERAL jsonb_array_elements(p.studio_collections) item(value)
WHERE item.value ? 'id'
  AND COALESCE(
        p.runtime_owner_user_id,
        (SELECT pm.user_id FROM public.platform_memberships pm WHERE pm.platform_id=p.id ORDER BY pm.created_at LIMIT 1),
        (SELECT u.id FROM public.platform_users u WHERE u.is_active=TRUE ORDER BY u.created_at LIMIT 1)
      ) IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
