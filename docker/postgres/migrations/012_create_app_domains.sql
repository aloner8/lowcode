-- Multi-site / multi-domain hosting.
-- One Tenant App is served on its own port and may answer to several domains
-- (apex, www, staging, custom customer domain …).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.app_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    force_https BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_domains_format CHECK (
        domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$'
    )
);

-- A hostname can only ever point at one site.
CREATE UNIQUE INDEX IF NOT EXISTS app_domains_domain_key
    ON public.app_domains (LOWER(BTRIM(domain)));

-- At most one primary domain per app.
CREATE UNIQUE INDEX IF NOT EXISTS app_domains_one_primary
    ON public.app_domains (app_id)
    WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_app_domains_app ON public.app_domains (app_id, is_active);

DROP TRIGGER IF EXISTS set_app_domains_updated_at ON public.app_domains;
CREATE TRIGGER set_app_domains_updated_at
BEFORE UPDATE ON public.app_domains
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

-- Existing apps keep their `subdomain` value as the primary domain.
INSERT INTO public.app_domains (app_id, domain, is_primary)
SELECT a.id, LOWER(BTRIM(a.subdomain)), TRUE
FROM public.apps a
WHERE a.subdomain IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.app_domains d WHERE d.app_id = a.id)
ON CONFLICT DO NOTHING;

-- Keep app_domains in sync when an app's canonical subdomain changes.
CREATE OR REPLACE FUNCTION public.sync_primary_app_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.subdomain IS DISTINCT FROM OLD.subdomain THEN
        UPDATE public.app_domains
        SET domain = LOWER(BTRIM(NEW.subdomain))
        WHERE app_id = NEW.id AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_app_primary_domain ON public.apps;
CREATE TRIGGER sync_app_primary_domain
AFTER UPDATE OF subdomain ON public.apps
FOR EACH ROW EXECUTE FUNCTION public.sync_primary_app_domain();

-- Registry consumed by the multi-site entry script and the Nginx generator.
-- Dropped first because CREATE OR REPLACE VIEW cannot reorder or insert columns.
DROP VIEW IF EXISTS public.site_registry;
CREATE VIEW public.site_registry AS
SELECT
    a.id                AS app_id,
    a.app_slug,
    a.app_name,
    a.port,
    a.subdomain,
    a.tenant_db_name,
    a.is_active,
    a.theme_config,
    a.tenant_overrides,
    a.seo_settings,
    p.id                AS platform_id,
    p.platform_slug,
    COALESCE(
        (SELECT ARRAY_AGG(LOWER(BTRIM(d.domain)) ORDER BY d.is_primary DESC, d.domain)
         FROM public.app_domains d
         WHERE d.app_id = a.id AND d.is_active),
        ARRAY[]::text[]
    )                   AS domains
FROM public.apps a
LEFT JOIN public.platforms p ON p.id = a.platform_id;

COMMIT;
