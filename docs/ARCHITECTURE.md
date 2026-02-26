# Studio Co-op — Technical Architecture

_Draft v1 — 2026-02-26_

## Monorepo Structure

```
studio-coop/
├── apps/
│   ├── web/                  # Next.js — studio dashboard + marketing site
│   │   ├── app/              # App router
│   │   ├── components/       # Shared UI components
│   │   └── lib/              # Utils, API clients
│   ├── mobile/               # Expo/React Native — member + teacher app
│   │   ├── app/              # Expo Router (file-based)
│   │   ├── components/
│   │   └── lib/
│   └── admin/                # (later) Super-admin for platform ops
├── packages/
│   ├── shared/               # Shared types, utils, validation (Zod schemas)
│   ├── db/                   # Drizzle ORM schema + migrations
│   └── api/                  # tRPC or Hono API routes (shared between web + mobile)
├── supabase/
│   ├── migrations/           # SQL migrations
│   ├── seed.sql              # Dev seed data
│   └── config.toml
├── turbo.json                # Turborepo config
├── package.json
└── README.md
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Web framework** | Next.js 15 (App Router) | SSR, RSC, Vercel deploy, fast |
| **Mobile framework** | Expo SDK 52 + React Native | OTA updates, shared JS, Expo Router |
| **API** | Hono (on Vercel Edge or Supabase Edge Functions) | Fast, lightweight, runs everywhere |
| **Database** | Supabase (PostgreSQL) | Auth, Realtime, Storage, Row Level Security |
| **ORM** | Drizzle ORM | Type-safe, lightweight, great migrations |
| **Auth** | Supabase Auth | Email/password, magic link, social. Per-studio member auth. |
| **Realtime** | Supabase Realtime | Class feeds, live updates |
| **Storage** | Supabase Storage | Profile photos, class media |
| **Payments** | Stripe Connect (Express) | Per-studio accounts, platform doesn't touch funds |
| **Push** | Expo Notifications | Cross-platform push |
| **Calendar** | Google Calendar API + Apple EventKit (via Expo) | Real two-way sync |
| **Monorepo** | Turborepo | Fast builds, shared packages |
| **Styling** | Tailwind (web) + NativeWind (mobile) | Shared design tokens |
| **Validation** | Zod | Shared schemas between client + server |
| **Hosting** | Vercel (web) + Supabase (DB/API/Storage) | Low ops overhead |

## Data Model

### Core Entities

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Studio     │────<│  Membership  │>────│    User       │
└─────────────┘     └─────────────┘     └──────────────┘
       │                                        │
       │                                        │
       ▼                                        │
┌─────────────┐     ┌─────────────┐            │
│   Class      │────<│  Booking     │>───────────┘
│  Template    │     └─────────────┘
└─────────────┘            │
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Class      │────<│  Attendance  │
│  Instance    │     └─────────────┘
└─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Class Feed  │────<│  Feed Post   │
└─────────────┘     └─────────────┘
```

### Tables

#### `studios`
```sql
id              uuid PRIMARY KEY
name            text NOT NULL
slug            text UNIQUE NOT NULL  -- studio.coop/{slug}
discipline      text NOT NULL         -- 'pole', 'bjj', 'yoga', 'crossfit', 'cycling', 'general'
description     text
logo_url        text
timezone        text NOT NULL
currency        text DEFAULT 'USD'
settings        jsonb DEFAULT '{}'    -- cancellation_window_hours, max_class_size, etc.
stripe_account_id text               -- Stripe Connect account
tier            text DEFAULT 'free'   -- 'free', 'studio', 'pro'
created_at      timestamptz DEFAULT now()
```

#### `users`
```sql
id              uuid PRIMARY KEY (= Supabase auth.users.id)
email           text UNIQUE NOT NULL
name            text NOT NULL
avatar_url      text
phone           text
created_at      timestamptz DEFAULT now()
```

#### `memberships` (user ↔ studio relationship)
```sql
id              uuid PRIMARY KEY
user_id         uuid REFERENCES users
studio_id       uuid REFERENCES studios
role            text NOT NULL          -- 'member', 'teacher', 'admin', 'owner'
status          text DEFAULT 'active'  -- 'active', 'suspended', 'cancelled'
notes           text                   -- staff-only notes (injuries, preferences)
tags            text[]                 -- custom tags per studio
joined_at       timestamptz DEFAULT now()
UNIQUE(user_id, studio_id)
```

#### `class_templates` (recurring class definition)
```sql
id              uuid PRIMARY KEY
studio_id       uuid REFERENCES studios
name            text NOT NULL          -- "Beginner Pole", "Morning Flow"
description     text
teacher_id      uuid REFERENCES users
day_of_week     int                    -- 0=Sunday, 6=Saturday
start_time      time NOT NULL
duration_min    int NOT NULL
max_capacity    int
location        text                   -- room name
recurrence      text DEFAULT 'weekly'  -- 'weekly', 'biweekly', 'monthly', 'once'
settings        jsonb DEFAULT '{}'     -- discipline-specific (pole_count, reformer_layout, etc.)
active          boolean DEFAULT true
```

