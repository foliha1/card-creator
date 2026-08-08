-- Shared helper: the set of a player's rows, matched by visitor id OR a linked email.
CREATE OR REPLACE FUNCTION public.daily_rows_for(p_visitor_id text, p_email text)
RETURNS TABLE(puzzle_number integer, rounds_solved integer, total_misses integer, elapsed_ms integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.puzzle_number, d.rounds_solved, d.total_misses, d.elapsed_ms
  FROM public.daily_results d
  WHERE (nullif(trim(coalesce(p_visitor_id, '')), '') IS NOT NULL
         AND d.visitor_id = p_visitor_id)
     OR (nullif(trim(coalesce(p_email, '')), '') IS NOT NULL
         AND d.email = lower(trim(p_email)));
$$;

REVOKE ALL ON FUNCTION public.daily_rows_for(text, text) FROM PUBLIC, anon, authenticated;

-- Streak over the union of visitor rows and email-linked rows.
DROP FUNCTION IF EXISTS public.get_streak(text, integer);

CREATE OR REPLACE FUNCTION public.get_streak(
  p_visitor_id text,
  p_current_puzzle_number integer,
  p_email text DEFAULT NULL
)
RETURNS TABLE(current_streak integer, longest_streak integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur integer := 0;
  v_longest integer := 0;
  v_run integer := 0;
  v_prev integer := NULL;
  v_last integer := NULL;
  r record;
BEGIN
  IF nullif(trim(coalesce(p_visitor_id, '')), '') IS NULL
     AND nullif(trim(coalesce(p_email, '')), '') IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT d.puzzle_number AS n
    FROM public.daily_rows_for(p_visitor_id, p_email) d
    ORDER BY 1 ASC
  LOOP
    IF v_prev IS NOT NULL AND r.n = v_prev + 1 THEN
      v_run := v_run + 1;
    ELSE
      v_run := 1;
    END IF;
    IF v_run > v_longest THEN
      v_longest := v_run;
    END IF;
    v_prev := r.n;
    v_last := r.n;
  END LOOP;

  IF v_last IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  IF p_current_puzzle_number IS NULL OR v_last >= p_current_puzzle_number - 1 THEN
    v_cur := v_run;
  ELSE
    v_cur := 0;
  END IF;

  RETURN QUERY SELECT v_cur, v_longest;
END;
$$;

REVOKE ALL ON FUNCTION public.get_streak(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_streak(text, integer, text) TO anon, authenticated, service_role;

-- Lifetime personal stats, computed in SQL.
CREATE OR REPLACE FUNCTION public.get_daily_stats(
  p_visitor_id text,
  p_email text DEFAULT NULL
)
RETURNS TABLE(
  total_played integer,
  clean_runs integer,
  best_streak integer,
  avg_misses numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_clean integer := 0;
  v_avg numeric := 0;
  v_best integer := 0;
BEGIN
  IF nullif(trim(coalesce(p_visitor_id, '')), '') IS NULL
     AND nullif(trim(coalesce(p_email, '')), '') IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0::numeric;
    RETURN;
  END IF;

  WITH rows AS (
    SELECT DISTINCT d.puzzle_number, d.rounds_solved, d.total_misses
    FROM public.daily_rows_for(p_visitor_id, p_email) d
  )
  SELECT count(*)::integer,
         count(*) FILTER (WHERE rounds_solved >= 3 AND total_misses = 0)::integer,
         round(coalesce(avg(total_misses), 0)::numeric, 2)
  INTO v_total, v_clean, v_avg
  FROM rows;

  SELECT s.longest_streak INTO v_best
  FROM public.get_streak(p_visitor_id, NULL, p_email) s;

  RETURN QUERY SELECT v_total, v_clean, coalesce(v_best, 0), coalesce(v_avg, 0::numeric);
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_stats(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_stats(text, text) TO anon, authenticated, service_role;

-- Percentile for one puzzle. NULL below 20 players — small samples say nothing.
CREATE OR REPLACE FUNCTION public.get_daily_percentile(
  p_visitor_id text,
  p_puzzle_number integer,
  p_email text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_players constant integer := 20;
  v_total integer := 0;
  v_me record;
  v_beat integer := 0;
BEGIN
  IF p_puzzle_number IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(DISTINCT d.visitor_id)::integer INTO v_total
  FROM public.daily_results d
  WHERE d.puzzle_number = p_puzzle_number;

  IF v_total IS NULL OR v_total < v_min_players THEN
    RETURN NULL;
  END IF;

  SELECT d.rounds_solved, d.total_misses, d.elapsed_ms
  INTO v_me
  FROM public.daily_rows_for(p_visitor_id, p_email) d
  WHERE d.puzzle_number = p_puzzle_number
  ORDER BY d.rounds_solved DESC, d.total_misses ASC, d.elapsed_ms ASC
  LIMIT 1;

  IF v_me IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer INTO v_beat
  FROM (
    SELECT DISTINCT ON (d.visitor_id) d.visitor_id, d.rounds_solved, d.total_misses, d.elapsed_ms
    FROM public.daily_results d
    WHERE d.puzzle_number = p_puzzle_number
    ORDER BY d.visitor_id, d.rounds_solved DESC, d.total_misses ASC, d.elapsed_ms ASC
  ) o
  WHERE ROW(v_me.rounds_solved, -v_me.total_misses, -v_me.elapsed_ms)
        >= ROW(o.rounds_solved, -o.total_misses, -o.elapsed_ms);

  RETURN greatest(0, least(100, round((v_beat::numeric / v_total::numeric) * 100)::integer));
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_percentile(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_percentile(text, integer, text) TO anon, authenticated, service_role;