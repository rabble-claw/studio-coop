-- Skill definitions per studio (customizable)
CREATE TABLE public.skill_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(studio_id, name)
);

-- Member skill progress
CREATE TABLE public.member_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'learning' CHECK (level IN ('learning', 'practicing', 'confident', 'mastered')),
  notes text,
  verified_by uuid REFERENCES public.users(id),
  verified_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_member_skills_user ON public.member_skills(user_id, studio_id);
CREATE INDEX idx_skill_definitions_studio ON public.skill_definitions(studio_id);
