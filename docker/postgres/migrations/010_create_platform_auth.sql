-- Platform (Web แม่) authentication and RBAC.
-- Replaces the hard-coded MOCK_USERS list that previously lived in application source.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.platform_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    password_hash TEXT NOT NULL,
    -- Tightened to ('GOD','TENANT_USER') by migration 015.
    global_role VARCHAR(50) NOT NULL DEFAULT 'DEVELOPER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_users_username_not_blank CHECK (BTRIM(username) <> ''),
    CONSTRAINT platform_users_email_not_blank CHECK (BTRIM(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_users_username_ci_key
    ON public.platform_users (LOWER(BTRIM(username)));
CREATE UNIQUE INDEX IF NOT EXISTS platform_users_email_ci_key
    ON public.platform_users (LOWER(BTRIM(email)));

DROP TRIGGER IF EXISTS set_platform_users_updated_at ON public.platform_users;
CREATE TRIGGER set_platform_users_updated_at
BEFORE UPDATE ON public.platform_users
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

-- Per-platform authorisation for developers ---------------------------------
CREATE TABLE IF NOT EXISTS public.platform_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    -- Tightened to ('ADMIN','STAFF','VIEWER') by migration 015.
    platform_role VARCHAR(50) NOT NULL DEFAULT 'APP_EDITOR',
    granted_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_memberships_unique UNIQUE (user_id, platform_id)
);

DROP TRIGGER IF EXISTS set_platform_memberships_updated_at ON public.platform_memberships;
CREATE TRIGGER set_platform_memberships_updated_at
BEFORE UPDATE ON public.platform_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

-- Credential verification lives in the database so the application never
-- needs to know how passwords are hashed.
CREATE OR REPLACE FUNCTION public.verify_platform_credentials(
    p_identifier TEXT,
    p_password TEXT
) RETURNS TABLE (
    id UUID,
    username VARCHAR,
    email VARCHAR,
    full_name VARCHAR,
    avatar_url TEXT,
    global_role VARCHAR,
    is_active BOOLEAN,
    must_change_password BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.platform_users%ROWTYPE;
BEGIN
    SELECT * INTO v_user
    FROM public.platform_users u
    WHERE LOWER(BTRIM(u.username)) = LOWER(BTRIM(p_identifier))
       OR LOWER(BTRIM(u.email)) = LOWER(BTRIM(p_identifier))
    LIMIT 1;

    IF NOT FOUND OR NOT v_user.is_active THEN
        RETURN;
    END IF;

    IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
        RETURN;
    END IF;

    IF v_user.password_hash <> crypt(p_password, v_user.password_hash) THEN
        UPDATE public.platform_users
        SET failed_login_count = failed_login_count + 1,
            locked_until = CASE WHEN failed_login_count + 1 >= 10
                                THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END
        WHERE public.platform_users.id = v_user.id;
        RETURN;
    END IF;

    UPDATE public.platform_users
    SET last_login_at = NOW(), failed_login_count = 0, locked_until = NULL
    WHERE public.platform_users.id = v_user.id;

    RETURN QUERY
    SELECT v_user.id, v_user.username, v_user.email, v_user.full_name, v_user.avatar_url,
           v_user.global_role, v_user.is_active, v_user.must_change_password,
           v_user.created_at, v_user.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_platform_credentials(TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.set_platform_user_password(
    p_user_id UUID,
    p_password TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF LENGTH(p_password) < 8 THEN
        RAISE EXCEPTION 'password must be at least 8 characters' USING ERRCODE = '22023';
    END IF;
    UPDATE public.platform_users
    SET password_hash = crypt(p_password, gen_salt('bf', 12)),
        must_change_password = FALSE,
        failed_login_count = 0,
        locked_until = NULL
    WHERE id = p_user_id;
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_user_password(UUID, TEXT) FROM PUBLIC;

-- Development bootstrap accounts -------------------------------------------
-- Seeded ONLY when the table is empty. Both accounts are flagged
-- must_change_password = TRUE; change them before exposing the instance.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.platform_users) THEN
        INSERT INTO public.platform_users
            (id, username, email, full_name, password_hash, global_role, must_change_password)
        VALUES
            ('11111111-1111-1111-1111-111111111111'::uuid, 'admin', 'admin@platform.com',
             'Super Admin', crypt('1qaz@WSX', gen_salt('bf', 12)), 'SUPER_ADMIN', TRUE),
            ('22222222-2222-2222-2222-222222222222'::uuid, 'aloner', 'aloner@platform.com',
             'Aloner Developer', crypt('1qaz@WSX', gen_salt('bf', 12)), 'DEVELOPER', TRUE);
    END IF;
END $$;

COMMIT;
