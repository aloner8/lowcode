\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.platform_users (
    id, username, email, password_hash, global_role, is_active
) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'customer-a-user',
     'customer-a@example.invalid', crypt(gen_random_uuid()::text, gen_salt('bf')),
     'TENANT_USER', TRUE),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'customer-b-user',
     'customer-b@example.invalid', crypt(gen_random_uuid()::text, gen_salt('bf')),
     'TENANT_USER', TRUE);

INSERT INTO public.customers (id, customer_slug, customer_name) VALUES
    ('aaaaaaaa-0000-4000-8000-000000000000', 'customer-a', 'Customer A'),
    ('bbbbbbbb-0000-4000-8000-000000000000', 'customer-b', 'Customer B');

INSERT INTO public.customer_memberships (customer_id, user_id, customer_role) VALUES
    ('aaaaaaaa-0000-4000-8000-000000000000',
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'OWNER'),
    ('bbbbbbbb-0000-4000-8000-000000000000',
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'OWNER');

INSERT INTO public.templates (
    id, customer_id, template_slug, template_name
) VALUES
    ('aaaaaaaa-1000-4000-8000-000000000000',
     'aaaaaaaa-0000-4000-8000-000000000000', 'contacts', 'Contacts A'),
    ('bbbbbbbb-1000-4000-8000-000000000000',
     'bbbbbbbb-0000-4000-8000-000000000000', 'contacts', 'Contacts B');

DO $$
DECLARE
    v_object_id UUID;
    v_screen_id UUID;
    v_page_id UUID;
BEGIN
    IF public.template_role_of(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-1000-4000-8000-000000000000'
    ) IS DISTINCT FROM 'OWNER' THEN
        RAISE EXCEPTION 'Customer A did not resolve as OWNER of Template A';
    END IF;

    IF public.template_role_of(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-1000-4000-8000-000000000000'
    ) IS NOT NULL THEN
        RAISE EXCEPTION 'Customer A unexpectedly resolved a role on Template B';
    END IF;

    BEGIN
        PERFORM public.save_template_object(
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'bbbbbbbb-1000-4000-8000-000000000000',
            NULL, 'PAGE', 'page.denied', 'Denied', '{}'::jsonb, 0
        );
        RAISE EXCEPTION 'Cross-Customer write unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    SELECT (public.save_template_object(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-1000-4000-8000-000000000000',
        NULL, 'PAGE', 'page.home', 'Home', '{}'::jsonb, 0
    )).id INTO v_object_id;

    PERFORM public.save_template_object(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-1000-4000-8000-000000000000',
        v_object_id, 'PAGE', 'page.home', 'Home 2', '{}'::jsonb, 1
    );

    BEGIN
        PERFORM public.save_template_object(
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'aaaaaaaa-1000-4000-8000-000000000000',
            v_object_id, 'PAGE', 'page.home', 'Stale write', '{}'::jsonb, 1
        );
        RAISE EXCEPTION 'Stale edit unexpectedly succeeded';
    EXCEPTION WHEN serialization_failure THEN
        NULL;
    END;

    SELECT (public.save_template_object(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-1000-4000-8000-000000000000',
        NULL, 'SCREEN', 'screen.main', 'Main', '{}'::jsonb, 0
    )).id INTO v_screen_id;

    SELECT (public.save_template_object(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-1000-4000-8000-000000000000',
        NULL, 'PAGE', 'page.second', 'Second', '{}'::jsonb, 0
    )).id INTO v_page_id;

    INSERT INTO public.template_screen_pages (
        template_id, screen_object_id, page_object_id, sort_order, is_default
    ) VALUES (
        'aaaaaaaa-1000-4000-8000-000000000000',
        v_screen_id, v_page_id, 0, TRUE
    );

    BEGIN
        INSERT INTO public.template_screen_pages (
            template_id, screen_object_id, page_object_id, sort_order
        ) VALUES (
            'aaaaaaaa-1000-4000-8000-000000000000',
            v_page_id, v_screen_id, 1
        );
        RAISE EXCEPTION 'Screen/Page type inversion unexpectedly succeeded';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END $$;

INSERT INTO public.template_revisions (
    id, template_id, revision_number, revision_digest,
    schema_version, source_edit_version, compiled_definition
) VALUES (
    'aaaaaaaa-2000-4000-8000-000000000000',
    'aaaaaaaa-1000-4000-8000-000000000000',
    1, repeat('a', 64), '1.0.0', 5, '{}'::jsonb
);

DO $$
BEGIN
    BEGIN
        UPDATE public.template_revisions
        SET compiled_definition = '{"changed":true}'::jsonb
        WHERE id = 'aaaaaaaa-2000-4000-8000-000000000000';
        RAISE EXCEPTION 'Immutable revision unexpectedly changed';
    EXCEPTION WHEN SQLSTATE '55000' THEN
        NULL;
    END;
END $$;

ROLLBACK;

SELECT 'p1_template_registry_acceptance_ok' AS result;
