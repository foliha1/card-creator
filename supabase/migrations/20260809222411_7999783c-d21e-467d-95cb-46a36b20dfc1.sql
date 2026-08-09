CREATE TABLE public.daily_results_scratch (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  puzzle_number integer NOT NULL,
  puzzle_date date NOT NULL,
  rounds_solved integer NOT NULL DEFAULT 0,
  total_misses integer NOT NULL DEFAULT 0,
  peek_used boolean NOT NULL DEFAULT false,
  round_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  elapsed_ms integer NOT NULL DEFAULT 0,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.daily_results_scratch TO service_role;

ALTER TABLE public.daily_results_scratch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read restore scratch"
ON public.daily_results_scratch FOR SELECT TO authenticated
USING (public.is_admin());