CREATE TABLE IF NOT EXISTS public.platform_table_samples (
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  table_name varchar(128) NOT NULL,
  sample_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_file text,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform_id, table_name)
);
