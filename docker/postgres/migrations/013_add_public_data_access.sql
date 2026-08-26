-- Public runtime data access policy.
--
-- A tenant site is public, so its visitors have no platform session. Rather
-- than exposing the tenant database, each platform declares exactly which
-- tables anonymous visitors may read and which they may insert into (contact
-- forms, complaints, bookings). Nothing is readable or writable by default,
-- and anonymous UPDATE/DELETE is never possible.

BEGIN;

ALTER TABLE public.platforms
    ADD COLUMN IF NOT EXISTS public_data_access JSONB NOT NULL DEFAULT '{
        "readable": [],
        "insertable": []
    }'::jsonb;

ALTER TABLE public.platforms
    DROP CONSTRAINT IF EXISTS platforms_public_data_access_shape;

ALTER TABLE public.platforms
    ADD CONSTRAINT platforms_public_data_access_shape CHECK (
        jsonb_typeof(public_data_access -> 'readable') = 'array'
        AND jsonb_typeof(public_data_access -> 'insertable') = 'array'
    );

COMMENT ON COLUMN public.platforms.public_data_access IS
    'Allow-list for unauthenticated runtime access: {"readable":[table],"insertable":[table]}';

COMMIT;
