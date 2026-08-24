BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_page_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    route_path VARCHAR(255) NOT NULL,
    route_label VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('public_page', 'form_crud')),
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_page_flows_route_unique UNIQUE (platform_id, route_path)
);

DROP TRIGGER IF EXISTS set_platform_page_flows_updated_at ON public.platform_page_flows;
CREATE TRIGGER set_platform_page_flows_updated_at
BEFORE UPDATE ON public.platform_page_flows
FOR EACH ROW EXECUTE FUNCTION public.set_platform_updated_at();

COMMIT;
