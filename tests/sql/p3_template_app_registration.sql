\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.platform_users (
    id, username, email, password_hash, global_role, is_active
) VALUES
    ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'p3-customer-a',
     'p3-customer-a@example.invalid', crypt(gen_random_uuid()::text, gen_salt('bf')),
     'TENANT_USER', TRUE),
    ('cccccccc-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'p3-customer-b',
     'p3-customer-b@example.invalid', crypt(gen_random_uuid()::text, gen_salt('bf')),
     'TENANT_USER', TRUE);

INSERT INTO public.customers (id, customer_slug, customer_name, quotas) VALUES
    ('cccccccc-0000-4000-8000-000000000000', 'p3-customer-a', 'P3 Customer A',
     '{"maxTemplates":10,"maxApps":1,"maxRunningApps":1}'::jsonb),
    ('dddddddd-0000-4000-8000-000000000000', 'p3-customer-b', 'P3 Customer B',
     '{"maxTemplates":10,"maxApps":1,"maxRunningApps":1}'::jsonb);

INSERT INTO public.customer_memberships (customer_id, user_id, customer_role) VALUES
    ('cccccccc-0000-4000-8000-000000000000',
     'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'OWNER'),
    ('dddddddd-0000-4000-8000-000000000000',
     'cccccccc-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'OWNER');

INSERT INTO public.templates (
    id, customer_id, template_slug, template_name
) VALUES (
    'cccccccc-1000-4000-8000-000000000000',
    'cccccccc-0000-4000-8000-000000000000',
    'contacts', 'Contacts'
);

INSERT INTO public.template_revisions (
    id, template_id, revision_number, revision_digest,
    schema_version, source_edit_version, compiled_definition
) VALUES (
    'cccccccc-2000-4000-8000-000000000000',
    'cccccccc-1000-4000-8000-000000000000',
    1, repeat('c', 64), '1.0.0', 1, '{}'::jsonb
);

UPDATE public.templates
SET published_revision_id = 'cccccccc-2000-4000-8000-000000000000'
WHERE id = 'cccccccc-1000-4000-8000-000000000000';

DO $$
DECLARE
    v_first RECORD;
    v_retry RECORD;
    v_count INTEGER;
BEGIN
    SELECT * INTO v_first FROM public.register_template_app(
        'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'cccccccc-1000-4000-8000-000000000000',
        NULL, 'Contacts A', 'p3-contacts-a', NULL, NULL, 'request-1'
    );
    IF v_first.reused OR v_first.registered_app_id IS NULL THEN
        RAISE EXCEPTION 'first registration did not create an App';
    END IF;

    SELECT * INTO v_retry FROM public.register_template_app(
        'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'cccccccc-1000-4000-8000-000000000000',
        NULL, 'Ignored retry name', 'ignored-retry-slug', NULL, NULL, 'request-1'
    );
    IF NOT v_retry.reused OR v_retry.registered_app_id <> v_first.registered_app_id
       OR v_retry.registered_operation_id <> v_first.registered_operation_id THEN
        RAISE EXCEPTION 'same operation key did not return the original App';
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.apps app
    JOIN public.templates template ON template.id = app.template_id
    WHERE template.customer_id = 'cccccccc-0000-4000-8000-000000000000';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'idempotent retry created % Apps', v_count;
    END IF;

    BEGIN
        PERFORM public.register_template_app(
            'cccccccc-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            'cccccccc-1000-4000-8000-000000000000',
            NULL, 'Denied', 'p3-denied', NULL, NULL, 'denied-request'
        );
        RAISE EXCEPTION 'cross-Customer registration unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    BEGIN
        PERFORM public.register_template_app(
            'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'cccccccc-1000-4000-8000-000000000000',
            NULL, 'Over quota', 'p3-over-quota', NULL, NULL, 'request-2'
        );
        RAISE EXCEPTION 'App quota unexpectedly allowed another App';
    EXCEPTION WHEN raise_exception THEN
        NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM public.apps app
        WHERE app.id = v_first.registered_app_id
          AND app.template_revision_id = 'cccccccc-2000-4000-8000-000000000000'
          AND app.observed_state = 'PROVISIONING'
          AND app.desired_state = 'STOPPED'
    ) THEN
        RAISE EXCEPTION 'registered App state/revision is incorrect';
    END IF;
END $$;

ROLLBACK;

SELECT 'p3_template_app_registration_ok' AS result;
