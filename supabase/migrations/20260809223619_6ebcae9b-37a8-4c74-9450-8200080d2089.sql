CREATE OR REPLACE FUNCTION public.admin_backup_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_latest_day date;
  v_prev_day date;
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

  SELECT max(run_date) INTO v_latest_day
  FROM public.backup_runs WHERE kind = 'nightly';

  SELECT max(created_at) INTO v_last_ok
  FROM public.backup_runs WHERE kind = 'nightly' AND status = 'ok';

  v_prev_day := v_latest_day - 7;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'day' DESC), '[]'::jsonb) INTO v_nights
  FROM (
    SELECT jsonb_build_object(
             'day', d.day,
             'tables', count(*),
             'failed', count(*) FILTER (WHERE r.status <> 'ok'),
             'status', CASE
                         WHEN count(r.id) = 0 THEN 'missing'
                         WHEN count(*) FILTER (WHERE r.status <> 'ok') > 0 THEN 'failed'
                         ELSE 'ok'
                       END
           ) AS x
    FROM (SELECT generate_series(
                   coalesce(v_latest_day, (now() AT TIME ZONE 'utc')::date) - 6,
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
    AND r.run_date >= coalesce(v_latest_day, (now() AT TIME ZONE 'utc')::date) - 6;

  RETURN jsonb_build_object(
    'latest_day', v_latest_day,
    'latest_at', v_latest_at,
    'latest_bytes', v_bytes,
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

REVOKE ALL ON FUNCTION public.admin_backup_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_backup_status() TO authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('weekly-backup-report');
EXCEPTION WHEN others THEN NULL;
END $$;

DELETE FROM public.backup_runs WHERE kind = 'weekly_report';