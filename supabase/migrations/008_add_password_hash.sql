-- Migration 008: Add password_hash to users & expand studio disciplines
-- The custom JWT auth in lib/auth.ts needs password_hash on the users table.
-- The setup wizard offers disciplines beyond the original check constraint.

-- 1. Add password_hash column (nullable — existing users may use magic link / Supabase Auth)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

-- 2. Expand the discipline check constraint to include all wizard options
ALTER TABLE studios DROP CONSTRAINT IF EXISTS studios_discipline_check;
ALTER TABLE studios ADD CONSTRAINT studios_discipline_check
  CHECK (discipline IN (
    'pole', 'bjj', 'yoga', 'crossfit', 'cycling', 'pilates', 'dance', 'aerial', 'general',
    'boxing', 'barre', 'fitness', 'wellness', 'martial_arts', 'other'
  ));
