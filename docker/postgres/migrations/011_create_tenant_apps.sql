-- Tenant Apps spawned from a Platform Master (PlatformModule.MD §2).
-- Gives /admin/apps a real backing store and carries the tenant override
-- payload consumed by PlatformMergeEngine.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
    app_slug VARCHAR(100) NOT NULL UNIQUE,
    app_name VARCHAR(255) NOT NULL,
    description TEXT,
    port INT NOT NULL UNIQUE,
    subdomain VARCHAR(255) NOT NULL UNIQUE,
    tenant_db_name VARCHAR(255) NOT NULL UNIQUE,
    theme_config JSONB NOT NULL DEFAULT '{
        "preset": "modern-indigo",
        "mode": "light",
        "primaryColor": "#0d6efd",
        "borderRadius": "0.375rem",
        "fontFamily": "Inter, sans-serif"
    }'::jsonb,
    tenant_overrides JSONB NOT NULL DEFAULT '{
        "disabledFeatures": [],
        "themeOverrides": {},
        "componentPropsOverrides": {}
    }'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT apps_slug_format CHECK (app_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT apps_port_range CHECK (port BETWEEN 1024 AND 65535),
    CONSTRAINT apps_db_name_format CHECK (tenant_db_name ~ '^[a-z_][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_apps_platform ON public.apps (platform_id);

DROP TRIGGER IF EXISTS set_apps_updated_at ON public.apps;
CREATE TRIGGER set_apps_updated_at
BEFORE UPDATE ON public.apps
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

CREATE TABLE IF NOT EXISTS public.app_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    app_role VARCHAR(50) NOT NULL DEFAULT 'APP_EDITOR'
        CHECK (app_role IN ('APP_OWNER', 'APP_EDITOR', 'APP_VIEWER')),
    granted_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_memberships_unique UNIQUE (user_id, app_id)
);

DROP TRIGGER IF EXISTS set_app_memberships_updated_at ON public.app_memberships;
CREATE TRIGGER set_app_memberships_updated_at
BEFORE UPDATE ON public.app_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

-- Allocate the next free host port for a spawned tenant container.
CREATE OR REPLACE FUNCTION public.next_tenant_port(p_start INT DEFAULT 33001)
RETURNS INT
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(MAX(port) + 1, p_start) FROM public.apps WHERE port >= p_start;
$$;

-- Spawn a tenant app from a platform blueprint in one transaction.
CREATE OR REPLACE FUNCTION public.provision_tenant_app(
    p_platform_id UUID,
    p_app_name TEXT,
    p_app_slug TEXT,
    p_subdomain TEXT DEFAULT NULL,
    p_port INT DEFAULT NULL,
    p_performed_by TEXT DEFAULT 'system'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_app_id UUID;
    v_slug TEXT := LOWER(BTRIM(p_app_slug));
    v_name TEXT := BTRIM(p_app_name);
    v_db_name TEXT;
    v_port INT;
    v_subdomain TEXT;
    v_theme JSONB;
BEGIN
    IF v_name = '' THEN
        RAISE EXCEPTION 'app_name must not be empty' USING ERRCODE = '22023';
    END IF;
    IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
        RAISE EXCEPTION 'app_slug must match ^[a-z0-9]+(-[a-z0-9]+)*$' USING ERRCODE = '22023';
    END IF;

    SELECT master_theme_config INTO v_theme
    FROM public.platforms WHERE id = p_platform_id;

    IF v_theme IS NULL THEN
        RAISE EXCEPTION 'platform not found' USING ERRCODE = '23503';
    END IF;

    v_db_name := 'app_db_' || REPLACE(v_slug, '-', '_');
    v_port := COALESCE(p_port, public.next_tenant_port());
    v_subdomain := COALESCE(NULLIF(BTRIM(COALESCE(p_subdomain, '')), ''), v_slug || '.localhost');

    INSERT INTO public.apps
        (platform_id, app_slug, app_name, port, subdomain, tenant_db_name, theme_config)
    VALUES (p_platform_id, v_slug, v_name, v_port, v_subdomain, v_db_name, v_theme)
    RETURNING id INTO v_app_id;

    -- Register the canonical hostname so the site registry and the multi-site
    -- launcher can route to this app immediately. Skipped when app_domains has
    -- not been created yet (migration 012 runs after this one on a fresh init).
    IF to_regclass('public.app_domains') IS NOT NULL THEN
        INSERT INTO public.app_domains (app_id, domain, is_primary)
        VALUES (v_app_id, v_subdomain, TRUE)
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.platform_audit_logs
        (platform_id, entity_type, entity_id, action, performed_by, changes_summary, snapshot_after)
    VALUES (
        p_platform_id, 'APP', v_app_id, 'CREATE_APP', p_performed_by,
        format('สร้าง Tenant App "%s" (%s) บนพอร์ต %s', v_name, v_slug, v_port),
        jsonb_build_object('appId', v_app_id, 'appSlug', v_slug, 'port', v_port,
                           'subdomain', v_subdomain, 'tenantDbName', v_db_name)
    );

    RETURN v_app_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_tenant_app(UUID, TEXT, TEXT, TEXT, INT, TEXT) FROM PUBLIC;

COMMIT;
