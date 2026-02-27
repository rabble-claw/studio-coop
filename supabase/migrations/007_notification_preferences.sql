-- Studio Co-op: Member Notification Preferences (Plan 10, Task 7)
-- Per-user preferences for notification channels and types

-- ============================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  push boolean not null default true,
  email boolean not null default true,
  reminders boolean not null default true,
  feed boolean not null default true,
  marketing boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_notification_preferences_user on public.notification_preferences(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.notification_preferences enable row level security;

-- Users can read their own preferences
create policy "Users can read own notification preferences"
  on public.notification_preferences for select
  using (user_id = auth.uid());

-- Users can insert their own preferences
create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert
  with check (user_id = auth.uid());

-- Users can update their own preferences
create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (user_id = auth.uid());
