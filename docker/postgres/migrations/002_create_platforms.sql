BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_slug VARCHAR(100) NOT NULL UNIQUE,
    platform_name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.platform_categories(id) ON DELETE RESTRICT,
    master_theme_config JSONB NOT NULL DEFAULT '{
        "preset": "modern-indigo",
        "mode": "light",
        "primaryColor": "#0d6efd",
        "borderRadius": "0.375rem",
        "fontFamily": "Anuphan, sans-serif"
    }'::jsonb,
    studio_layout JSONB NOT NULL DEFAULT '[]'::jsonb,
    studio_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
    studio_initialized BOOLEAN NOT NULL DEFAULT FALSE,
    content_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    runtime_path TEXT,
    runtime_image TEXT,
    runtime_container_name TEXT,
    runtime_status VARCHAR(30) NOT NULL DEFAULT 'not_created',
    runtime_built_at TIMESTAMPTZ,
    runtime_source_updated_at TIMESTAMPTZ,
    runtime_build_revision VARCHAR(64),
    runtime_snapshot JSONB,
    runtime_port INTEGER,
    runtime_error TEXT,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platforms_slug_not_blank CHECK (BTRIM(platform_slug) <> ''),
    CONSTRAINT platforms_name_not_blank CHECK (BTRIM(platform_name) <> ''),
    CONSTRAINT platforms_slug_format CHECK (platform_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

ALTER TABLE public.platforms
    ADD COLUMN IF NOT EXISTS studio_layout JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.platforms
    ADD COLUMN IF NOT EXISTS studio_pages JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.platforms
    ADD COLUMN IF NOT EXISTS studio_initialized BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.set_platform_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_platforms_updated_at ON public.platforms;
CREATE TRIGGER set_platforms_updated_at
BEFORE UPDATE ON public.platforms
FOR EACH ROW
EXECUTE FUNCTION public.set_platform_updated_at();

INSERT INTO public.platforms
    (platform_slug, platform_name, description, category_id, master_theme_config)
SELECT seed.platform_slug, seed.platform_name, seed.description, c.id, seed.theme::jsonb
FROM (VALUES
    ('platform-erp', 'PlatformERP Enterprise Solution',
     'Master Enterprise Resource Planning Low-Code Blueprint Solution', 'ERP',
     '{"preset":"corporate-emerald","mode":"light","primaryColor":"#198754","borderRadius":"0.5rem","fontFamily":"Anuphan, sans-serif"}'),
    ('platform-crm', 'PlatformCRM Sales & Lead Solution',
     'Master Customer Relationship Management Low-Code Blueprint', 'CRM',
     '{"preset":"modern-indigo","mode":"light","primaryColor":"#0d6efd","borderRadius":"0.375rem","fontFamily":"Anuphan, sans-serif"}'),
    ('plateform-obt', 'Web อบต.',
     'Master CMS Solution Blueprint', 'CMS',
     '{"preset":"modern-indigo","mode":"light","primaryColor":"#0d6efd","borderRadius":"0.375rem","fontFamily":"Anuphan, sans-serif"}')
) AS seed(platform_slug, platform_name, description, category_name, theme)
JOIN public.platform_categories c ON c.category_name = seed.category_name
ON CONFLICT (platform_slug) DO UPDATE
SET
    platform_name = EXCLUDED.platform_name,
    description = EXCLUDED.description,
    category_id = EXCLUDED.category_id,
    master_theme_config = EXCLUDED.master_theme_config;

COMMIT;
