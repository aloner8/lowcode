-- P1 foundation: Customer ownership, Template/Object registry, optimistic
-- editing, immutable revisions and authoritative Screen -> Page relations.
-- This migration is additive. Legacy Platform/App rows are not rewritten.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_slug VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    primary_domain VARCHAR(255),
    quotas JSONB NOT NULL DEFAULT '{"maxTemplates":10,"maxApps":10,"maxRunningApps":3}'::jsonb,
    created_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customers_slug_not_blank CHECK (BTRIM(customer_slug) <> ''),
    CONSTRAINT customers_name_not_blank CHECK (BTRIM(customer_name) <> ''),
    CONSTRAINT customers_slug_format CHECK (customer_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT customers_quotas_object CHECK (jsonb_typeof(quotas) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_slug_ci_key
    ON public.customers (LOWER(BTRIM(customer_slug)));

DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    customer_role VARCHAR(20) NOT NULL
        CHECK (customer_role IN ('OWNER', 'EDITOR', 'VIEWER')),
    granted_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customer_memberships_unique UNIQUE (customer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_memberships_user
    ON public.customer_memberships (user_id, customer_id);

DROP TRIGGER IF EXISTS set_customer_memberships_updated_at ON public.customer_memberships;
CREATE TRIGGER set_customer_memberships_updated_at
BEFORE UPDATE ON public.customer_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

CREATE TABLE IF NOT EXISTS public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    template_slug VARCHAR(100) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    edit_version BIGINT NOT NULL DEFAULT 1 CHECK (edit_version > 0),
    legacy_platform_id UUID UNIQUE REFERENCES public.platforms(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT templates_slug_not_blank CHECK (BTRIM(template_slug) <> ''),
    CONSTRAINT templates_name_not_blank CHECK (BTRIM(template_name) <> ''),
    CONSTRAINT templates_slug_format CHECK (template_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT templates_customer_slug_unique UNIQUE (customer_id, template_slug)
);

CREATE INDEX IF NOT EXISTS idx_templates_customer_updated
    ON public.templates (customer_id, updated_at DESC);

DROP TRIGGER IF EXISTS set_templates_updated_at ON public.templates;
CREATE TRIGGER set_templates_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

CREATE TABLE IF NOT EXISTS public.template_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    object_type VARCHAR(30) NOT NULL CHECK (object_type IN (
        'STARTUP', 'MODULE', 'ROUTE', 'SCREEN', 'PAGE', 'COMPONENT',
        'COMPONENT_INSTANCE', 'COLLECTION', 'MENU', 'POPUP'
    )),
    object_key VARCHAR(180) NOT NULL,
    object_name VARCHAR(255) NOT NULL,
    edit_version BIGINT NOT NULL DEFAULT 1 CHECK (edit_version > 0),
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT template_objects_key_not_blank CHECK (BTRIM(object_key) <> ''),
    CONSTRAINT template_objects_name_not_blank CHECK (BTRIM(object_name) <> ''),
    CONSTRAINT template_objects_definition_object CHECK (jsonb_typeof(definition) = 'object'),
    CONSTRAINT template_objects_template_type_key_unique
        UNIQUE (template_id, object_type, object_key),
    CONSTRAINT template_objects_template_id_id_unique UNIQUE (template_id, id)
);

CREATE INDEX IF NOT EXISTS idx_template_objects_template_type
    ON public.template_objects (template_id, object_type, updated_at DESC);

DROP TRIGGER IF EXISTS set_template_objects_updated_at ON public.template_objects;
CREATE TRIGGER set_template_objects_updated_at
BEFORE UPDATE ON public.template_objects
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

CREATE TABLE IF NOT EXISTS public.template_screen_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    screen_object_id UUID NOT NULL,
    page_object_id UUID NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT template_screen_pages_pair_unique
        UNIQUE (template_id, screen_object_id, page_object_id),
    CONSTRAINT template_screen_pages_screen_fk
        FOREIGN KEY (template_id, screen_object_id)
        REFERENCES public.template_objects(template_id, id) ON DELETE CASCADE,
    CONSTRAINT template_screen_pages_page_fk
        FOREIGN KEY (template_id, page_object_id)
        REFERENCES public.template_objects(template_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_screen_pages_order
    ON public.template_screen_pages (template_id, screen_object_id, sort_order, id);

CREATE UNIQUE INDEX IF NOT EXISTS template_screen_pages_one_default
    ON public.template_screen_pages (template_id, screen_object_id)
    WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS public.template_object_dependencies (
    template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    source_object_id UUID NOT NULL,
    target_object_id UUID NOT NULL,
    dependency_kind VARCHAR(50) NOT NULL,
    json_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (template_id, source_object_id, target_object_id, dependency_kind, json_path),
    CONSTRAINT template_object_dependencies_source_fk
        FOREIGN KEY (template_id, source_object_id)
        REFERENCES public.template_objects(template_id, id) ON DELETE CASCADE,
    CONSTRAINT template_object_dependencies_target_fk
        FOREIGN KEY (template_id, target_object_id)
        REFERENCES public.template_objects(template_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.template_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE RESTRICT,
    revision_number BIGINT NOT NULL CHECK (revision_number > 0),
    revision_digest CHAR(64) NOT NULL CHECK (revision_digest ~ '^[0-9a-f]{64}$'),
    schema_version VARCHAR(30) NOT NULL,
    source_edit_version BIGINT NOT NULL CHECK (source_edit_version > 0),
    compiled_definition JSONB NOT NULL,
    published_by UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT template_revisions_definition_object
        CHECK (jsonb_typeof(compiled_definition) = 'object'),
    CONSTRAINT template_revisions_number_unique UNIQUE (template_id, revision_number),
    CONSTRAINT template_revisions_digest_unique UNIQUE (template_id, revision_digest),
    CONSTRAINT template_revisions_template_id_id_unique UNIQUE (template_id, id)
);

ALTER TABLE public.templates
    ADD COLUMN IF NOT EXISTS published_revision_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'templates_published_revision_fk'
          AND conrelid = 'public.templates'::regclass
    ) THEN
        ALTER TABLE public.templates
            ADD CONSTRAINT templates_published_revision_fk
            FOREIGN KEY (id, published_revision_id)
            REFERENCES public.template_revisions(template_id, id) ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE public.apps
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.templates(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS template_revision_id UUID REFERENCES public.template_revisions(id) ON DELETE RESTRICT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'apps_template_revision_pair_fk'
          AND conrelid = 'public.apps'::regclass
    ) THEN
        ALTER TABLE public.apps
            ADD CONSTRAINT apps_template_revision_pair_fk
            FOREIGN KEY (template_id, template_revision_id)
            REFERENCES public.template_revisions(template_id, id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'apps_template_revision_pair_check'
          AND conrelid = 'public.apps'::regclass
    ) THEN
        ALTER TABLE public.apps
            ADD CONSTRAINT apps_template_revision_pair_check
            CHECK ((template_id IS NULL) = (template_revision_id IS NULL));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.customer_role_rank(p_role TEXT)
RETURNS INT
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE p_role
        WHEN 'GOD' THEN 3
        WHEN 'OWNER' THEN 2
        WHEN 'EDITOR' THEN 1
        WHEN 'VIEWER' THEN 0
        ELSE -1
    END;
$$;

CREATE OR REPLACE FUNCTION public.template_role_of(p_user_id UUID, p_template_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM public.platform_users user_account
            WHERE user_account.id = p_user_id
              AND user_account.is_active = TRUE
              AND user_account.global_role = 'GOD'
        ) THEN 'GOD'
        ELSE (
            SELECT membership.customer_role
            FROM public.templates template
            JOIN public.customers customer ON customer.id = template.customer_id
            JOIN public.customer_memberships membership
              ON membership.customer_id = customer.id
             AND membership.user_id = p_user_id
            JOIN public.platform_users user_account
              ON user_account.id = membership.user_id
             AND user_account.is_active = TRUE
            WHERE template.id = p_template_id
              AND template.archived_at IS NULL
              AND customer.status = 'ACTIVE'
        )
    END;
$$;

CREATE OR REPLACE FUNCTION public.validate_template_screen_page_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_screen_type TEXT;
    v_page_type TEXT;
BEGIN
    SELECT object_type INTO v_screen_type
    FROM public.template_objects
    WHERE template_id = NEW.template_id AND id = NEW.screen_object_id;

    SELECT object_type INTO v_page_type
    FROM public.template_objects
    WHERE template_id = NEW.template_id AND id = NEW.page_object_id;

    IF v_screen_type IS DISTINCT FROM 'SCREEN' THEN
        RAISE EXCEPTION 'screen_object_id must reference a SCREEN'
            USING ERRCODE = '23514';
    END IF;
    IF v_page_type IS DISTINCT FROM 'PAGE' THEN
        RAISE EXCEPTION 'page_object_id must reference a PAGE'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_template_screen_page_types
    ON public.template_screen_pages;
CREATE TRIGGER validate_template_screen_page_types
BEFORE INSERT OR UPDATE ON public.template_screen_pages
FOR EACH ROW EXECUTE FUNCTION public.validate_template_screen_page_types();

CREATE OR REPLACE FUNCTION public.save_template_object(
    p_actor_user_id UUID,
    p_template_id UUID,
    p_object_id UUID,
    p_object_type TEXT,
    p_object_key TEXT,
    p_object_name TEXT,
    p_definition JSONB,
    p_expected_edit_version BIGINT
) RETURNS public.template_objects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_saved public.template_objects%ROWTYPE;
BEGIN
    IF public.customer_role_rank(public.template_role_of(p_actor_user_id, p_template_id)) < 1 THEN
        RAISE EXCEPTION 'template access denied' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_definition) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'definition must be a JSON object' USING ERRCODE = '22023';
    END IF;

    -- Serialize changes per Template so its edit_version is monotonic.
    PERFORM 1 FROM public.templates WHERE id = p_template_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'template not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_object_id IS NULL THEN
        IF p_expected_edit_version <> 0 THEN
            RAISE EXCEPTION 'new object expected_edit_version must be 0'
                USING ERRCODE = '40001';
        END IF;
        INSERT INTO public.template_objects (
            template_id, object_type, object_key, object_name, definition,
            created_by, updated_by
        ) VALUES (
            p_template_id, p_object_type, BTRIM(p_object_key),
            BTRIM(p_object_name), p_definition, p_actor_user_id, p_actor_user_id
        ) RETURNING * INTO v_saved;
    ELSE
        UPDATE public.template_objects
        SET object_key = BTRIM(p_object_key),
            object_name = BTRIM(p_object_name),
            definition = p_definition,
            edit_version = edit_version + 1,
            updated_by = p_actor_user_id
        WHERE id = p_object_id
          AND template_id = p_template_id
          AND object_type = p_object_type
          AND edit_version = p_expected_edit_version
        RETURNING * INTO v_saved;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'template object edit conflict'
                USING ERRCODE = '40001';
        END IF;
    END IF;

    UPDATE public.templates
    SET edit_version = edit_version + 1, updated_by = p_actor_user_id
    WHERE id = p_template_id;

    RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_template_revision_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'template revisions are immutable' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS template_revisions_immutable ON public.template_revisions;
CREATE TRIGGER template_revisions_immutable
BEFORE UPDATE OR DELETE ON public.template_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_template_revision_mutation();

REVOKE ALL ON FUNCTION public.template_role_of(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_template_object(UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB, BIGINT) FROM PUBLIC;

CREATE OR REPLACE VIEW public.template_screens AS
SELECT * FROM public.template_objects WHERE object_type = 'SCREEN';

CREATE OR REPLACE VIEW public.template_pages AS
SELECT * FROM public.template_objects WHERE object_type = 'PAGE';

CREATE OR REPLACE VIEW public.template_components AS
SELECT * FROM public.template_objects WHERE object_type = 'COMPONENT';

COMMIT;
