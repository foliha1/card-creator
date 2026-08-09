CREATE TABLE public.daily_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  event text not null,
  puzzle_number integer,
  props jsonb,
  referrer text,
  utm_source text,
  created_at timestamptz not null default now()
);

GRANT ALL ON public.daily_events TO service_role;

ALTER TABLE public.daily_events ENABLE ROW LEVEL SECURITY;
-- No policies: no client select/insert/update/delete. Writes go through the
-- security-definer RPC below, same pattern as save_daily_result.

CREATE INDEX daily_events_created_idx ON public.daily_events (created_at DESC);
CREATE INDEX daily_events_event_idx ON public.daily_events (event);
CREATE INDEX daily_events_visitor_idx ON public.daily_events (visitor_id);

CREATE OR REPLACE FUNCTION public.log_daily_events(p_visitor_id text, p_events jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed constant text[] := ARRAY[
    'ready_viewed','howto_opened','howto_skipped','howto_finished','run_started',
    'round_solved','round_failed','peek_used','run_finished','run_abandoned',
    'share_clicked','subscribe_shown','subscribe_submitted'
  ];
  v_written integer := 0;
  e jsonb;
  v_event text;
BEGIN
  IF p_visitor_id IS NULL OR length(trim(p_visitor_id)) = 0 THEN
    RETURN 0;
  END IF;
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(p_events) LIMIT 50 LOOP
    v_event := nullif(trim(coalesce(e->>'event', '')), '');
    IF v_event IS NULL OR NOT (v_event = ANY (v_allowed)) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.daily_events (
      visitor_id, event, puzzle_number, props, referrer, utm_source
    ) VALUES (
      left(trim(p_visitor_id), 100),
      v_event,
      CASE WHEN jsonb_typeof(e->'puzzle_number') = 'number'
           THEN (e->>'puzzle_number')::integer ELSE NULL END,
      CASE WHEN jsonb_typeof(e->'props') = 'object' THEN e->'props' ELSE NULL END,
      left(nullif(trim(coalesce(e->>'referrer', '')), ''), 120),
      left(nullif(trim(coalesce(e->>'utm_source', '')), ''), 60)
    );
    v_written := v_written + 1;
  END LOOP;

  RETURN v_written;
END;
$$;

REVOKE ALL ON FUNCTION public.log_daily_events(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_daily_events(text, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_daily_event_counts(p_days integer DEFAULT 14)
RETURNS TABLE(day date, event text, events integer, visitors integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (d.created_at AT TIME ZONE 'utc')::date AS day,
         d.event,
         count(*)::integer AS events,
         count(DISTINCT d.visitor_id)::integer AS visitors
  FROM public.daily_events d
  WHERE d.created_at >= now() - (greatest(coalesce(p_days, 14), 1) || ' days')::interval
  GROUP BY 1, 2
  ORDER BY 1 DESC, 3 DESC;
$$;

REVOKE ALL ON FUNCTION public.get_daily_event_counts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_event_counts(integer) TO service_role;