-- Plan 10, Task 2: push_tokens table for Expo push notifications

create table public.push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz default now(),
  unique(user_id, token)
);

create index idx_push_tokens_user on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Users can manage their own tokens
create policy "Users manage own push tokens"
  on public.push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
