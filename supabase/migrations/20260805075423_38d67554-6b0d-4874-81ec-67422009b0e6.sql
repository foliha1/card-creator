CREATE OR REPLACE FUNCTION public.get_streak(p_visitor_id text, p_current_puzzle_number integer)
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
  IF p_visitor_id IS NULL OR length(trim(p_visitor_id)) = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT d.puzzle_number AS n
    FROM public.daily_results d
    WHERE d.visitor_id = p_visitor_id
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

  -- The current streak only counts if it reaches the current puzzle,
  -- or the one just before it (today not yet played).
  IF p_current_puzzle_number IS NULL OR v_last >= p_current_puzzle_number - 1 THEN
    v_cur := v_run;
  ELSE
    v_cur := 0;
  END IF;

  RETURN QUERY SELECT v_cur, v_longest;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_streak(text, integer) TO anon, authenticated, service_role;