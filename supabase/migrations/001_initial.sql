-- Studio Co-op: Initial Migration
-- Creates all tables, indexes, RLS policies, and seed data

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Studios
create table public.studios (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  discipline text not null check (discipline in ('pole','bjj','yoga','crossfit','cycling','pilates','dance','aerial','general')),
  description text,
  logo_url text,
  timezone text not null default 'America/New_York',
  currency text default 'USD',
  settings jsonb default '{}',
  stripe_account_id text,
  tier text default 'free' check (tier in ('free','studio','pro')),
  created_at timestamptz default now()
);

-- Users (linked to supabase auth.users)
create table public.users (
  id uuid primary key, -- matches auth.users.id
  email text unique not null,
  name text not null,
  avatar_url text,
  phone text,
  created_at timestamptz default now()
);

-- Memberships (user <-> studio relationship)
create table public.memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  role text not null default 'member' check (role in ('member','teacher','admin','owner')),
  status text default 'active' check (status in ('active','suspended','cancelled')),
  notes text,
  tags text[] default '{}',
  joined_at timestamptz default now(),
  unique(user_id, studio_id)
);

-- Class Templates (recurring class definitions)
create table public.class_templates (
  id uuid primary key default uuid_generate_v4(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  description text,
  teacher_id uuid references public.users(id),
  day_of_week integer check (day_of_week between 0 and 6),
  start_time time not null,
  duration_min integer not null check (duration_min between 15 and 240),
  max_capacity integer check (max_capacity > 0),
  location text,
  recurrence text default 'weekly' check (recurrence in ('weekly','biweekly','monthly','once')),
  settings jsonb default '{}',
  active boolean default true
);

-- Class Instances (specific occurrences of a class)
create table public.class_instances (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references public.class_templates(id) on delete set null,
  studio_id uuid not null references public.studios(id) on delete cascade,
  teacher_id uuid references public.users(id),
  date date not null,
  start_time time not null,
  end_time time not null,
  status text default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  max_capacity integer check (max_capacity > 0),
  notes text,
  feed_enabled boolean default true,
  unique(template_id, date)
);

-- Bookings
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  class_instance_id uuid not null references public.class_instances(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text default 'booked' check (status in ('booked','confirmed','waitlisted','cancelled','no_show')),
  spot text,
  booked_at timestamptz default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  waitlist_position integer
);

-- Attendance
create table public.attendance (
  id uuid primary key default uuid_generate_v4(),
  class_instance_id uuid not null references public.class_instances(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  checked_in boolean default false,
  checked_in_at timestamptz,
  checked_in_by uuid references public.users(id),
  walk_in boolean default false
);

-- Feed Posts (class community feed)
create table public.feed_posts (
  id uuid primary key default uuid_generate_v4(),
  class_instance_id uuid not null references public.class_instances(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text,
  media_urls text[] default '{}',
  post_type text default 'post' check (post_type in ('post','achievement','milestone','auto')),
  created_at timestamptz default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  studio_id uuid references public.studios(id) on delete cascade,
  type text not null,
  title text,
  body text,
  data jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  scheduled_for timestamptz
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Studios
create index idx_studios_slug on public.studios(slug);

-- Memberships
create index idx_memberships_user on public.memberships(user_id);
create index idx_memberships_studio on public.memberships(studio_id);
create index idx_memberships_studio_role on public.memberships(studio_id, role);

-- Class Templates
create index idx_class_templates_studio on public.class_templates(studio_id);
create index idx_class_templates_teacher on public.class_templates(teacher_id);
create index idx_class_templates_studio_active on public.class_templates(studio_id) where active = true;

-- Class Instances
create index idx_class_instances_studio on public.class_instances(studio_id);
create index idx_class_instances_studio_date on public.class_instances(studio_id, date);
create index idx_class_instances_template on public.class_instances(template_id);
create index idx_class_instances_teacher on public.class_instances(teacher_id);

-- Bookings
create index idx_bookings_class on public.bookings(class_instance_id);
create index idx_bookings_user on public.bookings(user_id);
create index idx_bookings_class_status on public.bookings(class_instance_id, status);

-- Attendance
create index idx_attendance_class on public.attendance(class_instance_id);
create index idx_attendance_user on public.attendance(user_id);

-- Feed Posts
create index idx_feed_posts_class on public.feed_posts(class_instance_id);
create index idx_feed_posts_class_created on public.feed_posts(class_instance_id, created_at desc);

-- Notifications
create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_user_unread on public.notifications(user_id) where read_at is null;
create index idx_notifications_scheduled on public.notifications(scheduled_for) where sent_at is null;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.studios enable row level security;
alter table public.users enable row level security;
alter table public.memberships enable row level security;
alter table public.class_templates enable row level security;
alter table public.class_instances enable row level security;
alter table public.bookings enable row level security;
alter table public.attendance enable row level security;
alter table public.feed_posts enable row level security;
alter table public.notifications enable row level security;

-- Helper: check if user is a member of a studio (any role)
create or replace function public.is_studio_member(p_studio_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships
    where studio_id = p_studio_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$ language sql security definer stable;

-- Helper: check if user is staff (teacher/admin/owner) of a studio
create or replace function public.is_studio_staff(p_studio_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships
    where studio_id = p_studio_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('teacher','admin','owner')
  );
$$ language sql security definer stable;

-- Helper: check if user attended a class
create or replace function public.is_class_attendee(p_class_instance_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.attendance
    where class_instance_id = p_class_instance_id
      and user_id = auth.uid()
      and checked_in = true
  );
$$ language sql security definer stable;

-- ---------- Studios ----------
-- Public: anyone can view studios (for the public pages)
create policy "Studios are publicly viewable"
  on public.studios for select
  using (true);

-- Only owners can update their studio
create policy "Studio owners can update"
  on public.studios for update
  using (public.is_studio_staff(id));

-- Authenticated users can create studios
create policy "Authenticated users can create studios"
  on public.studios for insert
  with check (auth.uid() is not null);

-- ---------- Users ----------
-- Users can view other users (needed for member lists, rosters)
create policy "Users are viewable by authenticated users"
  on public.users for select
  using (auth.uid() is not null);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid());

-- Users can insert their own profile (on signup)
create policy "Users can insert own profile"
  on public.users for insert
  with check (id = auth.uid());

-- ---------- Memberships ----------
-- Members can view memberships in their studios
create policy "Members can view studio memberships"
  on public.memberships for select
  using (public.is_studio_member(studio_id));

-- Staff can manage memberships
create policy "Staff can insert memberships"
  on public.memberships for insert
  with check (
    public.is_studio_staff(studio_id)
    or user_id = auth.uid() -- users can join studios
  );

create policy "Staff can update memberships"
  on public.memberships for update
  using (public.is_studio_staff(studio_id));

-- ---------- Class Templates ----------
-- Studio members can view templates
create policy "Members can view class templates"
  on public.class_templates for select
  using (public.is_studio_member(studio_id));

-- Staff can manage templates
create policy "Staff can manage class templates"
  on public.class_templates for insert
  with check (public.is_studio_staff(studio_id));

create policy "Staff can update class templates"
  on public.class_templates for update
  using (public.is_studio_staff(studio_id));

create policy "Staff can delete class templates"
  on public.class_templates for delete
  using (public.is_studio_staff(studio_id));

-- ---------- Class Instances ----------
-- Studio members can view class instances
create policy "Members can view class instances"
  on public.class_instances for select
  using (public.is_studio_member(studio_id));

-- Also allow public viewing for public studio pages
create policy "Public can view scheduled classes"
  on public.class_instances for select
  using (status = 'scheduled');

-- Staff can manage instances
create policy "Staff can manage class instances"
  on public.class_instances for insert
  with check (public.is_studio_staff(studio_id));

create policy "Staff can update class instances"
  on public.class_instances for update
  using (public.is_studio_staff(studio_id));

-- ---------- Bookings ----------
-- Users can view their own bookings
create policy "Users can view own bookings"
  on public.bookings for select
  using (user_id = auth.uid());

-- Staff can view all bookings for their studio's classes
create policy "Staff can view class bookings"
  on public.bookings for select
  using (
    exists (
      select 1 from public.class_instances ci
      where ci.id = class_instance_id
        and public.is_studio_staff(ci.studio_id)
    )
  );

-- Members can book classes
create policy "Members can create bookings"
  on public.bookings for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.class_instances ci
      where ci.id = class_instance_id
        and public.is_studio_member(ci.studio_id)
    )
  );

-- Users can update (cancel) their own bookings
create policy "Users can update own bookings"
  on public.bookings for update
  using (user_id = auth.uid());

-- Staff can update any booking in their studio
create policy "Staff can update bookings"
  on public.bookings for update
  using (
    exists (
      select 1 from public.class_instances ci
      where ci.id = class_instance_id
        and public.is_studio_staff(ci.studio_id)
    )
  );

-- ---------- Attendance ----------
-- Staff can view and manage attendance
create policy "Staff can view attendance"
  on public.attendance for select
  using (
    exists (
      select 1 from public.class_instances ci
      where ci.id = class_instance_id
        and public.is_studio_staff(ci.studio_id)
    )
  );

-- Users can view their own attendance
create policy "Users can view own attendance"
  on public.attendance for select
  using (user_id = auth.uid());

-- Staff can manage attendance (check-in)
create policy "Staff can manage attendance"
  on public.attendance for insert
  with check (
    exists (
      select 1 from public.class_instances ci
      where ci.id = class_instance_id
        and public.is_studio_staff(ci.studio_id)
    )
  );

create policy "Staff can update attendance"
  on public.attendance for update
  using (
    exists (
      select 1 from public.class_instances ci
      where ci.id = class_instance_id
        and public.is_studio_staff(ci.studio_id)
    )
  );

-- ---------- Feed Posts ----------
-- CRITICAL: Only attendees can view feed posts!
create policy "Attendees can view feed posts"
  on public.feed_posts for select
  using (public.is_class_attendee(class_instance_id));

-- Staff can also view feed posts
create policy "Staff can view feed posts"
  on public.feed_posts for select
  using (
    exists (
      select 1 from public.class_instances ci
      where ci.id = class_instance_id
        and public.is_studio_staff(ci.studio_id)
    )
  );

-- Only attendees can create feed posts
create policy "Attendees can create feed posts"
  on public.feed_posts for insert
  with check (
    user_id = auth.uid()
    and public.is_class_attendee(class_instance_id)
  );

-- Users can update their own posts
create policy "Users can update own feed posts"
  on public.feed_posts for update
  using (user_id = auth.uid());

-- Users can delete their own posts
create policy "Users can delete own feed posts"
  on public.feed_posts for delete
  using (user_id = auth.uid());

-- Staff can delete any feed post in their studio
create policy "Staff can delete feed posts"
  on public.feed_posts for delete
  using (
    exists (
      select 1 from public.class_instances ci
      where ci.id = class_instance_id
        and public.is_studio_staff(ci.studio_id)
    )
  );

-- ---------- Notifications ----------
-- Users can only see their own notifications
create policy "Users can view own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

-- Users can update (mark read) their own notifications
create policy "Users can update own notifications"
  on public.notifications for update
  using (user_id = auth.uid());

-- System/staff can insert notifications
create policy "Staff can create notifications"
  on public.notifications for insert
  with check (
    auth.uid() is not null
    and (
      studio_id is null
      or public.is_studio_staff(studio_id)
    )
  );

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Demo Users (using fixed UUIDs for referencing)
insert into public.users (id, email, name, avatar_url) values
  ('a1b2c3d4-0000-0000-0000-000000000001', 'alex@empirepole.com', 'Alex Rivera', null),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'jordan@empirepole.com', 'Jordan Chen', null),
  ('a1b2c3d4-0000-0000-0000-000000000003', 'sam@example.com', 'Sam Torres', null),
  ('a1b2c3d4-0000-0000-0000-000000000004', 'casey@example.com', 'Casey Kim', null),
  ('a1b2c3d4-0000-0000-0000-000000000005', 'riley@example.com', 'Riley Patel', null);

-- Demo Studio
insert into public.studios (id, name, slug, discipline, description, timezone, currency, settings, tier) values
  ('b1b2c3d4-0000-0000-0000-000000000001',
   'Empire Pole Studio',
   'empire-pole',
   'pole',
   'NYC''s favorite pole dance studio. All levels welcome. Come spin with us!',
   'America/New_York',
   'USD',
   '{"cancellationWindowHours": 12, "defaultMaxCapacity": 12, "confirmationReminderHours": [24, 2], "feedEnabled": true, "waitlistEnabled": true, "spotSelectionEnabled": false}',
   'studio');

-- Memberships
insert into public.memberships (user_id, studio_id, role, status, tags) values
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1b2c3d4-0000-0000-0000-000000000001', 'owner', 'active', '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'b1b2c3d4-0000-0000-0000-000000000001', 'teacher', 'active', '{"advanced"}'),
  ('a1b2c3d4-0000-0000-0000-000000000003', 'b1b2c3d4-0000-0000-0000-000000000001', 'member', 'active', '{"regular"}'),
  ('a1b2c3d4-0000-0000-0000-000000000004', 'b1b2c3d4-0000-0000-0000-000000000001', 'member', 'active', '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000005', 'b1b2c3d4-0000-0000-0000-000000000001', 'member', 'active', '{"beginner"}');

