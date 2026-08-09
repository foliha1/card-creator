-- normalise stored admin emails
CREATE OR REPLACE FUNCTION public.normalize_admin_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_allowlist_normalize_email ON public.admin_allowlist;
CREATE TRIGGER admin_allowlist_normalize_email
BEFORE INSERT OR UPDATE ON public.admin_allowlist
FOR EACH ROW EXECUTE FUNCTION public.normalize_admin_email();

UPDATE public.admin_allowlist SET email = lower(trim(email)) WHERE email <> lower(trim(email));

CREATE UNIQUE INDEX IF NOT EXISTS admin_allowlist_email_key ON public.admin_allowlist (email);

INSERT INTO public.admin_allowlist (email)
VALUES ('alyssa@oleeha.co'), ('felix@oleeha.co'), ('makenzie@oleeha.co')
ON CONFLICT (email) DO NOTHING;

-- headline metrics
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
    SELECT visitor_id, min(puzzle_date) AS first_day, max(puzzle_date) AS last_day,
           count(DISTINCT puzzle_date) AS days
    FROM public.daily_results
    GROUP BY visitor_id
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
    SELECT puzzle_date AS d, count(DISTINCT visitor_id)::numeric AS n
    FROM public.daily_results
    WHERE puzzle_date BETWEEN p_from AND p_to
    GROUP BY 1
  ),
  ev AS (
    SELECT
      count(*) FILTER (WHERE event = 'share_clicked')::integer AS shares,
      count(*) FILTER (WHERE event = 'run_finished')::integer AS finished
    FROM public.daily_events
    WHERE created_at >= p_from::timestamptz AND created_at < (p_to + 1)::timestamptz
  )
  SELECT
    (SELECT count(*)::integer FROM players),
    coalesce((SELECT n::integer FROM daily WHERE d = (now() AT TIME ZONE 'utc')::date), 0),
    coalesce((SELECT round(avg(n), 1) FROM daily), 0::numeric),
    CASE WHEN (SELECT count(*) FROM players) = 0 THEN NULL
         ELSE round((SELECT count(*) FILTER (WHERE days > 1) FROM players)::numeric
                    / (SELECT count(*) FROM players)::numeric * 100, 1) END,
    (SELECT count(*)::integer FROM players),
    CASE WHEN (SELECT count(*) FROM d7) = 0 THEN NULL
         ELSE round((SELECT count(*) FILTER (WHERE came_back) FROM d7)::numeric
                    / (SELECT count(*) FROM d7)::numeric * 100, 1) END,
    (SELECT count(*)::integer FROM d7),
    (SELECT count(*)::integer FROM public.daily_subscribers),
    CASE WHEN (SELECT finished FROM ev) = 0 THEN NULL
         ELSE round((SELECT shares FROM ev)::numeric / (SELECT finished FROM ev)::numeric * 100, 1) END,
    (SELECT shares FROM ev),
    (SELECT finished FROM ev);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_headline(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_headline(date, date) TO authenticated;