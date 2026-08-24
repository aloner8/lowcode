ALTER TABLE public.platforms
  ADD COLUMN IF NOT EXISTS studio_forms jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS studio_collections jsonb NOT NULL DEFAULT '[]'::jsonb;

