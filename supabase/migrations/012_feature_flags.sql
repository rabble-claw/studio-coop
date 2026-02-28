-- Studio Co-op: Migration 012 — Feature Flags
-- L5: Persistent feature flag system with global, studio, and plan-tier scoping

-- ============================================================
-- Feature flags table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'studio', 'plan_tier')),
  studio_id uuid REFERENCES studios(id) ON DELETE CASCADE,
  plan_tier text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (name, scope, studio_id, plan_tier)
);

-- Index for fast lookups by name + scope
CREATE INDEX IF NOT EXISTS feature_flags_name_scope_idx ON public.feature_flags (name, scope);

-- Index for studio-scoped flag lookups
CREATE INDEX IF NOT EXISTS feature_flags_studio_id_idx ON public.feature_flags (studio_id) WHERE studio_id IS NOT NULL;

-- ============================================================
-- Seed default global flags
-- ============================================================
INSERT INTO public.feature_flags (name, description, enabled, scope) VALUES
  ('waitlist', 'Enable class waitlist functionality', true, 'global'),
  ('network', 'Enable multi-studio network features', true, 'global'),
  ('private_bookings', 'Enable private booking requests', true, 'global'),
  ('feed', 'Enable studio feed/social features', true, 'global'),
  ('migration_tool', 'Enable Mindbody/Vagaro migration wizard', true, 'global'),
  ('stripe_payments', 'Enable Stripe payment processing', true, 'global'),
  ('mobile_checkin', 'Enable mobile check-in for teachers', true, 'global'),
  ('governance', 'Enable co-op governance features', false, 'global')
ON CONFLICT (name, scope, studio_id, plan_tier) DO NOTHING;
