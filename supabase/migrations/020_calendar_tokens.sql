-- Calendar subscription tokens
-- Each user can generate up to 5 tokens to share as iCal feed URLs.
-- Calendar apps poll the public feed endpoint using the token for auth.

CREATE TABLE IF NOT EXISTS calendar_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  label      text DEFAULT 'My Calendar',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Hot lookup: active token → user_id
CREATE INDEX idx_calendar_tokens_active ON calendar_tokens (token) WHERE revoked_at IS NULL;

-- Per-user listing
CREATE INDEX idx_calendar_tokens_user ON calendar_tokens (user_id);

-- RLS
ALTER TABLE calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read/insert/update their own tokens
CREATE POLICY calendar_tokens_select ON calendar_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY calendar_tokens_insert ON calendar_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY calendar_tokens_update ON calendar_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role bypasses RLS (used by public feed endpoint)
