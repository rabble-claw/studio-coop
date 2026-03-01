-- 019: Financial Planner tables
-- expense_categories, studio_expenses, instructor_compensation, financial_snapshots

-- ─────────────────────────────────────────────────────────────────────────────
-- expense_categories — reference table with seeded categories
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expense_categories (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT '📦',
  sort_order int  NOT NULL DEFAULT 0
);

INSERT INTO expense_categories (id, name, icon, sort_order) VALUES
  ('rent',            'Rent / Lease',        '🏠', 1),
  ('instructor_pay',  'Instructor Pay',      '👩‍🏫', 2),
  ('utilities',       'Utilities',           '💡', 3),
  ('insurance',       'Insurance',           '🛡️', 4),
  ('equipment',       'Equipment',           '🏋️', 5),
  ('maintenance',     'Maintenance',         '🔧', 6),
  ('marketing',       'Marketing',           '📣', 7),
  ('software',        'Software / SaaS',     '💻', 8),
  ('cleaning',        'Cleaning',            '🧹', 9),
  ('music_licensing',  'Music Licensing',    '🎵', 10),
  ('supplies',        'Supplies',            '📦', 11),
  ('professional',    'Professional Fees',   '📋', 12),
  ('loan_payment',    'Loan Payment',        '🏦', 13),
  ('flooring',        'Flooring / Mats',     '🟫', 14),
  ('other',           'Other',               '📝', 15)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- studio_expenses — recurring and one-off expenses per studio
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  category_id text NOT NULL REFERENCES expense_categories(id),
  name        text NOT NULL,
  amount_cents int NOT NULL CHECK (amount_cents >= 0),
  currency    text NOT NULL DEFAULT 'NZD',
  recurrence  text NOT NULL DEFAULT 'monthly'
                CHECK (recurrence IN ('once','weekly','biweekly','monthly','quarterly','yearly')),
  start_date  date NOT NULL DEFAULT CURRENT_DATE,
  end_date    date,
  notes       text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_studio_expenses_studio   ON studio_expenses(studio_id);
CREATE INDEX idx_studio_expenses_category ON studio_expenses(category_id);
CREATE INDEX idx_studio_expenses_dates    ON studio_expenses(start_date, end_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- instructor_compensation — pay structure per instructor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instructor_compensation (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instructor_id         uuid NOT NULL REFERENCES auth.users(id),
  comp_type             text NOT NULL CHECK (comp_type IN ('per_class','monthly_salary','revenue_share','hybrid')),
  per_class_rate_cents  int DEFAULT 0,
  monthly_salary_cents  int DEFAULT 0,
  revenue_share_percent numeric(5,2) DEFAULT 0,
  effective_from        date NOT NULL DEFAULT CURRENT_DATE,
  effective_until       date,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_instructor_comp_unique
  ON instructor_compensation(studio_id, instructor_id, effective_from);
CREATE INDEX idx_instructor_comp_instructor
  ON instructor_compensation(instructor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- financial_snapshots — monthly roll-up for P&L / trends
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  month                 text NOT NULL,  -- 'YYYY-MM'
  revenue_cents         int NOT NULL DEFAULT 0,
  revenue_breakdown     jsonb NOT NULL DEFAULT '{}',
  expenses_cents        int NOT NULL DEFAULT 0,
  expense_breakdown     jsonb NOT NULL DEFAULT '{}',
  instructor_costs_cents int NOT NULL DEFAULT 0,
  net_income_cents      int NOT NULL DEFAULT 0,
  active_members        int NOT NULL DEFAULT 0,
  classes_held          int NOT NULL DEFAULT 0,
  computed_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_financial_snapshots_unique
  ON financial_snapshots(studio_id, month);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;

-- expense_categories: public read
CREATE POLICY "expense_categories_public_read"
  ON expense_categories FOR SELECT
  USING (true);

-- studio_expenses: staff can read, admin can write
CREATE POLICY "studio_expenses_staff_read"
  ON studio_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = studio_expenses.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('teacher','admin','owner')
    )
  );

CREATE POLICY "studio_expenses_admin_insert"
  ON studio_expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = studio_expenses.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('admin','owner')
    )
  );

CREATE POLICY "studio_expenses_admin_update"
  ON studio_expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = studio_expenses.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('admin','owner')
    )
  );

CREATE POLICY "studio_expenses_admin_delete"
  ON studio_expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = studio_expenses.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('admin','owner')
    )
  );

-- instructor_compensation: staff read, admin write, instructors read own
CREATE POLICY "instructor_comp_staff_read"
  ON instructor_compensation FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = instructor_compensation.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('teacher','admin','owner')
    )
    OR instructor_compensation.instructor_id = auth.uid()
  );

CREATE POLICY "instructor_comp_admin_insert"
  ON instructor_compensation FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = instructor_compensation.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('admin','owner')
    )
  );

CREATE POLICY "instructor_comp_admin_update"
  ON instructor_compensation FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = instructor_compensation.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('admin','owner')
    )
  );

CREATE POLICY "instructor_comp_admin_delete"
  ON instructor_compensation FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = instructor_compensation.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('admin','owner')
    )
  );

-- financial_snapshots: staff read, admin write
CREATE POLICY "financial_snapshots_staff_read"
  ON financial_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = financial_snapshots.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('teacher','admin','owner')
    )
  );

CREATE POLICY "financial_snapshots_admin_insert"
  ON financial_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = financial_snapshots.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('admin','owner')
    )
  );

CREATE POLICY "financial_snapshots_admin_update"
  ON financial_snapshots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.studio_id = financial_snapshots.studio_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
        AND memberships.role IN ('admin','owner')
    )
  );
