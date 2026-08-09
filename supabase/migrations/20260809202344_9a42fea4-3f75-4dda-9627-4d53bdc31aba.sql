-- 1. allowlist table
CREATE TABLE public.admin_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_allowlist TO service_role;
-- no anon/authenticated grants: the table is read only by security-definer functions

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
-- intentionally no policies: all access goes through security-definer RPCs

INSERT INTO public.admin_allowlist (email) VALUES ('felixfoliha@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 2. allowlist guard
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_allowlist a
    WHERE a.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      AND coalesce(auth.jwt() ->> 'email', '') <> ''
  )
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 3. funnel
CREATE OR REPLACE FUNCTION public.admin_funnel(p_from date, p_to date)
RETURNS TABLE(
  ready_viewed integer, run_started integer, run_finished integer,
  run_abandoned integer, shared integer, subscribed integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
  WITH e AS (
    SELECT event, visitor_id FROM public.daily_events
    WHERE created_at >= p_from::timestamptz
      AND created_at < (p_to + 1)::timestamptz
  )
  SELECT
    count(DISTINCT visitor_id) FILTER (WHERE event = 'ready_viewed')::integer,
    count(*) FILTER (WHERE event = 'run_started')::integer,
    count(*) FILTER (WHERE event = 'run_finished')::integer,
    count(*) FILTER (WHERE event = 'run_abandoned')::integer,
    count(*) FILTER (WHERE event = 'share_clicked')::integer,
    count(*) FILTER (WHERE event = 'subscribe_submitted')::integer
  FROM e;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_funnel(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_funnel(date, date) TO authenticated, service_role;

-- 4. difficulty: solve rate + avg misses per round
CREATE OR REPLACE FUNCTION public.admin_difficulty(p_from date, p_to date)
RETURNS TABLE(round integer, solved integer, failed integer, solve_rate numeric, avg_misses numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
  WITH e AS (
    SELECT d.event,
           nullif(d.props ->> 'round', '')::integer AS rnd,
           nullif(d.props ->> 'misses', '')::numeric AS misses
    FROM public.daily_events d
    WHERE d.created_at >= p_from::timestamptz
      AND d.created_at < (p_to + 1)::timestamptz
      AND d.event IN ('round_solved', 'round_failed')
  )
  SELECT r.n::integer,
         count(*) FILTER (WHERE e.event = 'round_solved')::integer,
         count(*) FILTER (WHERE e.event = 'round_failed')::integer,
         CASE WHEN count(e.event) = 0 THEN 0::numeric
              ELSE round((count(*) FILTER (WHERE e.event = 'round_solved'))::numeric
                         / count(e.event)::numeric * 100, 1) END,
         round(coalesce(avg(e.misses), 0)::numeric, 2)
  FROM (VALUES (1), (2), (3)) AS r(n)
  LEFT JOIN e ON e.rnd = r.n
  GROUP BY r.n
  ORDER BY r.n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_difficulty(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_difficulty(date, date) TO authenticated, service_role;

-- 5. how to play
CREATE OR REPLACE FUNCTION public.admin_howto(p_from date, p_to date)
RETURNS TABLE(opened integer, finished integer, skipped integer, skip_slide integer, skip_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
  WITH e AS (
    SELECT d.event, nullif(d.props ->> 'slide', '')::integer AS slide
    FROM public.daily_events d
    WHERE d.created_at >= p_from::timestamptz
      AND d.created_at < (p_to + 1)::timestamptz
      AND d.event IN ('howto_opened', 'howto_finished', 'howto_skipped')
  ),
  totals AS (
    SELECT count(*) FILTER (WHERE event = 'howto_opened')::integer AS o,
           count(*) FILTER (WHERE event = 'howto_finished')::integer AS f,
           count(*) FILTER (WHERE event = 'howto_skipped')::integer AS s
    FROM e
  ),
  slides AS (
    SELECT e.slide AS sl, count(*)::integer AS c
    FROM e WHERE e.event = 'howto_skipped' AND e.slide IS NOT NULL
    GROUP BY e.slide
  )
  SELECT t.o, t.f, t.s, s.sl, s.c
  FROM totals t LEFT JOIN slides s ON true
  ORDER BY s.c DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_howto(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_howto(date, date) TO authenticated, service_role;

-- 6. attribution
CREATE OR REPLACE FUNCTION public.admin_attribution(p_from date, p_to date)
RETURNS TABLE(kind text, source text, visitors integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
  WITH e AS (
    SELECT d.visitor_id, d.referrer, d.utm_source
    FROM public.daily_events d
    WHERE d.created_at >= p_from::timestamptz
      AND d.created_at < (p_to + 1)::timestamptz
  )
  SELECT 'referrer'::text, coalesce(nullif(trim(e.referrer), ''), 'direct'),
         count(DISTINCT e.visitor_id)::integer
  FROM e GROUP BY 2
  UNION ALL
  SELECT 'utm_source'::text, coalesce(nullif(trim(e.utm_source), ''), 'none'),
         count(DISTINCT e.visitor_id)::integer
  FROM e GROUP BY 2
  ORDER BY 1, 3 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_attribution(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_attribution(date, date) TO authenticated, service_role;

-- 7. daily trend
CREATE OR REPLACE FUNCTION public.admin_trend(p_from date, p_to date)
RETURNS TABLE(day date, runs_finished integer, runs_started integer, results_saved integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS d
  ),
  ev AS (
    SELECT (created_at)::date AS d, event
    FROM public.daily_events
    WHERE created_at >= p_from::timestamptz AND created_at < (p_to + 1)::timestamptz
  ),
  res AS (
    SELECT puzzle_date AS d, count(*)::integer AS c
    FROM public.daily_results
    WHERE puzzle_date BETWEEN p_from AND p_to
    GROUP BY 1
  )
  SELECT days.d,
         count(*) FILTER (WHERE ev.event = 'run_finished')::integer,
         count(*) FILTER (WHERE ev.event = 'run_started')::integer,
         coalesce(max(res.c), 0)::integer
  FROM days
  LEFT JOIN ev ON ev.d = days.d
  LEFT JOIN res ON res.d = days.d
  GROUP BY days.d
  ORDER BY days.d;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_trend(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_trend(date, date) TO authenticated, service_role;

-- 8. subscriber list
CREATE OR REPLACE FUNCTION public.admin_subscribers()
RETURNS TABLE(source text, total integer, synced integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT s.source, count(*)::integer,
         count(*) FILTER (WHERE s.synced_to_ac)::integer
  FROM public.daily_subscribers s
  GROUP BY s.source
  ORDER BY 2 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_subscribers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_subscribers() TO authenticated, service_role;