-- Class Templates
insert into public.class_templates (id, studio_id, name, description, teacher_id, day_of_week, start_time, duration_min, max_capacity, location, recurrence) values
  ('c1b2c3d4-0000-0000-0000-000000000001',
   'b1b2c3d4-0000-0000-0000-000000000001',
   'Intro to Pole',
   'Perfect for beginners! Learn the fundamentals of pole dance in a supportive environment.',
   'a1b2c3d4-0000-0000-0000-000000000002',
   1, '18:00', 60, 12, 'Studio A', 'weekly'),
  ('c1b2c3d4-0000-0000-0000-000000000002',
   'b1b2c3d4-0000-0000-0000-000000000001',
   'Intermediate Flow',
   'Build on your basics with flowing combos and transitions.',
   'a1b2c3d4-0000-0000-0000-000000000002',
   3, '19:00', 75, 10, 'Studio A', 'weekly'),
  ('c1b2c3d4-0000-0000-0000-000000000003',
   'b1b2c3d4-0000-0000-0000-000000000001',
   'Strength & Flexibility',
   'Cross-training for pole athletes. Core, upper body, and flexibility work.',
   'a1b2c3d4-0000-0000-0000-000000000001',
   6, '10:00', 60, 15, 'Studio B', 'weekly'),
  ('c1b2c3d4-0000-0000-0000-000000000004',
   'b1b2c3d4-0000-0000-0000-000000000001',
   'Open Practice',
   'Free practice time with poles and equipment. All levels.',
   null,
   0, '12:00', 120, 20, 'Studio A', 'weekly');

