-- Three-tier authorisation model.
--
--   GOD     พนักงานหนุมานไอที — สร้าง Site ใหม่และตั้งค่าได้ทุก Site (ผู้ให้บริการ)
--   ADMIN   ผู้ดูแลระบบของหน่วยงาน — เพิ่มผู้ใช้และตั้งค่าเว็บของหน่วยงานตัวเอง ดู package/วันหมดอายุ
--   STAFF   พนักงานของหน่วยงาน — เพิ่มข่าว (post) และแก้ไขหน้าเว็บ (page)
--
-- GOD is the global tier and lives on platform_users.global_role.
-- ADMIN/STAFF are always scoped to one Site and live on app_memberships.

BEGIN;

-- 1. Global tier ------------------------------------------------------------
ALTER TABLE public.platform_users
    DROP CONSTRAINT IF EXISTS platform_users_global_role_check;

UPDATE public.platform_users
SET global_role = CASE global_role
    WHEN 'SUPER_ADMIN' THEN 'GOD'
    WHEN 'DEVELOPER'   THEN 'GOD'
    ELSE 'TENANT_USER'
END
WHERE global_role IN ('SUPER_ADMIN', 'DEVELOPER', 'VIEWER');

ALTER TABLE public.platform_users
    ALTER COLUMN global_role SET DEFAULT 'TENANT_USER';

ALTER TABLE public.platform_users
    ADD CONSTRAINT platform_users_global_role_check
    CHECK (global_role IN ('GOD', 'TENANT_USER'));

COMMENT ON COLUMN public.platform_users.global_role IS
    'GOD = ผู้ให้บริการ (หนุมานไอที) เข้าถึงทุก Site; TENANT_USER = ผู้ใช้ของหน่วยงาน สิทธิ์มาจาก app_memberships';

-- 2. Site tier --------------------------------------------------------------
ALTER TABLE public.app_memberships
    DROP CONSTRAINT IF EXISTS app_memberships_app_role_check;

UPDATE public.app_memberships
SET app_role = CASE app_role
    WHEN 'APP_OWNER'  THEN 'ADMIN'
    WHEN 'APP_EDITOR' THEN 'STAFF'
    ELSE 'VIEWER'
END
WHERE app_role IN ('APP_OWNER', 'APP_EDITOR', 'APP_VIEWER');

ALTER TABLE public.app_memberships
    ALTER COLUMN app_role SET DEFAULT 'STAFF';

ALTER TABLE public.app_memberships
    ADD CONSTRAINT app_memberships_app_role_check
    CHECK (app_role IN ('ADMIN', 'STAFF', 'VIEWER'));

COMMENT ON COLUMN public.app_memberships.app_role IS
    'ADMIN = ผู้ดูแลระบบของหน่วยงาน; STAFF = เพิ่มข่าว/แก้หน้าเว็บ; VIEWER = อ่านอย่างเดียว';

-- platform_memberships keeps GOD-tier developers scoped to a blueprint.
ALTER TABLE public.platform_memberships
    DROP CONSTRAINT IF EXISTS platform_memberships_platform_role_check;

UPDATE public.platform_memberships
SET platform_role = CASE platform_role
    WHEN 'APP_OWNER'  THEN 'ADMIN'
    WHEN 'APP_EDITOR' THEN 'STAFF'
    ELSE 'VIEWER'
END
WHERE platform_role IN ('APP_OWNER', 'APP_EDITOR', 'APP_VIEWER');

ALTER TABLE public.platform_memberships
    ALTER COLUMN platform_role SET DEFAULT 'STAFF';

ALTER TABLE public.platform_memberships
    ADD CONSTRAINT platform_memberships_platform_role_check
    CHECK (platform_role IN ('ADMIN', 'STAFF', 'VIEWER'));

-- 3. Subscription package per Site -----------------------------------------
ALTER TABLE public.apps
    ADD COLUMN IF NOT EXISTS package_code VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS package_name VARCHAR(255) NOT NULL DEFAULT 'Standard',
    ADD COLUMN IF NOT EXISTS package_started_at DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS package_expires_at DATE,
    ADD COLUMN IF NOT EXISTS package_limits JSONB NOT NULL DEFAULT '{
        "maxUsers": 20,
        "maxStorageMb": 2048,
        "maxDomains": 3
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

COMMENT ON COLUMN public.apps.package_expires_at IS
    'วันหมดอายุของแพ็กเกจ; NULL = ไม่มีวันหมดอายุ';

-- Existing sites get a one-year term so the expiry UI has something to show.
UPDATE public.apps
SET package_expires_at = package_started_at + INTERVAL '1 year'
WHERE package_expires_at IS NULL;

-- 4. Authorisation helpers --------------------------------------------------

/** Effective role of a user on one Site. GOD outranks every site membership. */
CREATE OR REPLACE FUNCTION public.site_role_of(p_user_id UUID, p_app_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM public.platform_users u
            WHERE u.id = p_user_id AND u.is_active AND u.global_role = 'GOD'
        ) THEN 'GOD'
        ELSE (
            SELECT m.app_role FROM public.app_memberships m
            WHERE m.user_id = p_user_id AND m.app_id = p_app_id
        )
    END;
$$;

/** Numeric rank so callers can express "ADMIN or above". */
CREATE OR REPLACE FUNCTION public.role_rank(p_role TEXT)
RETURNS INT
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE p_role
        WHEN 'GOD'    THEN 3
        WHEN 'ADMIN'  THEN 2
        WHEN 'STAFF'  THEN 1
        WHEN 'VIEWER' THEN 0
        ELSE -1
    END;
$$;

/** Sites a user may see: every site for GOD, membership sites for everyone else. */
CREATE OR REPLACE FUNCTION public.sites_for_user(p_user_id UUID)
RETURNS TABLE (app_id UUID, app_role TEXT)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
    SELECT a.id, 'GOD'::text
    FROM public.apps a
    WHERE EXISTS (
        SELECT 1 FROM public.platform_users u
        WHERE u.id = p_user_id AND u.is_active AND u.global_role = 'GOD'
    )
    UNION
    SELECT m.app_id, m.app_role
    FROM public.app_memberships m
    JOIN public.platform_users u ON u.id = m.user_id AND u.is_active
    WHERE m.user_id = p_user_id AND u.global_role <> 'GOD';
$$;

REVOKE ALL ON FUNCTION public.site_role_of(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sites_for_user(UUID) FROM PUBLIC;

-- 5. Keep the site registry in step ----------------------------------------
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
    a.package_code,
    a.package_name,
    a.package_started_at,
    a.package_expires_at,
    a.package_limits,
    a.is_suspended,
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
