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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  class_instance_id uuid not null references public.class_instances(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  checked_in boolean default false,
  checked_in_at timestamptz,
  checked_in_by uuid references public.users(id),
  walk_in boolean default false
);

-- Feed Posts (class community feed)
create table public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  class_instance_id uuid not null references public.class_instances(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text,
  media_urls text[] default '{}',
  post_type text default 'post' check (post_type in ('post','achievement','milestone','auto')),
  created_at timestamptz default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
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
-- SEED DATA: See supabase/seed.sql for demo data
-- ============================================================
