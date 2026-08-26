-- Platform Master blueprint structures (CreatePlatform.MD §4–§8).
-- Adds First Public Page mode, module/page/workflow registries, a platform-scoped
-- audit table and the transactional create_platform_blueprint() procedure.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. First Public Page mode -------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'first_public_page_mode') THEN
        CREATE TYPE public.first_public_page_mode AS ENUM (
            'PUBLIC_HOME',
            'PUBLIC_HOME_WITH_LOGIN',
            'LOGIN_PAGE'
        );
    END IF;
END $$;

ALTER TABLE public.platforms
    ADD COLUMN IF NOT EXISTS first_public_page public.first_public_page_mode
    NOT NULL DEFAULT 'PUBLIC_HOME_WITH_LOGIN';

-- 2. Module registry --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    module_code VARCHAR(100) NOT NULL,
    module_name VARCHAR(255) NOT NULL,
    module_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_modules_unique UNIQUE (platform_id, module_code),
    CONSTRAINT platform_modules_code_valid CHECK (
        module_code IN ('PAGES', 'AUTH', 'FLOW', 'STYLE', 'FORM', 'SERVICE', 'EVENT', 'REPORT')
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_modules_platform
    ON public.platform_modules (platform_id, module_order);

-- 3. Page registry ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    page_slug VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('PUBLIC', 'PRIVATE')),
    is_entry_page BOOLEAN NOT NULL DEFAULT FALSE,
    component_tree JSONB NOT NULL DEFAULT '[]'::jsonb,
    page_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_pages_unique UNIQUE (platform_id, page_slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_platform_entry_page
    ON public.platform_pages (platform_id)
    WHERE is_entry_page = TRUE;

-- 4. Workflow registry ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    flow_code VARCHAR(100) NOT NULL,
    flow_name VARCHAR(255) NOT NULL,
    flow_type VARCHAR(50) NOT NULL
        CHECK (flow_type IN ('ENTERPRISE', 'SEQUENCE', 'APP_MANIFEST', 'PAGE')),
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_workflows_unique UNIQUE (platform_id, flow_code)
);

