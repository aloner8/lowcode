-- SEO configuration.
--
-- Defaults live on the Platform Master and are overridden per Site, so a
-- blueprint can ship sensible metadata while each tenant still controls its own
-- title, description, social image, locale and indexing policy.

BEGIN;

ALTER TABLE public.platforms
    ADD COLUMN IF NOT EXISTS seo_defaults JSONB NOT NULL DEFAULT '{
        "siteName": null,
        "description": null,
        "keywords": [],
        "locale": "th_TH",
        "language": "th",
        "ogImage": null,
        "twitterHandle": null,
        "organizationType": "GovernmentOrganization",
        "robots": "index,follow"
    }'::jsonb;

ALTER TABLE public.apps
    ADD COLUMN IF NOT EXISTS seo_settings JSONB NOT NULL DEFAULT '{
        "siteName": null,
        "description": null,
        "keywords": [],
        "locale": null,
        "language": null,
        "ogImage": null,
        "twitterHandle": null,
        "organizationType": null,
        "robots": null,
        "googleSiteVerification": null,
        "bingSiteVerification": null,
        "sitemapEnabled": true,
        "contact": {}
    }'::jsonb;

ALTER TABLE public.platforms
    DROP CONSTRAINT IF EXISTS platforms_seo_defaults_object;
ALTER TABLE public.platforms
    ADD CONSTRAINT platforms_seo_defaults_object
    CHECK (jsonb_typeof(seo_defaults) = 'object');

ALTER TABLE public.apps
    DROP CONSTRAINT IF EXISTS apps_seo_settings_object;
ALTER TABLE public.apps
    ADD CONSTRAINT apps_seo_settings_object
    CHECK (jsonb_typeof(seo_settings) = 'object');

-- Per-page SEO for blueprint pages. Published pages carry the same shape inside
-- platforms.studio_pages[].seo so the runtime snapshot stays self-contained.
ALTER TABLE public.platform_pages
    ADD COLUMN IF NOT EXISTS seo JSONB NOT NULL DEFAULT '{
        "title": null,
        "description": null,
        "keywords": [],
        "ogImage": null,
        "noindex": false,
        "changeFrequency": "weekly",
        "priority": 0.5
    }'::jsonb;

COMMENT ON COLUMN public.platforms.seo_defaults IS
    'Blueprint-level SEO defaults inherited by every site built from this platform';
COMMENT ON COLUMN public.apps.seo_settings IS
    'Site-level SEO overrides; null members fall back to the platform defaults';
COMMENT ON COLUMN public.platform_pages.seo IS
    'Per-page metadata: title, description, ogImage, noindex, sitemap hints';

-- Seed a usable default site name from the platform name.
UPDATE public.platforms
SET seo_defaults = jsonb_set(seo_defaults, '{siteName}', to_jsonb(platform_name), true)
WHERE seo_defaults ->> 'siteName' IS NULL;

UPDATE public.platforms
SET seo_defaults = jsonb_set(seo_defaults, '{description}', to_jsonb(COALESCE(description, platform_name)), true)
WHERE seo_defaults ->> 'description' IS NULL;

COMMIT;
