-- P3 foundation: idempotent App registration and a durable operation journal.
-- Database/process/proxy effects happen outside this transaction and advance
-- checkpoints in app_operations.

BEGIN;

ALTER TABLE public.apps
    ADD COLUMN IF NOT EXISTS desired_state VARCHAR(20) NOT NULL DEFAULT 'STOPPED'
        CHECK (desired_state IN ('STOPPED', 'RUNNING')),
    ADD COLUMN IF NOT EXISTS observed_state VARCHAR(20) NOT NULL DEFAULT 'UNPROVISIONED'
        CHECK (observed_state IN ('UNPROVISIONED', 'PROVISIONING', 'STOPPED', 'STARTING', 'RUNNING', 'STOPPING', 'FAILED')),
    ADD COLUMN IF NOT EXISTS schema_revision VARCHAR(64),
    ADD COLUMN IF NOT EXISTS runtime_error_detail TEXT;

CREATE TABLE IF NOT EXISTS public.app_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    operation_key VARCHAR(180) NOT NULL,
    operation_type VARCHAR(30) NOT NULL
        CHECK (operation_type IN ('PROVISION', 'START', 'STOP', 'UPDATE_REVISION')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    checkpoint VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
    error_detail TEXT,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_operations_key_not_blank CHECK (BTRIM(operation_key) <> ''),
    CONSTRAINT app_operations_result_object CHECK (jsonb_typeof(result) = 'object'),
    CONSTRAINT app_operations_customer_key_unique UNIQUE (customer_id, operation_key)
);

CREATE INDEX IF NOT EXISTS idx_app_operations_app_created
    ON public.app_operations (app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_operations_status
    ON public.app_operations (status, updated_at);

DROP TRIGGER IF EXISTS set_app_operations_updated_at ON public.app_operations;
CREATE TRIGGER set_app_operations_updated_at
BEFORE UPDATE ON public.app_operations
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

CREATE OR REPLACE FUNCTION public.register_template_app(
    p_actor_user_id UUID,
    p_template_id UUID,
    p_template_revision_id UUID,
    p_app_name TEXT,
    p_app_slug TEXT,
    p_subdomain TEXT,
    p_port INTEGER,
    p_operation_key TEXT
) RETURNS TABLE (registered_app_id UUID, registered_operation_id UUID, reused BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_id UUID;
    v_revision_id UUID;
    v_quotas JSONB;
    v_max_apps INTEGER;
    v_app_count INTEGER;
    v_app_id UUID;
    v_operation_id UUID;
    v_slug TEXT := LOWER(BTRIM(p_app_slug));
    v_name TEXT := BTRIM(p_app_name);
    v_subdomain TEXT;
    v_port INTEGER;
BEGIN
    IF p_operation_key IS NULL OR BTRIM(p_operation_key) = '' OR LENGTH(p_operation_key) > 180 THEN
        RAISE EXCEPTION 'operation key is required' USING ERRCODE = '22023';
    END IF;
    IF v_name = '' OR LENGTH(v_name) > 255 THEN
        RAISE EXCEPTION 'app name is invalid' USING ERRCODE = '22023';
    END IF;
    IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
        RAISE EXCEPTION 'app slug is invalid' USING ERRCODE = '22023';
    END IF;

    SELECT template.customer_id,
           COALESCE(p_template_revision_id, template.published_revision_id),
           customer.quotas
    INTO v_customer_id, v_revision_id, v_quotas
    FROM public.templates template
    JOIN public.customers customer ON customer.id = template.customer_id
    WHERE template.id = p_template_id
      AND template.archived_at IS NULL
      AND customer.status = 'ACTIVE'
    FOR UPDATE OF customer;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'template not found or Customer is inactive' USING ERRCODE = 'P0002';
    END IF;
    IF public.customer_role_rank(public.template_role_of(p_actor_user_id, p_template_id)) < 1 THEN
        RAISE EXCEPTION 'template access denied' USING ERRCODE = '42501';
    END IF;
    IF v_revision_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.template_revisions revision
        WHERE revision.id = v_revision_id AND revision.template_id = p_template_id
    ) THEN
        RAISE EXCEPTION 'published Template revision not found' USING ERRCODE = '23503';
    END IF;

    -- The same owner retry key always resolves to the same App operation.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_customer_id::text || ':' || BTRIM(p_operation_key), 0)
    );
    SELECT operation.app_id, operation.id
    INTO v_app_id, v_operation_id
    FROM public.app_operations operation
    WHERE operation.customer_id = v_customer_id
      AND operation.operation_key = BTRIM(p_operation_key);
    IF FOUND THEN
        RETURN QUERY SELECT v_app_id, v_operation_id, TRUE;
        RETURN;
    END IF;

    v_max_apps := CASE
        WHEN COALESCE(v_quotas->>'maxApps', '') ~ '^[0-9]+$'
        THEN (v_quotas->>'maxApps')::INTEGER
        ELSE 0
    END;
    SELECT COUNT(*)::INTEGER INTO v_app_count
    FROM public.apps app
    JOIN public.templates template ON template.id = app.template_id
    WHERE template.customer_id = v_customer_id;
    IF v_max_apps > 0 AND v_app_count >= v_max_apps THEN
        RAISE EXCEPTION 'Customer App quota exceeded' USING ERRCODE = 'P0001';
    END IF;

    -- Port allocation is global, not per Customer.
    PERFORM pg_advisory_xact_lock(hashtext('template-app-port-allocation'));
    v_port := COALESCE(p_port, public.next_tenant_port());
    IF v_port < 1024 OR v_port > 65535 THEN
        RAISE EXCEPTION 'app port is invalid' USING ERRCODE = '22023';
    END IF;
    v_subdomain := COALESCE(NULLIF(LOWER(BTRIM(p_subdomain)), ''), v_slug || '.localhost');

    INSERT INTO public.apps (
        platform_id, template_id, template_revision_id, owner_user_id,
        app_slug, app_name, port, subdomain, tenant_db_name,
        desired_state, observed_state
    ) VALUES (
        NULL, p_template_id, v_revision_id, p_actor_user_id,
        v_slug, v_name, v_port, v_subdomain,
        'app_db_' || REPLACE(v_slug, '-', '_'), 'STOPPED', 'PROVISIONING'
    ) RETURNING id INTO v_app_id;

    INSERT INTO public.app_domains (app_id, domain, is_primary)
    VALUES (v_app_id, v_subdomain, TRUE);

    INSERT INTO public.app_memberships (user_id, app_id, app_role, granted_by)
    VALUES (p_actor_user_id, v_app_id, 'ADMIN', p_actor_user_id)
    ON CONFLICT (user_id, app_id) DO UPDATE
    SET app_role = 'ADMIN', updated_at = NOW();

    INSERT INTO public.app_operations (
        customer_id, app_id, operation_key, operation_type, status,
        checkpoint, requested_by, started_at
    ) VALUES (
        v_customer_id, v_app_id, BTRIM(p_operation_key), 'PROVISION',
        'RUNNING', 'REGISTERED', p_actor_user_id, NOW()
    ) RETURNING id INTO v_operation_id;

    RETURN QUERY SELECT v_app_id, v_operation_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.register_template_app(UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;

COMMIT;
