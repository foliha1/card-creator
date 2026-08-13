CREATE OR REPLACE FUNCTION public.admin_next_day_return()
RETURNS TABLE(
  base_puzzle integer,
  next_puzzle integer,
  visitor_base integer,
  visitor_returned integer,
  visitor_pct numeric,
  email_base integer,
  email_returned integer,
  email_pct numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next integer;
  v_base integer;
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;

  SELECT max(r.puzzle_number) INTO v_next
  FROM public.daily_results r
  WHERE r.puzzle_date < (now() AT TIME ZONE 'utc')::date;

  IF v_next IS NULL THEN RETURN; END IF;
  v_base := v_next - 1;

  IF NOT EXISTS (SELECT 1 FROM public.daily_results r WHERE r.puzzle_number = v_base) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base_v AS (
    SELECT DISTINCT r.visitor_id FROM public.daily_results r WHERE r.puzzle_number = v_base
  ),
  next_v AS (
    SELECT DISTINCT r.visitor_id FROM public.daily_results r WHERE r.puzzle_number = v_next
  ),
  base_e AS (
    SELECT DISTINCT lower(r.email) AS em FROM public.daily_results r
    WHERE r.puzzle_number = v_base AND r.email IS NOT NULL
  ),
  next_e AS (
    SELECT DISTINCT lower(r.email) AS em FROM public.daily_results r
    WHERE r.puzzle_number = v_next AND r.email IS NOT NULL
  ),
  agg AS (
    SELECT
      (SELECT count(*) FROM base_v)::integer AS vb,
      (SELECT count(*) FROM base_v b JOIN next_v n USING (visitor_id))::integer AS vr,
      (SELECT count(*) FROM base_e)::integer AS eb,
      (SELECT count(*) FROM base_e b JOIN next_e n USING (em))::integer AS er
  )
  SELECT v_base, v_next,
         a.vb, a.vr,
         CASE WHEN a.vb = 0 THEN NULL ELSE round(a.vr::numeric / a.vb::numeric * 100, 1) END,
         a.eb, a.er,
         CASE WHEN a.eb = 0 THEN NULL ELSE round(a.er::numeric / a.eb::numeric * 100, 1) END
  FROM agg a;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_next_day_return() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_next_day_return() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_next_day_return() TO authenticated;