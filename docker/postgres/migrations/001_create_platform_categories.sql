BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.platform_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(100) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_categories_code_not_blank
        CHECK (BTRIM(category_code) <> ''),
    CONSTRAINT platform_categories_name_not_blank
        CHECK (BTRIM(category_name) <> ''),
    CONSTRAINT platform_categories_code_format
        CHECK (category_code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT platform_categories_category_code_key UNIQUE (category_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_categories_name_ci_key
    ON public.platform_categories (LOWER(BTRIM(category_name)));

CREATE OR REPLACE FUNCTION public.set_platform_category_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_platform_categories_updated_at
    ON public.platform_categories;

CREATE TRIGGER set_platform_categories_updated_at
BEFORE UPDATE ON public.platform_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_platform_category_updated_at();

INSERT INTO public.platform_categories (
    category_code,
    category_name,
    description,
    is_active
)
VALUES
    ('ERP', 'ERP', 'Enterprise Resource Planning', TRUE),
    ('CRM', 'CRM', 'Customer Relationship Management', TRUE),
    ('POS', 'POS', 'Point of Sale', TRUE),
    ('HRM', 'HRM', 'Human Resource Management', TRUE),
    ('E_COMMERCE', 'E-Commerce', 'Electronic Commerce', TRUE),
    ('INVENTORY', 'Inventory', 'Inventory Management', TRUE),
    ('FINANCE', 'Finance', 'Finance and Accounting', TRUE),
    ('LOGISTICS', 'Logistics', 'Logistics Management', TRUE)
ON CONFLICT (category_code) DO UPDATE
SET
    category_name = EXCLUDED.category_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

COMMIT;
