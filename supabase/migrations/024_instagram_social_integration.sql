-- Studio Co-op: Migration 024 — Instagram OAuth + media ingestion
-- Purpose:
--   1) Store OAuth-connected social accounts per studio (initial provider: instagram)
--   2) Persist imported social media records for public marketing pages
--   3) Track short-lived OAuth state tokens for secure callback handling

-- ============================================================
-- TABLE: studio_social_accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.studio_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('instagram')),
  provider_account_id text NOT NULL,
  provider_username text,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  last_synced_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_studio_social_accounts_studio_provider
  ON public.studio_social_accounts (studio_id, provider);

CREATE INDEX IF NOT EXISTS idx_studio_social_accounts_status
  ON public.studio_social_accounts (status, token_expires_at);

-- ============================================================
-- TABLE: studio_social_media
-- ============================================================

CREATE TABLE IF NOT EXISTS public.studio_social_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.studio_social_accounts(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('instagram')),
  provider_media_id text NOT NULL,
  owner_provider_account_id text,
  owner_display_name text,
  caption text,
  permalink_url text NOT NULL,
  media_type text,
  media_url text,
  thumbnail_url text,
  published_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_media_id)
);

CREATE INDEX IF NOT EXISTS idx_studio_social_media_studio_published
  ON public.studio_social_media (studio_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_social_media_account
  ON public.studio_social_media (social_account_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_social_media_active
  ON public.studio_social_media (studio_id, is_active);

-- ============================================================
-- TABLE: studio_teacher_social_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.studio_teacher_social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  teacher_name text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('instagram')),
  provider_username text NOT NULL,
  profile_url text NOT NULL,
  social_account_id uuid REFERENCES public.studio_social_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, provider, provider_username)
);

CREATE INDEX IF NOT EXISTS idx_studio_teacher_social_profiles_studio
  ON public.studio_teacher_social_profiles (studio_id, provider);

-- ============================================================
-- TABLE: studio_social_oauth_states
-- ============================================================

CREATE TABLE IF NOT EXISTS public.studio_social_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('instagram')),
  state_token text NOT NULL UNIQUE,
  redirect_path text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_social_oauth_states_expiry
  ON public.studio_social_oauth_states (provider, expires_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.studio_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_social_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_teacher_social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_social_oauth_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'studio_social_accounts'
      AND policyname = 'Staff can view studio social accounts'
  ) THEN
    CREATE POLICY "Staff can view studio social accounts"
      ON public.studio_social_accounts FOR SELECT
      USING (public.is_studio_staff(studio_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'studio_teacher_social_profiles'
      AND policyname = 'Public can view teacher social profiles'
  ) THEN
    CREATE POLICY "Public can view teacher social profiles"
      ON public.studio_teacher_social_profiles FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'studio_social_media'
      AND policyname = 'Public can view active studio social media'
  ) THEN
    CREATE POLICY "Public can view active studio social media"
      ON public.studio_social_media FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'studio_teacher_social_profiles'
      AND policyname = 'Staff can view studio teacher social profiles'
  ) THEN
    CREATE POLICY "Staff can view studio teacher social profiles"
      ON public.studio_teacher_social_profiles FOR SELECT
      USING (public.is_studio_staff(studio_id));
  END IF;
END $$;
