BEGIN;

ALTER TABLE public.platforms
  ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS runtime_path TEXT,
  ADD COLUMN IF NOT EXISTS runtime_image TEXT,
  ADD COLUMN IF NOT EXISTS runtime_container_name TEXT,
  ADD COLUMN IF NOT EXISTS runtime_status VARCHAR(30) NOT NULL DEFAULT 'not_created',
  ADD COLUMN IF NOT EXISTS runtime_built_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS runtime_source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS runtime_build_revision VARCHAR(64),
  ADD COLUMN IF NOT EXISTS runtime_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS runtime_port INTEGER,
  ADD COLUMN IF NOT EXISTS runtime_error TEXT;

UPDATE public.platforms
SET runtime_path = COALESCE(runtime_path, '/platform-runtime/' || platform_slug),
    content_updated_at = COALESCE(content_updated_at, updated_at);

COMMIT;
