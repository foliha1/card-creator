CREATE OR REPLACE FUNCTION public.admin_backup_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_latest_day date;
  v_prev_day date;
  v_first_day date;
  v_window_start date;
  v_last_ok timestamptz;
  v_nights jsonb;
  v_tables jsonb;
  v_bytes bigint := 0;
  v_latest_at timestamptz;
  v_failed jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN NULL;
  END IF;

  SELECT max(run_date), min(run_date) INTO v_latest_day, v_first_day
  FROM public.backup_runs WHERE kind = 'nightly';

  SELECT max(created_at) INTO v_last_ok
  FROM public.backup_runs WHERE kind = 'nightly' AND status = 'ok';

  v_prev_day := v_latest_day - 7;

  -- Nights before the job's first recorded run never had a dump to find, so
  -- they are out of scope rather than missing. The window starts at the later
  -- of "seven nights ago" and the first run ever recorded.
  v_window_start := greatest(
    coalesce(v_latest_day, (now() AT TIME ZONE 'utc')::date) - 6,
    coalesce(v_first_day, coalesce(v_latest_day, (now() AT TIME ZONE 'utc')::date) - 6)
  );

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'day' DESC), '[]'::jsonb) INTO v_nights
  FROM (
    SELECT jsonb_build_object(
             'day', d.day,
             'tables', count(r.id),
             'failed', count(*) FILTER (WHERE r.status <> 'ok'),
             'status', CASE
                         WHEN count(r.id) = 0 THEN 'missing'
                         WHEN count(*) FILTER (WHERE r.status <> 'ok') > 0 THEN 'failed'
                         ELSE 'ok'
                       END
           ) AS x
    FROM (SELECT generate_series(
                   v_window_start,
                   coalesce(v_latest_day, (now() AT TIME ZONE 'utc')::date),
                   interval '1 day')::date AS day) d
    LEFT JOIN public.backup_runs r ON r.kind = 'nightly' AND r.run_date = d.day
    GROUP BY d.day
  ) s;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'table', t.table_name,
           'rows', t.row_count,
           'bytes', t.bytes,
           'status', t.status,
           'prev_rows', p.row_count,
           'delta', CASE WHEN p.row_count IS NULL THEN NULL ELSE t.row_count - p.row_count END
         ) ORDER BY t.table_name), '[]'::jsonb),
         coalesce(sum(t.bytes), 0),
         max(t.created_at)
  INTO v_tables, v_bytes, v_latest_at
  FROM public.backup_runs t
  LEFT JOIN public.backup_runs p
    ON p.kind = 'nightly' AND p.run_date = v_prev_day AND p.table_name = t.table_name
  WHERE t.kind = 'nightly' AND t.run_date = v_latest_day;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'day', r.run_date, 'table', r.table_name, 'error', left(coalesce(r.error, 'failed'), 200))
         ORDER BY r.run_date DESC), '[]'::jsonb)
  INTO v_failed
  FROM public.backup_runs r
  WHERE r.kind = 'nightly' AND r.status <> 'ok'
    AND r.run_date >= v_window_start;

  RETURN jsonb_build_object(
    'latest_day', v_latest_day,
    'latest_at', v_latest_at,
    'latest_bytes', v_bytes,
    'first_day', v_first_day,
    'last_ok_at', v_last_ok,
    'hours_since_ok', CASE WHEN v_last_ok IS NULL THEN NULL
                           ELSE round(extract(epoch FROM (now() - v_last_ok)) / 3600.0, 1) END,
    'stale', (v_last_ok IS NULL OR now() - v_last_ok > interval '30 hours'),
    'nights', v_nights,
    'tables', v_tables,
    'failures', v_failed
  );
END;
$function$;

-- Rejected writes are recorded so a refused save is visible on the dashboard.
-- The rule name only: no scores, no dates, no email.
CREATE OR REPLACE FUNCTION public.save_daily_result(p_visitor_id text, p_puzzle_number integer, p_puzzle_date date, p_rounds_solved integer, p_total_misses integer, p_peek_used boolean, p_round_events jsonb, p_elapsed_ms integer, p_email text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_per_visitor_per_day constant integer := 10;
  c_per_ip_per_day constant integer := 40;
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_date date := coalesce(p_puzzle_date, (now() AT TIME ZONE 'utc')::date);
  v_reason text;
BEGIN
  IF length(v_visitor) = 0 THEN
    RETURN false;
  END IF;

  v_reason := public.daily_result_reject_reason(
    p_puzzle_number, v_date, p_rounds_solved, p_total_misses,
    p_round_events, p_elapsed_ms
  );

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.daily_events (visitor_id, event, puzzle_number, props)
    VALUES (v_visitor, 'result_rejected', p_puzzle_number,
            jsonb_build_object('reason', v_reason, 'elapsed_ms', p_elapsed_ms));
    RETURN false;
  END IF;

  IF NOT public.rl_hit('daily_result_visitor', v_visitor, c_per_visitor_per_day) THEN
    INSERT INTO public.daily_events (visitor_id, event, puzzle_number, props)
    VALUES (v_visitor, 'result_rejected', p_puzzle_number,
            jsonb_build_object('reason', 'rate_limit_visitor'));
    RETURN false;
  END IF;
  IF NOT public.rl_hit('daily_result_ip', public.request_ip(), c_per_ip_per_day) THEN
    INSERT INTO public.daily_events (visitor_id, event, puzzle_number, props)
    VALUES (v_visitor, 'result_rejected', p_puzzle_number,
            jsonb_build_object('reason', 'rate_limit_ip'));
    RETURN false;
  END IF;

  INSERT INTO public.daily_results (
    visitor_id, puzzle_number, puzzle_date, rounds_solved,
    total_misses, peek_used, round_events, elapsed_ms, email
  ) VALUES (
    v_visitor,
    p_puzzle_number,
    v_date,
    p_rounds_solved,
    p_total_misses,
    coalesce(p_peek_used, false),
    p_round_events,
    p_elapsed_ms,
    nullif(btrim(coalesce(p_email, '')), '')
  )
  ON CONFLICT (visitor_id, puzzle_number) DO NOTHING;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_rejections(p_from date, p_to date)
 RETURNS TABLE(reason text, rejections integer, visitors integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT coalesce(nullif(d.props ->> 'reason', ''), 'unknown'),
         count(*)::integer,
         count(DISTINCT d.visitor_id)::integer
  FROM public.daily_events d
  WHERE d.event = 'result_rejected'
    AND d.created_at >= p_from::timestamptz
    AND d.created_at < (p_to + 1)::timestamptz
  GROUP BY 1
  ORDER BY 2 DESC;
END;
$function$;