-- P5-B3: Customer-owned server-side connection selectors.
-- This table stores connection metadata and opaque SecretRefs only. It never
-- stores passwords, tokens, connection strings, or other credential values.

BEGIN;

CREATE TABLE IF NOT EXISTS public.connection_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    profile_key VARCHAR(120) NOT NULL,
    profile_name VARCHAR(255) NOT NULL,
    profile_type VARCHAR(30) NOT NULL
        CHECK (profile_type IN ('POSTGRES', 'HTTP', 'OBJECT_STORAGE')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    secret_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy JSONB NOT NULL DEFAULT '{"allowedModuleKeys":[],"allowRuntimeWrite":false}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'READY', 'DISABLED', 'ERROR')),
    edit_version BIGINT NOT NULL DEFAULT 1 CHECK (edit_version > 0),
    last_checked_at TIMESTAMPTZ,
    last_error_code VARCHAR(100),
    last_error_detail TEXT,
    created_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT connection_profiles_key_not_blank CHECK (BTRIM(profile_key) <> ''),
    CONSTRAINT connection_profiles_name_not_blank CHECK (BTRIM(profile_name) <> ''),
    CONSTRAINT connection_profiles_key_format
        CHECK (profile_key ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
    CONSTRAINT connection_profiles_config_object CHECK (jsonb_typeof(config) = 'object'),
    CONSTRAINT connection_profiles_secret_refs_object CHECK (jsonb_typeof(secret_refs) = 'object'),
    CONSTRAINT connection_profiles_policy_object CHECK (jsonb_typeof(policy) = 'object'),
    CONSTRAINT connection_profiles_customer_key_unique UNIQUE (customer_id, profile_key),
    CONSTRAINT connection_profiles_customer_id_id_unique UNIQUE (customer_id, id)
);

CREATE INDEX IF NOT EXISTS idx_connection_profiles_customer_updated
    ON public.connection_profiles (customer_id, updated_at DESC)
    WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS set_connection_profiles_updated_at ON public.connection_profiles;
CREATE TRIGGER set_connection_profiles_updated_at
BEFORE UPDATE ON public.connection_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

ALTER TABLE public.apps
    ADD COLUMN IF NOT EXISTS connection_profile_id UUID
        REFERENCES public.connection_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apps_connection_profile
    ON public.apps (connection_profile_id)
    WHERE connection_profile_id IS NOT NULL;

COMMENT ON COLUMN public.connection_profiles.secret_refs IS
    'Opaque server-side SecretRefs only; plaintext credentials and connection strings are forbidden by API policy.';
COMMENT ON COLUMN public.apps.connection_profile_id IS
    'Server-selected Customer connection profile; never serialized into public Template artifacts.';

COMMIT;
