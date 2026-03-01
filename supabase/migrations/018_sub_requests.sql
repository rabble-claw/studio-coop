-- Sub requests: teachers can request substitutes for classes they can't teach
CREATE TABLE public.sub_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_instance_id uuid NOT NULL REFERENCES public.class_instances(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  requesting_teacher_id uuid NOT NULL REFERENCES public.users(id),
  substitute_teacher_id uuid REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'cancelled', 'expired')),
  reason text,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(class_instance_id)
);

CREATE INDEX idx_sub_requests_studio ON public.sub_requests(studio_id, status);
CREATE INDEX idx_sub_requests_teacher ON public.sub_requests(requesting_teacher_id);
