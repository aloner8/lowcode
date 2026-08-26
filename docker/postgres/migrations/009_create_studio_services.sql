ALTER TABLE public.platforms
  ADD COLUMN IF NOT EXISTS studio_services JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.platforms
SET studio_services = jsonb_build_array(jsonb_build_object(
  'id', 'service.auth.jwt', 'name', 'Auth (JWT)', 'kind', 'auth', 'provider', 'jwt', 'scope', 'container', 'enabled', true,
  'implementation', jsonb_build_object('owner', 'mother', 'version', 1, 'module', 'auth/jwt'),
  'config', jsonb_build_object('algorithm', 'HS256', 'issuer', platform_slug, 'audience', platform_slug || '-containers', 'accessTokenTtlSeconds', 900, 'refreshTokenTtlSeconds', 604800, 'secretEnvKey', 'PLATFORM_JWT_SECRET'),
  'containerBindings', '[]'::jsonb
))
WHERE studio_services = '[]'::jsonb;