-- 5. Platform-scoped audit log ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID REFERENCES public.platforms(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL DEFAULT 'PLATFORM',
    entity_id UUID,
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(255) NOT NULL DEFAULT 'system',
    changes_summary TEXT NOT NULL,
    snapshot_before JSONB,
    snapshot_after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_platform
    ON public.platform_audit_logs (platform_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created
    ON public.platform_audit_logs (created_at DESC);

-- 6. Shared updated_at triggers --------------------------------------------
DROP TRIGGER IF EXISTS set_platform_modules_updated_at ON public.platform_modules;
CREATE TRIGGER set_platform_modules_updated_at
BEFORE UPDATE ON public.platform_modules
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

DROP TRIGGER IF EXISTS set_platform_pages_updated_at ON public.platform_pages;
CREATE TRIGGER set_platform_pages_updated_at
BEFORE UPDATE ON public.platform_pages
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

DROP TRIGGER IF EXISTS set_platform_workflows_updated_at ON public.platform_workflows;
CREATE TRIGGER set_platform_workflows_updated_at
BEFORE UPDATE ON public.platform_workflows
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

-- 7. Component tree templates ----------------------------------------------
CREATE OR REPLACE FUNCTION public.blueprint_home_tree(p_platform_name TEXT, p_with_login BOOLEAN)
RETURNS JSONB
LANGUAGE sql IMMUTABLE
AS $$
    SELECT jsonb_build_array(
        jsonb_build_object(
            'id', 'home_nav',
            'type', 'NavMenuComponent',
            'props', jsonb_build_object(
                'brandName', p_platform_name,
                'items', CASE WHEN p_with_login
                    THEN jsonb_build_array(
                        jsonb_build_object('label', 'หน้าหลัก', 'href', '/home', 'active', TRUE),
                        jsonb_build_object('label', 'เข้าสู่ระบบ', 'href', '/login'))
                    ELSE jsonb_build_array(
                        jsonb_build_object('label', 'หน้าหลัก', 'href', '/home', 'active', TRUE))
                END
            )
        ),
        jsonb_build_object(
            'id', 'home_hero',
            'type', 'DynamicHtmlComponent',
            'props', jsonb_build_object(
                'content',
                '<section class="py-5 text-center"><h1 class="fw-bold mb-2">' || p_platform_name ||
                '</h1><p class="text-muted mb-0">หน้าสาธารณะเริ่มต้นของ Platform</p></section>'
            )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.blueprint_login_tree(p_platform_name TEXT)
RETURNS JSONB
LANGUAGE sql IMMUTABLE
AS $$
    SELECT jsonb_build_array(
        jsonb_build_object(
            'id', 'login_form',
            'type', 'FormComponent',
            'actionTriggerId', 'auth.login',
            'props', jsonb_build_object(
                'title', 'เข้าสู่ระบบ ' || p_platform_name,
                'submitText', 'เข้าสู่ระบบ',
                'fields', jsonb_build_array(
                    jsonb_build_object('name', 'identifier', 'label', 'ชื่อผู้ใช้หรืออีเมล', 'required', TRUE),
                    jsonb_build_object('name', 'password', 'label', 'รหัสผ่าน', 'type', 'password', 'required', TRUE)
                )
            )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.blueprint_dashboard_tree()
RETURNS JSONB
LANGUAGE sql IMMUTABLE
AS $$
    SELECT jsonb_build_array(
        jsonb_build_object(
            'id', 'dashboard_menu',
            'type', 'SlideMenuComponent',
            'props', jsonb_build_object(
                'title', 'เมนูระบบ',
                'items', jsonb_build_array(
                    jsonb_build_object('id', 'dashboard', 'label', 'ภาพรวม', 'active', TRUE))
            )
        ),
        jsonb_build_object(
            'id', 'dashboard_card',
            'type', 'CardComponent',
            'props', jsonb_build_object('title', 'ยินดีต้อนรับ', 'value', '-', 'variant', 'primary')
        )
    );
$$;

-- 8. Flow AST templates -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.blueprint_flow_nodes(p_mode public.first_public_page_mode)
RETURNS JSONB
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE p_mode
        WHEN 'PUBLIC_HOME' THEN jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 0, 'y', 0),
                'data', jsonb_build_object('label', 'Start Entry', 'nodeType', 'start')),
            jsonb_build_object('id', 'public_home', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 240, 'y', 0),
                'data', jsonb_build_object('label', 'Public Home', 'nodeType', 'sub_flow', 'category', 'page', 'actionTarget', 'home')),
            jsonb_build_object('id', 'event_loop', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 480, 'y', 0),
                'data', jsonb_build_object('label', 'Event Loop', 'nodeType', 'event_listener')),
            jsonb_build_object('id', 'close', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 720, 'y', 0),
                'data', jsonb_build_object('label', 'Close', 'nodeType', 'close'))
        )
        WHEN 'PUBLIC_HOME_WITH_LOGIN' THEN jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 0, 'y', 0),
                'data', jsonb_build_object('label', 'Start Entry', 'nodeType', 'start')),
            jsonb_build_object('id', 'public_home', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 220, 'y', 0),
                'data', jsonb_build_object('label', 'Public Home', 'nodeType', 'sub_flow', 'category', 'page', 'actionTarget', 'home')),
            jsonb_build_object('id', 'login_action', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 440, 'y', 0),
                'data', jsonb_build_object('label', 'Login Action', 'nodeType', 'sub_flow', 'category', 'action', 'triggerEvent', 'auth.login')),
            jsonb_build_object('id', 'auth_check', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 660, 'y', 0),
                'data', jsonb_build_object('label', 'Auth Check', 'nodeType', 'auth_check')),
            jsonb_build_object('id', 'route_guard', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 880, 'y', 0),
                'data', jsonb_build_object('label', 'Private/Public Router', 'nodeType', 'route_guard')),
            jsonb_build_object('id', 'event_loop', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 1100, 'y', 0),
                'data', jsonb_build_object('label', 'Event Loop', 'nodeType', 'event_listener')),
            jsonb_build_object('id', 'close', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 1320, 'y', 0),
                'data', jsonb_build_object('label', 'Close', 'nodeType', 'close'))
        )
        ELSE jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 0, 'y', 0),
                'data', jsonb_build_object('label', 'Start Entry', 'nodeType', 'start')),
            jsonb_build_object('id', 'auth_check', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 240, 'y', 0),
                'data', jsonb_build_object('label', 'Auth Check', 'nodeType', 'auth_check')),
            jsonb_build_object('id', 'route_guard', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 480, 'y', 0),
                'data', jsonb_build_object('label', 'Login/Private Router', 'nodeType', 'route_guard')),
            jsonb_build_object('id', 'event_loop', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 720, 'y', 0),
                'data', jsonb_build_object('label', 'Event Loop', 'nodeType', 'event_listener')),
            jsonb_build_object('id', 'close', 'type', 'enterpriseNode', 'position', jsonb_build_object('x', 960, 'y', 0),
                'data', jsonb_build_object('label', 'Close', 'nodeType', 'close'))
        )
    END;
