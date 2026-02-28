-- Studio Co-op: Migration 011 — Governance System
-- Board members, proposals, votes, meetings, agenda items, equity holdings

-- ============================================================
-- Board Members
-- ============================================================
create table public.board_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  studio_id uuid references public.studios(id),
  role text not null check (role in ('chair', 'secretary', 'treasurer', 'member')),
  term_start date not null,
  term_end date,
  elected_at timestamptz default now(),
  status text not null default 'active' check (status in ('active', 'completed', 'resigned')),
  created_at timestamptz default now()
);

create index idx_board_members_user on public.board_members(user_id);
create index idx_board_members_status on public.board_members(status);

-- ============================================================
-- Proposals
-- ============================================================
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  proposed_by uuid not null references public.users(id),
  status text not null default 'draft' check (status in ('draft', 'open', 'passed', 'failed', 'withdrawn', 'amended')),
  vote_start timestamptz,
  vote_end timestamptz,
  quorum_required integer default 50,
  pass_threshold integer default 66,
  category text check (category in ('policy', 'financial', 'membership', 'technical', 'amendment', 'other')),
  parent_proposal_id uuid references public.proposals(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_proposals_status on public.proposals(status);
create index idx_proposals_proposed_by on public.proposals(proposed_by);
create index idx_proposals_parent on public.proposals(parent_proposal_id) where parent_proposal_id is not null;

-- ============================================================
-- Votes (one vote per studio per proposal)
-- ============================================================
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  studio_id uuid not null references public.studios(id),
  vote text not null check (vote in ('yes', 'no', 'abstain')),
  voted_by uuid not null references public.users(id),
  voted_at timestamptz default now(),
  unique (proposal_id, studio_id)
);

create index idx_votes_proposal on public.votes(proposal_id);

-- ============================================================
-- Meetings
-- ============================================================
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date timestamptz not null,
  location text,
  minutes_text text,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  recorded_by uuid references public.users(id),
  created_at timestamptz default now()
);

create index idx_meetings_date on public.meetings(meeting_date desc);
create index idx_meetings_status on public.meetings(status);

-- ============================================================
-- Meeting Agenda Items
-- ============================================================
create table public.meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  proposal_id uuid references public.proposals(id),
  outcome text,
  created_at timestamptz default now()
);

create index idx_agenda_meeting on public.meeting_agenda_items(meeting_id);

-- ============================================================
-- Equity Holdings
-- ============================================================
create table public.equity_holdings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id),
  shares integer not null default 1,
  share_class text not null default 'common' check (share_class in ('common', 'preferred', 'founding')),
  acquired_at timestamptz default now(),
  notes text,
  unique (studio_id, share_class)
);

create index idx_equity_studio on public.equity_holdings(studio_id);

-- ============================================================
-- RLS Policies
-- ============================================================
alter table public.board_members enable row level security;
alter table public.proposals enable row level security;
alter table public.votes enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_agenda_items enable row level security;
alter table public.equity_holdings enable row level security;

-- Board members: anyone authenticated can read, only service role writes
create policy board_members_select on public.board_members for select
  using (true);

-- Proposals: anyone authenticated can read, proposer can insert/update their own drafts
create policy proposals_select on public.proposals for select
  using (true);

create policy proposals_insert on public.proposals for insert
  with check (proposed_by = auth.uid());

create policy proposals_update_own on public.proposals for update
  using (proposed_by = auth.uid() and status = 'draft');

-- Votes: anyone can read, one vote per studio (checked by unique constraint)
create policy votes_select on public.votes for select
  using (true);

create policy votes_insert on public.votes for insert
  with check (voted_by = auth.uid());

-- Meetings: anyone can read
create policy meetings_select on public.meetings for select
  using (true);

create policy meetings_insert on public.meetings for insert
  with check (recorded_by = auth.uid());

-- Agenda items: anyone can read
create policy agenda_items_select on public.meeting_agenda_items for select
  using (true);

-- Equity: anyone can read
create policy equity_select on public.equity_holdings for select
  using (true);
