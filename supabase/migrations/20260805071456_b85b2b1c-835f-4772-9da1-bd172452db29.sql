CREATE TABLE public.daily_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  puzzle_number integer NOT NULL,
  puzzle_date date NOT NULL,
  rounds_solved integer NOT NULL DEFAULT 0 CHECK (rounds_solved BETWEEN 0 AND 3),
  total_misses integer NOT NULL DEFAULT 0 CHECK (total_misses >= 0),
  peek_used boolean NOT NULL DEFAULT false,
  round_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  elapsed_ms integer NOT NULL DEFAULT 0 CHECK (elapsed_ms >= 0),
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_results_visitor_puzzle_key UNIQUE (visitor_id, puzzle_number)
);

GRANT ALL ON public.daily_results TO service_role;

ALTER TABLE public.daily_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX daily_results_visitor_idx ON public.daily_results (visitor_id, puzzle_number);

CREATE OR REPLACE FUNCTION public.save_daily_result(
  p_visitor_id text,
  p_puzzle_number integer,
  p_puzzle_date date,
  p_rounds_solved integer,
  p_total_misses integer,
  p_peek_used boolean,
  p_round_events jsonb,
  p_elapsed_ms integer,
  p_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF p_visitor_id IS NULL OR length(trim(p_visitor_id)) = 0 THEN
    RETURN false;
  END IF;
  IF p_puzzle_number IS NULL OR p_puzzle_number < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.daily_results (
    visitor_id, puzzle_number, puzzle_date, rounds_solved,
    total_misses, peek_used, round_events, elapsed_ms, email
  ) VALUES (
    p_visitor_id,
    p_puzzle_number,
    coalesce(p_puzzle_date, (now() AT TIME ZONE 'utc')::date),
    least(greatest(coalesce(p_rounds_solved, 0), 0), 3),
    greatest(coalesce(p_total_misses, 0), 0),
    coalesce(p_peek_used, false),
    coalesce(p_round_events, '[]'::jsonb),
    greatest(coalesce(p_elapsed_ms, 0), 0),
    nullif(trim(coalesce(p_email, '')), '')
  )
  ON CONFLICT (visitor_id, puzzle_number) DO NOTHING;

  v_inserted := FOUND;
  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_results(p_visitor_id text)
RETURNS TABLE(
  puzzle_number integer,
  puzzle_date date,
  rounds_solved integer,
  total_misses integer,
  peek_used boolean,
  round_events jsonb,
  elapsed_ms integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.puzzle_number, r.puzzle_date, r.rounds_solved, r.total_misses,
         r.peek_used, r.round_events, r.elapsed_ms, r.created_at
  FROM public.daily_results r
  WHERE r.visitor_id = p_visitor_id
  ORDER BY r.puzzle_number ASC;
$$;

GRANT EXECUTE ON FUNCTION public.save_daily_result(text, integer, date, integer, integer, boolean, jsonb, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_results(text) TO anon, authenticated;