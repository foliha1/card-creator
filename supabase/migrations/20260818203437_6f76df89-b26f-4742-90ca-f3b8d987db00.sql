-- Snapshot the pre-change output for a real visitor, so the rebuilt function
-- can be proven byte-identical for visitor-only callers.
CREATE TEMP TABLE _gdr_before AS
  SELECT * FROM public.get_daily_results('1dc0c818-21df-4eb6-8e2f-5fffd8f30e27');

DROP FUNCTION IF EXISTS public.get_daily_results(text);

CREATE OR REPLACE FUNCTION public.get_daily_results(
  p_visitor_id text,
  p_email text DEFAULT NULL
)
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
  SELECT DISTINCT ON (r.puzzle_number)
         r.puzzle_number, r.puzzle_date, r.rounds_solved, r.total_misses,
         r.peek_used, r.round_events, r.elapsed_ms, r.created_at
  FROM public.daily_results r
  WHERE (nullif(trim(coalesce(p_visitor_id, '')), '') IS NOT NULL
         AND r.visitor_id = p_visitor_id)
     OR (nullif(trim(coalesce(p_email, '')), '') IS NOT NULL
         AND r.email = lower(trim(p_email)))
  ORDER BY r.puzzle_number ASC, r.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_daily_results(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_results(text, text) TO anon, authenticated, service_role;

-- Prove the visitor-only path is unchanged: abort the migration otherwise.
DO $$
DECLARE
  v_before integer;
  v_after integer;
  v_diff integer;
BEGIN
  CREATE TEMP TABLE _gdr_after AS
    SELECT * FROM public.get_daily_results('1dc0c818-21df-4eb6-8e2f-5fffd8f30e27');
  SELECT count(*) INTO v_before FROM _gdr_before;
  SELECT count(*) INTO v_after FROM _gdr_after;
  SELECT count(*) INTO v_diff FROM (
    (SELECT * FROM _gdr_before EXCEPT ALL SELECT * FROM _gdr_after)
    UNION ALL
    (SELECT * FROM _gdr_after EXCEPT ALL SELECT * FROM _gdr_before)
  ) d;
  IF v_before <> v_after OR v_diff <> 0 THEN
    RAISE EXCEPTION 'get_daily_results visitor-only output changed: before=% after=% diff=%',
      v_before, v_after, v_diff;
  END IF;
  RAISE NOTICE 'get_daily_results unchanged for visitor-only call: % rows', v_after;
END;
$$;

DROP TABLE IF EXISTS _gdr_before;
DROP TABLE IF EXISTS _gdr_after;