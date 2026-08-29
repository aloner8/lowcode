-- Make the normalized Page registry authoritative for the Page/HTML IDE.
-- platforms.studio_pages remains a publishable compatibility snapshot.
BEGIN;

INSERT INTO public.platform_pages
  (platform_id, page_slug, title, access_level, is_entry_page, component_tree, page_config, seo)
SELECT p.id,
       page->>'id',
       COALESCE(NULLIF(page->>'title', ''), page->>'name', page->>'id'),
       CASE WHEN COALESCE(page->>'containerName', '') ~* '(backend|admin)' THEN 'PRIVATE' ELSE 'PUBLIC' END,
       FALSE,
       COALESCE(page->'componentTree', '[]'::jsonb),
       page - 'componentTree',
       COALESCE(page->'seo', '{"title":null,"description":null,"keywords":[],"ogImage":null,"noindex":false,"changeFrequency":"weekly","priority":0.5}'::jsonb)
FROM public.platforms p
CROSS JOIN LATERAL jsonb_array_elements(p.studio_pages) page
WHERE NULLIF(page->>'id', '') IS NOT NULL
ON CONFLICT (platform_id, page_slug) DO UPDATE SET
  title = EXCLUDED.title,
  access_level = EXCLUDED.access_level,
  component_tree = EXCLUDED.component_tree,
  page_config = EXCLUDED.page_config,
  seo = EXCLUDED.seo;

UPDATE public.platform_pages SET is_entry_page = FALSE;

UPDATE public.platform_pages pp
SET is_entry_page = TRUE
FROM public.platforms p
WHERE pp.platform_id = p.id
  AND pp.page_slug = COALESCE(
    (SELECT page->>'id' FROM jsonb_array_elements(p.studio_pages) page WHERE COALESCE((page->>'isDefaultPage')::boolean, FALSE) LIMIT 1),
    (SELECT page->>'id' FROM jsonb_array_elements(p.studio_pages) page LIMIT 1)
  );

-- Normalize legacy rows so Studio clients can safely treat platform_pages as authoritative.
UPDATE public.platform_pages
SET page_config = COALESCE(page_config, '{}'::jsonb) || jsonb_build_object(
  'id', page_slug,
  'name', COALESCE(NULLIF(page_config->>'name', ''), title || ' (' || page_slug || '.page)'),
  'title', title
);

COMMIT;
