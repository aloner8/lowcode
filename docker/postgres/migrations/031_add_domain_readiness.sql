-- P6: reserved domains are not routable until DNS and proxy readiness have
-- been checked explicitly. Existing active domains retain their live status.

BEGIN;

ALTER TABLE public.app_domains
  ADD COLUMN IF NOT EXISTS readiness_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_DNS'
    CHECK (readiness_status IN ('PENDING_DNS', 'PENDING_PROXY', 'READY')),
  ADD COLUMN IF NOT EXISTS dns_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proxy_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Rows that were already in the live registry before readiness tracking were
-- introduced are known to have been accepted by the previous deployment.
UPDATE public.app_domains
SET readiness_status = 'READY',
    dns_checked_at = COALESCE(dns_checked_at, updated_at),
    proxy_checked_at = COALESCE(proxy_checked_at, updated_at),
    verified_at = COALESCE(verified_at, updated_at)
WHERE is_active = TRUE AND readiness_status = 'PENDING_DNS';

CREATE OR REPLACE FUNCTION public.sync_primary_app_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.subdomain IS DISTINCT FROM OLD.subdomain THEN
        UPDATE public.app_domains
        SET domain = LOWER(BTRIM(NEW.subdomain)), readiness_status = 'PENDING_DNS',
            dns_checked_at = NULL, proxy_checked_at = NULL, verified_at = NULL,
            verification_token = encode(gen_random_bytes(18), 'hex'), last_error = NULL
        WHERE app_id = NEW.id AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$;

DROP VIEW IF EXISTS public.site_registry;
CREATE VIEW public.site_registry AS
SELECT
    a.id AS app_id, a.app_slug, a.app_name, a.port, a.subdomain,
    a.tenant_db_name, a.is_active, a.theme_config, a.tenant_overrides,
    a.seo_settings,
    p.id AS platform_id, p.platform_slug,
    COALESCE(
        (SELECT ARRAY_AGG(LOWER(BTRIM(d.domain)) ORDER BY d.is_primary DESC, d.domain)
         FROM public.app_domains d
         WHERE d.app_id = a.id AND d.is_active AND d.readiness_status = 'READY'),
        ARRAY[]::text[]
    ) AS domains
FROM public.apps a
LEFT JOIN public.platforms p ON p.id = a.platform_id;

COMMIT;