#### `class_instances` (specific occurrence of a class)
```sql
id              uuid PRIMARY KEY
template_id     uuid REFERENCES class_templates
studio_id       uuid REFERENCES studios
teacher_id      uuid REFERENCES users   -- can differ from template (subs)
date            date NOT NULL
start_time      time NOT NULL
end_time        time NOT NULL
status          text DEFAULT 'scheduled' -- 'scheduled', 'in_progress', 'completed', 'cancelled'
max_capacity    int
notes           text                    -- "Guest teacher today!"
feed_enabled    boolean DEFAULT true
UNIQUE(template_id, date)
```

#### `bookings`
```sql
id              uuid PRIMARY KEY
class_instance_id uuid REFERENCES class_instances
user_id         uuid REFERENCES users
status          text DEFAULT 'booked'   -- 'booked', 'confirmed', 'waitlisted', 'cancelled', 'no_show'
spot            text                    -- pole number, bike number, reformer position
booked_at       timestamptz DEFAULT now()
confirmed_at    timestamptz
cancelled_at    timestamptz
waitlist_position int                   -- null if not waitlisted
```

#### `attendance`
```sql
id              uuid PRIMARY KEY
class_instance_id uuid REFERENCES class_instances
user_id         uuid REFERENCES users
checked_in      boolean DEFAULT false
checked_in_at   timestamptz
checked_in_by   uuid REFERENCES users   -- teacher who marked them
walk_in         boolean DEFAULT false    -- not booked but showed up
```

#### `feed_posts`
```sql
id              uuid PRIMARY KEY
class_instance_id uuid REFERENCES class_instances
user_id         uuid REFERENCES users
content         text
media_urls      text[]                  -- photos, short videos
post_type       text DEFAULT 'post'     -- 'post', 'achievement', 'milestone', 'auto'
created_at      timestamptz DEFAULT now()
```

#### `notifications`
```sql
id              uuid PRIMARY KEY
user_id         uuid REFERENCES users
studio_id       uuid REFERENCES studios
type            text NOT NULL           -- 'reminder', 'confirmation', 'waitlist', 'feed', 'reengagement'
title           text
body            text
data            jsonb                   -- deep link info
sent_at         timestamptz
read_at         timestamptz
scheduled_for   timestamptz
```

### Row Level Security (RLS)

Key policies:
- Users can only see studios they're members of
- Members can only see class feeds for classes they attended
- Staff notes on memberships visible only to teachers/admins of that studio
- Owners can see everything in their studio
- Cross-studio data never leaks

```sql
-- Example: Feed posts only visible to attendees
CREATE POLICY "feed_posts_attendee_only" ON feed_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM attendance
      WHERE attendance.class_instance_id = feed_posts.class_instance_id
      AND attendance.user_id = auth.uid()
      AND attendance.checked_in = true
    )
  );
```

## API Design

### Key Endpoints (Hono or Supabase Edge Functions)

```
# Studio
GET    /api/studios/:slug              # Studio public info
PUT    /api/studios/:id                # Update studio (owner only)

# Schedule
GET    /api/studios/:id/schedule       # Class instances for date range
POST   /api/studios/:id/classes        # Create class template (admin)
PUT    /api/classes/:id                # Update class instance

# Booking
POST   /api/classes/:id/book           # Book a spot
DELETE /api/bookings/:id               # Cancel booking
POST   /api/bookings/:id/confirm       # Confirm attendance

# Check-in (teacher)
GET    /api/classes/:id/roster         # Photo grid with booking status
POST   /api/classes/:id/checkin        # Mark attendance (batch)

# Feed
GET    /api/classes/:id/feed           # Get feed posts (attendees only)
POST   /api/classes/:id/feed           # Post to feed

# Members
GET    /api/studios/:id/members        # List members (staff only)
GET    /api/users/:id/profile          # User profile
PUT    /api/memberships/:id/notes      # Update staff notes
```

## Deployment

### Development
- `pnpm dev` — runs web + mobile + Supabase local simultaneously
- Supabase CLI for local Postgres + Auth + Storage
- Expo Go for mobile testing on device

### Production
- **Web:** Vercel (auto-deploy from main branch)
- **Mobile:** EAS Build + EAS Submit (App Store + Play Store)
- **Database:** Supabase managed (free tier → Pro as needed)
- **Edge Functions:** Supabase or Vercel Edge

### Estimated Costs (early stage, <100 studios)
- Vercel: Free tier → $20/mo
- Supabase: Free tier → $25/mo (Pro)
- Expo/EAS: Free tier → $99/mo (Production)
- Stripe: No monthly fee (per-transaction only)
- **Total: $0-144/mo**

## Security Priorities
1. RLS on every table — no data leaks between studios
2. Supabase Auth — no custom auth code
3. Stripe Connect Express — platform never handles card data
4. Media uploads: signed URLs, size limits, content type validation
5. Rate limiting on public endpoints

## Phase 1 MVP Scope (Technical)
1. Supabase project + schema migration (tables above)
2. Next.js web: studio dashboard (schedule management, member list)
3. Expo mobile: class schedule view, booking, class feed
4. Supabase Auth: email/password + magic link
5. Push notifications: Expo Notifications for reminders
6. No payments in v1 — add Stripe Connect in v2
