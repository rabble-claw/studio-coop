-- Studio Co-op: Migration 025 — Seed Empire Aerial Arts in production
-- Safe/idempotent upsert. Does not truncate or delete existing data.

-- ============================================================
-- STUDIO
-- ============================================================
insert into public.studios (
  id,
  name,
  slug,
  discipline,
  description,
  timezone,
  currency,
  settings,
  tier,
  country_code,
  region,
  city,
  address,
  latitude,
  longitude
) values (
  'bb000000-0000-0000-0000-000000000001',
  'Empire Aerial Arts',
  'empire-aerial-arts',
  'aerial',
  'Wellington''s home for pole, aerial, and circus arts. Cuba Street vibes, all levels welcome. Come fly with us!',
  'Pacific/Auckland',
  'NZD',
  '{
    "email": "hello@empireaerialarts.com",
    "website": "https://linktr.ee/Emma_Lou_Empire",
    "instagram": "https://www.instagram.com/empireaerialarts/",
    "logo_url": "/empire/logo.jpg",
    "hero_image_url": "/empire/hero.jpg",
    "teacher_spotlights": [
      {
        "name": "Emma Louise",
        "role": "Founder & Lead Coach",
        "bio": "Emma opened Empire to build a real aerial community in Wellington. Her focus is helping first-timers feel welcome, supported, and confident from class one.",
        "instagram": "https://www.instagram.com/emma.louise.nz/"
      },
      {
        "name": "Katie Leticia",
        "role": "Pole Coach",
        "bio": "Katie guides members through strong technical foundations and steady progression.",
        "instagram": "https://www.instagram.com/katie.leticia/"
      },
      {
        "name": "Amy Grace Laura .",
        "role": "Pole Coach",
        "bio": "Amy teaches focused classes that help members build confidence and consistency.",
        "instagram": "https://www.instagram.com/amy_acrobatics/"
      }
    ]
  }'::jsonb,
  'studio',
  'NZ',
  'Wellington',
  'Wellington',
  'Level 1, 110 Cuba Street, Te Aro, Wellington 6011',
  -41.2917,
  174.7766
)
on conflict (slug) do update
set
  name = excluded.name,
  discipline = excluded.discipline,
  description = excluded.description,
  timezone = excluded.timezone,
  currency = excluded.currency,
  settings = excluded.settings,
  tier = excluded.tier,
  country_code = excluded.country_code,
  region = excluded.region,
  city = excluded.city,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

-- ============================================================
-- MEMBERSHIP PLANS
-- ============================================================
with empire as (
  select id
  from public.studios
  where slug = 'empire-aerial-arts'
  limit 1
)
insert into public.membership_plans (
  id,
  studio_id,
  name,
  description,
  type,
  price_cents,
  currency,
  interval,
  class_limit,
  validity_days,
  active,
  sort_order
)
select *
from (
  select
    'e1000000-0000-0000-0000-000000000001'::uuid as id,
    empire.id as studio_id,
    'Intro Pass - 3 Classes!'::text as name,
    'Best first step for new members.'::text as description,
    'intro'::text as type,
    5000::integer as price_cents,
    'NZD'::text as currency,
    'once'::text as interval,
    3::integer as class_limit,
    30::integer as validity_days,
    true as active,
    0::integer as sort_order
  from empire
  union all
  select
    'e1000000-0000-0000-0000-000000000002'::uuid,
    empire.id,
    'Single Class Pass',
    'Book one class at a time.',
    'drop_in',
    2700,
    'NZD',
    'once',
    1,
    null,
    true,
    1
  from empire
  union all
  select
    'e1000000-0000-0000-0000-000000000003'::uuid,
    empire.id,
    'Pegasus Pass - 1 Month All Access',
    'Unlimited monthly classes for regulars.',
    'unlimited',
    31000,
    'NZD',
    'month',
    null,
    null,
    true,
    2
  from empire
) rows
on conflict (id) do update
set
  studio_id = excluded.studio_id,
  name = excluded.name,
  description = excluded.description,
  type = excluded.type,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  interval = excluded.interval,
  class_limit = excluded.class_limit,
  validity_days = excluded.validity_days,
  active = excluded.active,
  sort_order = excluded.sort_order;