$$;

CREATE OR REPLACE FUNCTION public.blueprint_flow_edges(p_mode public.first_public_page_mode)
RETURNS JSONB
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE p_mode
        WHEN 'PUBLIC_HOME' THEN jsonb_build_array(
            jsonb_build_object('id', 'e1', 'source', 'start', 'target', 'public_home'),
            jsonb_build_object('id', 'e2', 'source', 'public_home', 'target', 'event_loop'),
            jsonb_build_object('id', 'e3', 'source', 'event_loop', 'target', 'close')
        )
        WHEN 'PUBLIC_HOME_WITH_LOGIN' THEN jsonb_build_array(
            jsonb_build_object('id', 'e1', 'source', 'start', 'target', 'public_home'),
            jsonb_build_object('id', 'e2', 'source', 'public_home', 'target', 'login_action'),
            jsonb_build_object('id', 'e3', 'source', 'login_action', 'target', 'auth_check'),
            jsonb_build_object('id', 'e4', 'source', 'auth_check', 'target', 'route_guard'),
            jsonb_build_object('id', 'e5', 'source', 'route_guard', 'target', 'event_loop'),
            jsonb_build_object('id', 'e6', 'source', 'event_loop', 'target', 'close')
        )
        ELSE jsonb_build_array(
            jsonb_build_object('id', 'e1', 'source', 'start', 'target', 'auth_check'),
            jsonb_build_object('id', 'e2', 'source', 'auth_check', 'target', 'route_guard'),
            jsonb_build_object('id', 'e3', 'source', 'route_guard', 'target', 'event_loop'),
            jsonb_build_object('id', 'e4', 'source', 'event_loop', 'target', 'close')
        )
    END;
$$;

