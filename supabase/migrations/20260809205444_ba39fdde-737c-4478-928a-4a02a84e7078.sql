CREATE OR REPLACE FUNCTION public.admin_headline(p_from date, p_to date)
RETURNS TABLE(
  total_players integer,
  dau_today integer,
  dau_avg numeric,
  returning_pct numeric,
  returning_eligible integer,
  d7_pct numeric,
  d7_eligible integer,
  subscribers integer,
  share_rate numeric,
  shares integer,
  runs_finished integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;

  RETURN QUERY
  WITH players AS (
    SELECT r.visitor_id, min(r.puzzle_date) AS first_day,
           count(DISTINCT r.puzzle_date) AS n_days
    FROM public.daily_results r
    GROUP BY r.visitor_id
  ),
  d7 AS (
    SELECT p.visitor_id,
           EXISTS (
             SELECT 1 FROM public.daily_results r
             WHERE r.visitor_id = p.visitor_id
               AND r.puzzle_date >= p.first_day + 7
           ) AS came_back
    FROM players p
    WHERE p.first_day <= (now() AT TIME ZONE 'utc')::date - 7
  ),
  daily AS (
    SELECT r.puzzle_date AS d, count(DISTINCT r.visitor_id)::numeric AS n
    FROM public.daily_results r
    WHERE r.puzzle_date BETWEEN p_from AND p_to
    GROUP BY 1
  ),
  ev AS (
    SELECT
      count(*) FILTER (WHERE e.event = 'share_clicked')::integer AS n_shares,
      count(*) FILTER (WHERE e.event = 'run_finished')::integer AS n_finished
    FROM public.daily_events e
    WHERE e.created_at >= p_from::timestamptz AND e.created_at < (p_to + 1)::timestamptz
  )
  SELECT
    (SELECT count(*)::integer FROM players),
    coalesce((SELECT d.n::integer FROM daily d WHERE d.d = (now() AT TIME ZONE 'utc')::date), 0),
    coalesce((SELECT round(avg(d.n), 1) FROM daily d), 0::numeric),
    CASE WHEN (SELECT count(*) FROM players) = 0 THEN NULL
         ELSE round((SELECT count(*) FROM players p WHERE p.n_days > 1)::numeric
                    / (SELECT count(*) FROM players)::numeric * 100, 1) END,
    (SELECT count(*)::integer FROM players),
    CASE WHEN (SELECT count(*) FROM d7) = 0 THEN NULL
         ELSE round((SELECT count(*) FROM d7 x WHERE x.came_back)::numeric
                    / (SELECT count(*) FROM d7)::numeric * 100, 1) END,
    (SELECT count(*)::integer FROM d7),
    (SELECT count(*)::integer FROM public.daily_subscribers),
    CASE WHEN (SELECT ev.n_finished FROM ev) = 0 THEN NULL
         ELSE round((SELECT ev.n_shares FROM ev)::numeric
                    / (SELECT ev.n_finished FROM ev)::numeric * 100, 1) END,
    (SELECT ev.n_shares FROM ev),
    (SELECT ev.n_finished FROM ev);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_headline(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_headline(date, date) TO authenticated;