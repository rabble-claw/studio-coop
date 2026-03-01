-- 013_studio_location.sql
-- Add proper location columns to studios for geographic discovery

-- ─────────────────────────────────────────────────────────────────────────────
-- New columns on studios
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.studios
  add column if not exists country_code text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes for discovery queries
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_studios_country_code on public.studios (country_code);
create index if not exists idx_studios_country_region on public.studios (country_code, region);
create index if not exists idx_studios_lat_lng on public.studios (latitude, longitude);

-- ─────────────────────────────────────────────────────────────────────────────
-- Haversine distance function (returns km)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.haversine_distance(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) returns double precision
language sql
immutable strict
as $$
  select 6371 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2
    + cos(radians(lat1)) * cos(radians(lat2))
    * sin(radians(lng2 - lng1) / 2) ^ 2
  ))
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migrate existing data from settings JSONB → new columns
-- ─────────────────────────────────────────────────────────────────────────────
update public.studios
set
  city = (settings->>'city'),
  address = (settings->>'address'),
  country_code = case
    when lower(settings->>'country') in ('new zealand', 'nz', 'nzl') then 'NZ'
    when lower(settings->>'country') in ('united states', 'us', 'usa') then 'US'
    when lower(settings->>'country') in ('australia', 'au', 'aus') then 'AU'
    when lower(settings->>'country') in ('united kingdom', 'uk', 'gb', 'gbr') then 'GB'
    when lower(settings->>'country') in ('canada', 'ca', 'can') then 'CA'
    when length(settings->>'country') = 2 then upper(settings->>'country')
    else settings->>'country'
  end
where settings->>'city' is not null
   or settings->>'address' is not null
   or settings->>'country' is not null;
