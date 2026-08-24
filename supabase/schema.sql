-- Enable UUID & Crypto Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Platforms Table (พิมพ์เขียว Platform Master Solution)
CREATE TABLE IF NOT EXISTS public.platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_slug VARCHAR(100) UNIQUE NOT NULL,
    platform_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'ERP',
    master_theme_config JSONB NOT NULL DEFAULT '{
        "preset": "corporate-emerald",
        "mode": "light",
        "primaryColor": "#0d6efd",
        "borderRadius": "0.375rem",
        "fontFamily": "Inter, sans-serif"
    }'::jsonb,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Apps Table (App แม่ Control Metadata & App ลูก Configs + Platform Parent Link)
CREATE TABLE IF NOT EXISTS public.apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
    app_slug VARCHAR(100) UNIQUE NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    description TEXT,
    port INT UNIQUE NOT NULL,
    subdomain VARCHAR(255) UNIQUE NOT NULL,
    tenant_db_name VARCHAR(255) UNIQUE NOT NULL,
    theme_config JSONB NOT NULL DEFAULT '{
        "preset": "modern-indigo",
        "mode": "light",
        "primaryColor": "#0d6efd",
        "borderRadius": "0.375rem",
        "fontFamily": "Inter, sans-serif"
    }'::jsonb,
    tenant_overrides JSONB NOT NULL DEFAULT '{
        "disabledFeatures": [],
        "themeOverrides": {},
        "componentPropsOverrides": {}
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 2. Page Layouts Table (PagesHtmlDynamicComponent AST)
CREATE TABLE IF NOT EXISTS public.page_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    page_slug VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    is_default_page BOOLEAN DEFAULT FALSE,
    component_tree JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_app_page_slug UNIQUE (app_id, page_slug)
);

-- 3. Workflow Trees Table (React Flow Visual AST)
CREATE TABLE IF NOT EXISTS public.workflow_trees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    flow_name VARCHAR(255) NOT NULL,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit Logs Table (App Revision & Change History)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(255) DEFAULT 'system',
    changes_summary TEXT NOT NULL,
    snapshot_before JSONB,
    snapshot_after JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Profiles Table (ส่วนขยายจาก auth.users ของ Web แม่)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    global_role VARCHAR(50) NOT NULL DEFAULT 'DEVELOPER' 
        CHECK (global_role IN ('SUPER_ADMIN', 'DEVELOPER', 'VIEWER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. App Memberships Table (สิทธิ์ Developer แต่ละคนต่อ App ลูกใน Studio)
CREATE TABLE IF NOT EXISTS public.app_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    app_role VARCHAR(50) NOT NULL DEFAULT 'APP_EDITOR' 
        CHECK (app_role IN ('APP_OWNER', 'APP_EDITOR', 'APP_VIEWER')),
    granted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_app UNIQUE (user_id, app_id)
);

-- Automatic Timestamp Update Function
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach Triggers for Auto-updating updated_at
DROP TRIGGER IF EXISTS set_timestamp_apps ON public.apps;
CREATE TRIGGER set_timestamp_apps
BEFORE UPDATE ON public.apps
FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();

DROP TRIGGER IF EXISTS set_timestamp_page_layouts ON public.page_layouts;
CREATE TRIGGER set_timestamp_page_layouts
BEFORE UPDATE ON public.page_layouts
FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();

DROP TRIGGER IF EXISTS set_timestamp_workflow_trees ON public.workflow_trees;
CREATE TRIGGER set_timestamp_workflow_trees
BEFORE UPDATE ON public.workflow_trees
FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();

DROP TRIGGER IF EXISTS set_timestamp_profiles ON public.profiles;
CREATE TRIGGER set_timestamp_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();

-- Trigger Auto-creating profile when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, full_name, global_role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'global_role', 'DEVELOPER')
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        global_role = EXCLUDED.global_role;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sample Seed Data for Platform Master Blueprint & App ลูก Demo
INSERT INTO public.platforms (id, platform_slug, platform_name, description, category, master_theme_config)
VALUES (
    'p0000000-0000-0000-0000-000000000001'::uuid,
    'platform-erp',
    'PlatformERP Enterprise Solution',
    'Master Enterprise Resource Planning Low-Code Solution Blueprint',
    'ERP',
    '{
        "preset": "corporate-emerald",
        "mode": "light",
        "primaryColor": "#198754",
        "borderRadius": "0.5rem",
        "fontFamily": "Inter, sans-serif"
    }'::jsonb
) ON CONFLICT (platform_slug) DO NOTHING;

INSERT INTO public.apps (id, platform_id, app_slug, app_name, description, port, subdomain, tenant_db_name, theme_config)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'p0000000-0000-0000-0000-000000000001'::uuid,
    'demo-client-a',
    'Demo Client App A',
    'Sample Child App A derived from PlatformERP',
    3001,
    'client-a.localhost',
    'app_db_client_a',
    '{
        "preset": "corporate-emerald",
        "mode": "light",
        "primaryColor": "#198754",
        "borderRadius": "0.5rem",
        "fontFamily": "Inter, sans-serif"
    }'::jsonb
) ON CONFLICT (app_slug) DO NOTHING;


-- Seed Accounts for Platform Web แม่:
-- 1) Admin User: admin@platform.com (password: 1qaz@WSX, role: SUPER_ADMIN)
-- 2) First Dev User: aloner@platform.com / username: aloner (password: 1qaz@WSX, role: DEVELOPER)

DO $$
DECLARE
    admin_uid UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    dev_uid UUID := '22222222-2222-2222-2222-222222222222'::uuid;
    hashed_pw TEXT := crypt('1qaz@WSX', gen_salt('bf'));
BEGIN
    -- Seed Admin into auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        admin_uid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        'admin@platform.com',
        hashed_pw,
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Super Admin", "username": "admin", "global_role": "SUPER_ADMIN"}'::jsonb,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Seed Admin Profile
    INSERT INTO public.profiles (id, username, email, full_name, global_role)
    VALUES (admin_uid, 'admin', 'admin@platform.com', 'Super Admin', 'SUPER_ADMIN')
    ON CONFLICT (id) DO UPDATE SET global_role = 'SUPER_ADMIN';

    -- Seed Developer "aloner" into auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        dev_uid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        'aloner@platform.com',
        hashed_pw,
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Aloner Developer", "username": "aloner", "global_role": "DEVELOPER"}'::jsonb,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Seed Dev Profile
    INSERT INTO public.profiles (id, username, email, full_name, global_role)
    VALUES (dev_uid, 'aloner', 'aloner@platform.com', 'Aloner Developer', 'DEVELOPER')
    ON CONFLICT (id) DO UPDATE SET global_role = 'DEVELOPER';

    -- Assign Aloner access to Demo Client A
    INSERT INTO public.app_memberships (user_id, app_id, app_role, granted_by)
    VALUES (dev_uid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'APP_OWNER', admin_uid)
    ON CONFLICT (user_id, app_id) DO NOTHING;
END $$;

