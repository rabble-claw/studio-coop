-- Migration 026: AI-powered studio intelligence tables
-- Member risk scores, outreach messages, weekly briefs, onboarding sequences

-- Member risk scores (computed daily by cron)
CREATE TABLE member_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES studios(id) NOT NULL,
  user_id uuid NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  factors jsonb NOT NULL DEFAULT '{}',
  stage text NOT NULL DEFAULT 'none'
    CHECK (stage IN ('none','gentle_nudge','we_miss_you','incentive','final')),
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_scores_studio ON member_risk_scores(studio_id, score DESC);
CREATE INDEX idx_risk_scores_user ON member_risk_scores(studio_id, user_id);

-- Outreach messages (drafted by LLM, sent by owner)
CREATE TABLE outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES studios(id) NOT NULL,
  user_id uuid NOT NULL,
  stage text NOT NULL,
  subject text,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','sent','skipped')),
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Weekly briefs (one per studio per week)
CREATE TABLE weekly_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES studios(id) NOT NULL,
  week_start date NOT NULL,
  data jsonb NOT NULL,
  narrative text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(studio_id, week_start)
);

-- Onboarding sequences
CREATE TABLE onboarding_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES studios(id) NOT NULL,
  user_id uuid NOT NULL,
  step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','paused')),
  started_at timestamptz DEFAULT now(),
  last_step_at timestamptz,
  completed_at timestamptz,
  UNIQUE(studio_id, user_id)
);

-- RLS policies (service role for cron, staff for reads)
ALTER TABLE member_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON member_risk_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON outreach_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON weekly_briefs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON onboarding_sequences FOR ALL USING (true) WITH CHECK (true);
