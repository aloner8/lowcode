-- Configurable rate limiting.
--
-- Policies are rows so the service provider (GOD) can tune them from the admin
-- UI without a deploy. Attempts are counted in the database rather than in
-- process memory, because sites run as many separate processes — an in-memory
-- counter would reset on restart and be trivially bypassed by hitting another
-- port.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.rate_limit_policies (
    policy_key VARCHAR(60) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    -- Attempts allowed inside the rolling window before a lockout starts.
    max_attempts INT NOT NULL DEFAULT 10,
    window_seconds INT NOT NULL DEFAULT 900,
    lockout_seconds INT NOT NULL DEFAULT 900,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rate_limit_max_attempts CHECK (max_attempts BETWEEN 1 AND 10000),
    CONSTRAINT rate_limit_window CHECK (window_seconds BETWEEN 10 AND 86400),
    CONSTRAINT rate_limit_lockout CHECK (lockout_seconds BETWEEN 0 AND 86400)
);

COMMENT ON TABLE public.rate_limit_policies IS
    'นโยบายจำกัดอัตราการเรียก แก้ไขได้จากหน้า GOD (/admin/security)';

-- One row per (policy, identity). Identity is an IP, an email or a site slug,
-- depending on the policy.
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
    policy_key VARCHAR(60) NOT NULL REFERENCES public.rate_limit_policies(policy_key) ON DELETE CASCADE,
    identity VARCHAR(255) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (policy_key, identity)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_locked
    ON public.rate_limit_attempts (locked_until)
    WHERE locked_until IS NOT NULL;

DROP TRIGGER IF EXISTS set_rate_limit_policies_updated_at ON public.rate_limit_policies;
CREATE TRIGGER set_rate_limit_policies_updated_at
BEFORE UPDATE ON public.rate_limit_policies
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

-- Default policies -----------------------------------------------------------
INSERT INTO public.rate_limit_policies
    (policy_key, label, description, max_attempts, window_seconds, lockout_seconds)
VALUES
    ('platform_login', 'เข้าสู่ระบบเว็บแม่',
     'จำกัดการพยายามเข้าสู่ระบบของผู้ดูแล (GOD/ADMIN/STAFF) ต่อหนึ่งบัญชีหรือหนึ่ง IP', 10, 900, 900),
    ('tenant_login', 'เข้าสู่ระบบของเว็บหน่วยงาน',
     'จำกัดการพยายามเข้าสู่ระบบของผู้ใช้ปลายทางบนเว็บ Site', 10, 900, 900),
    ('public_write', 'ส่งฟอร์มสาธารณะ',
     'จำกัดการบันทึกข้อมูลจากผู้เข้าชมที่ไม่ได้ล็อกอิน เช่น ฟอร์มร้องเรียน', 20, 3600, 600),
    ('public_read', 'อ่านข้อมูลสาธารณะ',
     'จำกัดการดึงข้อมูลจาก Runtime API ของผู้เข้าชมที่ไม่ได้ล็อกอิน', 600, 300, 60)
ON CONFLICT (policy_key) DO NOTHING;

/**
 * Records one attempt and reports whether it is allowed.
 *
 * The whole decision happens in a single statement so concurrent requests
 * cannot race past the limit. Returns the remaining allowance and, when the
 * caller is locked out, how many seconds until it may retry.
 */
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
    p_policy_key TEXT,
    p_identity TEXT
) RETURNS TABLE (allowed BOOLEAN, remaining INT, retry_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_policy public.rate_limit_policies%ROWTYPE;
    v_row public.rate_limit_attempts%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_policy FROM public.rate_limit_policies WHERE policy_key = p_policy_key;

    -- An unknown or disabled policy never blocks: rate limiting must fail open
    -- rather than lock everyone out of a working system.
    IF NOT FOUND OR NOT v_policy.is_enabled THEN
        RETURN QUERY SELECT TRUE, -1, 0;
        RETURN;
    END IF;

    INSERT INTO public.rate_limit_attempts (policy_key, identity, attempts, window_started_at, last_attempt_at)
    VALUES (p_policy_key, LEFT(p_identity, 255), 1, v_now, v_now)
    ON CONFLICT (policy_key, identity) DO UPDATE
    SET
        -- Start a fresh window once the previous one has elapsed.
        attempts = CASE
            WHEN public.rate_limit_attempts.window_started_at < v_now - make_interval(secs => v_policy.window_seconds)
            THEN 1
            ELSE public.rate_limit_attempts.attempts + 1
        END,
        window_started_at = CASE
            WHEN public.rate_limit_attempts.window_started_at < v_now - make_interval(secs => v_policy.window_seconds)
            THEN v_now
            ELSE public.rate_limit_attempts.window_started_at
        END,
        locked_until = CASE
            WHEN public.rate_limit_attempts.locked_until > v_now THEN public.rate_limit_attempts.locked_until
            ELSE NULL
        END,
        last_attempt_at = v_now
    RETURNING * INTO v_row;

    IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
        RETURN QUERY SELECT FALSE, 0, CEIL(EXTRACT(EPOCH FROM v_row.locked_until - v_now))::int;
        RETURN;
    END IF;

    IF v_row.attempts > v_policy.max_attempts THEN
        UPDATE public.rate_limit_attempts
        SET locked_until = v_now + make_interval(secs => v_policy.lockout_seconds)
        WHERE policy_key = p_policy_key AND identity = LEFT(p_identity, 255);

        RETURN QUERY SELECT FALSE, 0, v_policy.lockout_seconds;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, v_policy.max_attempts - v_row.attempts, 0;
END;
$$;

/** Clears the counter after a successful attempt, so honest users are not penalised. */
CREATE OR REPLACE FUNCTION public.rate_limit_reset(p_policy_key TEXT, p_identity TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    DELETE FROM public.rate_limit_attempts
    WHERE policy_key = p_policy_key AND identity = LEFT(p_identity, 255);
$$;

/** Housekeeping: drops rows whose window and lockout have both expired. */
CREATE OR REPLACE FUNCTION public.rate_limit_prune()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM public.rate_limit_attempts a
    USING public.rate_limit_policies p
    WHERE a.policy_key = p.policy_key
      AND (a.locked_until IS NULL OR a.locked_until < NOW())
      AND a.last_attempt_at < NOW() - make_interval(secs => p.window_seconds * 2);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_limit_reset(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_limit_prune() FROM PUBLIC;

COMMIT;