-- Class Instances (next week)
insert into public.class_instances (id, template_id, studio_id, teacher_id, date, start_time, end_time, status, max_capacity, feed_enabled) values
  ('d1b2c3d4-0000-0000-0000-000000000001',
   'c1b2c3d4-0000-0000-0000-000000000001',
   'b1b2c3d4-0000-0000-0000-000000000001',
   'a1b2c3d4-0000-0000-0000-000000000002',
   '2026-03-02', '18:00', '19:00', 'scheduled', 12, true),
  ('d1b2c3d4-0000-0000-0000-000000000002',
   'c1b2c3d4-0000-0000-0000-000000000002',
   'b1b2c3d4-0000-0000-0000-000000000001',
   'a1b2c3d4-0000-0000-0000-000000000002',
   '2026-03-04', '19:00', '20:15', 'scheduled', 10, true),
  ('d1b2c3d4-0000-0000-0000-000000000003',
   'c1b2c3d4-0000-0000-0000-000000000003',
   'b1b2c3d4-0000-0000-0000-000000000001',
   'a1b2c3d4-0000-0000-0000-000000000001',
   '2026-03-07', '10:00', '11:00', 'scheduled', 15, true),
  ('d1b2c3d4-0000-0000-0000-000000000004',
   'c1b2c3d4-0000-0000-0000-000000000004',
   'b1b2c3d4-0000-0000-0000-000000000001',
   null,
   '2026-03-08', '12:00', '14:00', 'scheduled', 20, false),
  -- A past completed class for feed demo
  ('d1b2c3d4-0000-0000-0000-000000000005',
   'c1b2c3d4-0000-0000-0000-000000000001',
   'b1b2c3d4-0000-0000-0000-000000000001',
   'a1b2c3d4-0000-0000-0000-000000000002',
   '2026-02-23', '18:00', '19:00', 'completed', 12, true);

-- Bookings
insert into public.bookings (class_instance_id, user_id, status) values
  ('d1b2c3d4-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000003', 'booked'),
  ('d1b2c3d4-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000004', 'booked'),
  ('d1b2c3d4-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000005', 'booked'),
  ('d1b2c3d4-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000003', 'booked'),
  ('d1b2c3d4-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000003', 'confirmed'),
  ('d1b2c3d4-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000004', 'confirmed');

-- Attendance (for the past completed class)
insert into public.attendance (class_instance_id, user_id, checked_in, checked_in_at, checked_in_by) values
  ('d1b2c3d4-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000003', true, '2026-02-23 17:55:00+00', 'a1b2c3d4-0000-0000-0000-000000000002'),
  ('d1b2c3d4-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000004', true, '2026-02-23 17:58:00+00', 'a1b2c3d4-0000-0000-0000-000000000002');

-- Feed Posts (for the past completed class)
insert into public.feed_posts (class_instance_id, user_id, content, post_type) values
  ('d1b2c3d4-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000003', 'First time nailing the fireman spin! So stoked 🔥', 'post'),
  ('d1b2c3d4-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000004', 'Great class tonight! Love this community.', 'post');
