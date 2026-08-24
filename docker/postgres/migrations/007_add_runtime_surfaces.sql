ALTER TABLE public.platforms ADD COLUMN IF NOT EXISTS runtime_surfaces jsonb NOT NULL DEFAULT '{}'::jsonb;
