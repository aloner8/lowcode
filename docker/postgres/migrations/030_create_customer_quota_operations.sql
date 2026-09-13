-- P6: atomically validate Customer quota edits and reserve runtime capacity.
-- External process start/stop happens after register_app_runtime_operation and
-- completes the durable operation in a separate worker checkpoint.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_customer_quotas(
    p_customer_id UUID,
    p_max_templates INTEGER,
    p_max_apps INTEGER,
    p_max_running_apps INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_template_count INTEGER;
    v_app_count INTEGER;
    v_running_count INTEGER;
    v_quotas JSONB;
BEGIN
    IF p_max_templates IS NULL OR p_max_apps IS NULL OR p_max_running_apps IS NULL
       OR p_max_templates < 0 OR p_max_apps < 0 OR p_max_running_apps < 0 THEN
        RAISE EXCEPTION 'quota values must be zero or greater' USING ERRCODE = '22023';
    END IF;

    -- Shared lock boundary with register_template_app and runtime reservations.
    PERFORM 1 FROM public.customers WHERE id = p_customer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_template_count
    FROM public.templates WHERE customer_id = p_customer_id AND archived_at IS NULL;
    SELECT COUNT(*)::INTEGER INTO v_app_count
    FROM public.apps app
    JOIN public.templates template ON template.id = app.template_id
    WHERE template.customer_id = p_customer_id;
    SELECT COUNT(*)::INTEGER INTO v_running_count
    FROM public.apps app
    JOIN public.templates template ON template.id = app.template_id
    WHERE template.customer_id = p_customer_id
      AND (app.desired_state = 'RUNNING'
           OR app.observed_state IN ('STARTING', 'RUNNING', 'STOPPING'));

    IF p_max_templates > 0 AND v_template_count > p_max_templates THEN
        RAISE EXCEPTION 'Template quota is below current usage (%)', v_template_count USING ERRCODE = 'P0001';
    END IF;
    IF p_max_apps > 0 AND v_app_count > p_max_apps THEN
        RAISE EXCEPTION 'App quota is below current usage (%)', v_app_count USING ERRCODE = 'P0001';
    END IF;
    IF p_max_running_apps > 0 AND v_running_count > p_max_running_apps THEN
        RAISE EXCEPTION 'Running App quota is below current usage (%)', v_running_count USING ERRCODE = 'P0001';
    END IF;

    v_quotas := jsonb_build_object(
        'maxTemplates', p_max_templates,
        'maxApps', p_max_apps,
        'maxRunningApps', p_max_running_apps
    );
    UPDATE public.customers SET quotas = v_quotas WHERE id = p_customer_id;
    RETURN v_quotas;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_app_runtime_operation(
    p_actor_user_id UUID,
    p_app_id UUID,
    p_desired_state TEXT,
    p_operation_key TEXT
) RETURNS TABLE (registered_operation_id UUID, reused BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_id UUID;
    v_template_id UUID;
    v_quotas JSONB;
    v_current_desired TEXT;
    v_observed_state TEXT;
    v_is_suspended BOOLEAN;
    v_max_running INTEGER;
    v_running_count INTEGER;
    v_operation_id UUID;
    v_operation_type TEXT;
BEGIN
    IF p_desired_state NOT IN ('RUNNING', 'STOPPED') THEN
        RAISE EXCEPTION 'desired state must be RUNNING or STOPPED' USING ERRCODE = '22023';
    END IF;
    IF p_operation_key IS NULL OR BTRIM(p_operation_key) = '' OR LENGTH(p_operation_key) > 180 THEN
        RAISE EXCEPTION 'operation key is required' USING ERRCODE = '22023';
    END IF;

    SELECT template.customer_id, template.id, customer.quotas,
           app.desired_state, app.observed_state, app.is_suspended
    INTO v_customer_id, v_template_id, v_quotas,
         v_current_desired, v_observed_state, v_is_suspended
    FROM public.apps app
    JOIN public.templates template ON template.id = app.template_id
    JOIN public.customers customer ON customer.id = template.customer_id
    WHERE app.id = p_app_id AND customer.status = 'ACTIVE'
    FOR UPDATE OF customer, app;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'App not found or Customer is inactive' USING ERRCODE = 'P0002';
    END IF;
    IF public.customer_role_rank(public.template_role_of(p_actor_user_id, v_template_id)) < 1 THEN
        RAISE EXCEPTION 'App access denied' USING ERRCODE = '42501';
    END IF;

    SELECT operation.id INTO v_operation_id
    FROM public.app_operations operation
    WHERE operation.customer_id = v_customer_id
      AND operation.operation_key = BTRIM(p_operation_key);
    IF FOUND THEN
        RETURN QUERY SELECT v_operation_id, TRUE;
        RETURN;
    END IF;

    IF p_desired_state = 'RUNNING' THEN
        IF v_is_suspended THEN
            RAISE EXCEPTION 'App is suspended' USING ERRCODE = 'P0001';
        END IF;
        v_max_running := CASE
            WHEN COALESCE(v_quotas->>'maxRunningApps', '') ~ '^[0-9]+$'
            THEN (v_quotas->>'maxRunningApps')::INTEGER ELSE 0
        END;
        SELECT COUNT(*)::INTEGER INTO v_running_count
        FROM public.apps app
        JOIN public.templates template ON template.id = app.template_id
        WHERE template.customer_id = v_customer_id
          AND app.id <> p_app_id
          AND (app.desired_state = 'RUNNING'
               OR app.observed_state IN ('STARTING', 'RUNNING', 'STOPPING'));
        IF v_max_running > 0 AND v_current_desired <> 'RUNNING' AND v_running_count >= v_max_running THEN
            RAISE EXCEPTION 'Customer running App quota exceeded' USING ERRCODE = 'P0001';
        END IF;
        v_operation_type := 'START';
    ELSE
        v_operation_type := 'STOP';
    END IF;

    UPDATE public.apps
    SET desired_state = p_desired_state,
        observed_state = CASE
          WHEN p_desired_state = 'RUNNING' AND observed_state <> 'RUNNING' THEN 'STARTING'
          WHEN p_desired_state = 'STOPPED' AND observed_state NOT IN ('STOPPED', 'UNPROVISIONED') THEN 'STOPPING'
          ELSE observed_state
        END,
        runtime_error_detail = NULL
    WHERE id = p_app_id;

    INSERT INTO public.app_operations (
        customer_id, app_id, operation_key, operation_type,
        status, checkpoint, requested_by, started_at
    ) VALUES (
        v_customer_id, p_app_id, BTRIM(p_operation_key), v_operation_type,
        'RUNNING', 'REGISTERED', p_actor_user_id, NOW()
    ) RETURNING id INTO v_operation_id;

    RETURN QUERY SELECT v_operation_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_quotas(UUID, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_app_runtime_operation(UUID, UUID, TEXT, TEXT) FROM PUBLIC;

COMMIT;