-- 9. Transactional blueprint creator ---------------------------------------
CREATE OR REPLACE FUNCTION public.create_platform_blueprint(
    p_platform_name TEXT,
    p_platform_slug TEXT,
    p_category_id UUID,
    p_first_public_page public.first_public_page_mode,
    p_description TEXT DEFAULT NULL,
    p_performed_by TEXT DEFAULT 'system'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_platform_id UUID;
    v_slug TEXT := LOWER(BTRIM(p_platform_slug));
    v_name TEXT := BTRIM(p_platform_name);
    v_needs_auth BOOLEAN := p_first_public_page <> 'PUBLIC_HOME';
    v_module TEXT;
    v_order INT := 0;
    v_modules TEXT[] := ARRAY['PAGES', 'FLOW', 'STYLE', 'FORM', 'SERVICE', 'EVENT', 'REPORT'];
BEGIN
    IF v_name = '' THEN
        RAISE EXCEPTION 'platform_name must not be empty' USING ERRCODE = '22023';
    END IF;
    IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
        RAISE EXCEPTION 'platform_slug must match ^[a-z0-9]+(-[a-z0-9]+)*$' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.platforms WHERE platform_slug = v_slug) THEN
        RAISE EXCEPTION 'platform_slug "%" already exists', v_slug USING ERRCODE = '23505';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.platform_categories WHERE id = p_category_id AND is_active) THEN
        RAISE EXCEPTION 'category not found or inactive' USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.platforms (platform_slug, platform_name, description, category_id, first_public_page)
    VALUES (v_slug, v_name, NULLIF(BTRIM(COALESCE(p_description, '')), ''), p_category_id, p_first_public_page)
    RETURNING id INTO v_platform_id;

    IF v_needs_auth THEN
        v_modules := v_modules || 'AUTH';
    END IF;

    FOREACH v_module IN ARRAY v_modules LOOP
        v_order := v_order + 1;
        INSERT INTO public.platform_modules (platform_id, module_code, module_name, module_order)
        VALUES (v_platform_id, v_module, INITCAP(REPLACE(v_module, '_', ' ')), v_order);
    END LOOP;

    IF p_first_public_page = 'LOGIN_PAGE' THEN
        INSERT INTO public.platform_pages (platform_id, page_slug, title, access_level, is_entry_page, component_tree)
        VALUES (v_platform_id, 'login', 'เข้าสู่ระบบ', 'PUBLIC', TRUE, public.blueprint_login_tree(v_name));
        INSERT INTO public.platform_pages (platform_id, page_slug, title, access_level, component_tree)
        VALUES (v_platform_id, 'dashboard', 'แดชบอร์ด', 'PRIVATE', public.blueprint_dashboard_tree());
    ELSIF p_first_public_page = 'PUBLIC_HOME_WITH_LOGIN' THEN
        INSERT INTO public.platform_pages (platform_id, page_slug, title, access_level, is_entry_page, component_tree)
        VALUES (v_platform_id, 'home', 'หน้าหลัก', 'PUBLIC', TRUE, public.blueprint_home_tree(v_name, TRUE));
        INSERT INTO public.platform_pages (platform_id, page_slug, title, access_level, component_tree)
        VALUES (v_platform_id, 'login', 'เข้าสู่ระบบ', 'PUBLIC', public.blueprint_login_tree(v_name));
        INSERT INTO public.platform_pages (platform_id, page_slug, title, access_level, component_tree)
        VALUES (v_platform_id, 'dashboard', 'แดชบอร์ด', 'PRIVATE', public.blueprint_dashboard_tree());
    ELSE
        INSERT INTO public.platform_pages (platform_id, page_slug, title, access_level, is_entry_page, component_tree)
        VALUES (v_platform_id, 'home', 'หน้าหลัก', 'PUBLIC', TRUE, public.blueprint_home_tree(v_name, FALSE));
    END IF;

    INSERT INTO public.platform_workflows (platform_id, flow_code, flow_name, flow_type, nodes, edges, config)
    VALUES (
        v_platform_id,
        'MASTER_ENTRY',
        'Enterprise Master Lifecycle',
        'ENTERPRISE',
        public.blueprint_flow_nodes(p_first_public_page),
        public.blueprint_flow_edges(p_first_public_page),
        jsonb_build_object('firstPublicPage', p_first_public_page::text, 'requiresAuth', v_needs_auth)
    );

    INSERT INTO public.platform_audit_logs
        (platform_id, entity_type, entity_id, action, performed_by, changes_summary, snapshot_after)
    VALUES (
        v_platform_id, 'PLATFORM', v_platform_id, 'CREATE_PLATFORM', p_performed_by,
        format('สร้าง Platform "%s" (%s) โหมด %s', v_name, v_slug, p_first_public_page),
        jsonb_build_object(
            'platformId', v_platform_id, 'platformSlug', v_slug, 'platformName', v_name,
            'firstPublicPage', p_first_public_page::text,
            'modules', to_jsonb(v_modules)
        )
    );

    RETURN v_platform_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_platform_blueprint(TEXT, TEXT, UUID, public.first_public_page_mode, TEXT, TEXT) FROM PUBLIC;

-- 10. Backfill blueprint rows for platforms seeded before this migration ----
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.id, p.platform_name, p.first_public_page
        FROM public.platforms p
        WHERE NOT EXISTS (SELECT 1 FROM public.platform_pages pp WHERE pp.platform_id = p.id)
    LOOP
        INSERT INTO public.platform_pages
            (platform_id, page_slug, title, access_level, is_entry_page, component_tree)
        VALUES (r.id, 'home', 'หน้าหลัก', 'PUBLIC', TRUE, public.blueprint_home_tree(r.platform_name, TRUE))
        ON CONFLICT DO NOTHING;

        INSERT INTO public.platform_modules (platform_id, module_code, module_name, module_order)
        SELECT r.id, code, INITCAP(code), ordinality
        FROM unnest(ARRAY['PAGES', 'AUTH', 'FLOW', 'STYLE', 'FORM', 'SERVICE', 'EVENT', 'REPORT'])
             WITH ORDINALITY AS t(code, ordinality)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.platform_workflows (platform_id, flow_code, flow_name, flow_type, nodes, edges)
        VALUES (r.id, 'MASTER_ENTRY', 'Enterprise Master Lifecycle', 'ENTERPRISE',
                public.blueprint_flow_nodes(r.first_public_page),
                public.blueprint_flow_edges(r.first_public_page))
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

COMMIT;
