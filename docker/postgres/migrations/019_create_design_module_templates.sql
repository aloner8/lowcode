-- Reusable design-tool blueprints are intentionally separate from the data
-- created inside a Platform. A template can be shared; an instance never is.
BEGIN;

CREATE TABLE IF NOT EXISTS public.design_module_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    parameter_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
    object_graph JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT design_module_templates_name_not_blank CHECK (BTRIM(template_name) <> ''),
    CONSTRAINT design_module_templates_parameters_array CHECK (jsonb_typeof(parameter_schema) = 'array'),
    CONSTRAINT design_module_templates_graph_array CHECK (jsonb_typeof(object_graph) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS design_module_templates_owner_name_key
    ON public.design_module_templates (owner_user_id, LOWER(BTRIM(template_name)));
CREATE INDEX IF NOT EXISTS design_module_templates_public_idx
    ON public.design_module_templates (is_public, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_design_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.design_module_templates(id) ON DELETE SET NULL,
    created_by_user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE RESTRICT,
    module_name VARCHAR(255) NOT NULL,
    parameter_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    object_graph JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_design_modules_name_not_blank CHECK (BTRIM(module_name) <> ''),
    CONSTRAINT platform_design_modules_parameters_object CHECK (jsonb_typeof(parameter_values) = 'object'),
    CONSTRAINT platform_design_modules_graph_array CHECK (jsonb_typeof(object_graph) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_design_modules_platform_name_key
    ON public.platform_design_modules (platform_id, LOWER(BTRIM(module_name)));
CREATE INDEX IF NOT EXISTS platform_design_modules_platform_idx
    ON public.platform_design_modules (platform_id, updated_at DESC);

DROP TRIGGER IF EXISTS set_design_module_templates_updated_at ON public.design_module_templates;
CREATE TRIGGER set_design_module_templates_updated_at
BEFORE UPDATE ON public.design_module_templates
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

DROP TRIGGER IF EXISTS set_platform_design_modules_updated_at ON public.platform_design_modules;
CREATE TRIGGER set_platform_design_modules_updated_at
BEFORE UPDATE ON public.platform_design_modules
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

COMMIT;
