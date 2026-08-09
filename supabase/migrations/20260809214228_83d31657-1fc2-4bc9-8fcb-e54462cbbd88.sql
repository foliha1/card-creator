-- ---------------------------------------------------------------------------
-- Rate-limit counters. Internal only: no grants, reached solely through
-- security-definer functions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.write_limits (
  bucket text NOT NULL,
  key text NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key, day)
);

GRANT ALL ON public.write_limits TO service_role;
ALTER TABLE public.write_limits ENABLE ROW LEVEL SECURITY;
-- No policies: unreachable from the Data API by design.

-- Client IP as seen by PostgREST / the edge runtime.
CREATE OR REPLACE FUNCTION public.request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_h jsonb;
  v_ip text;
BEGIN
  BEGIN
    v_h := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_h := NULL;
  END;
  IF v_h IS NULL THEN
    RETURN 'unknown';
  END IF;
  v_ip := coalesce(v_h ->> 'x-forwarded-for', v_h ->> 'cf-connecting-ip', '');
  v_ip := btrim(split_part(v_ip, ',', 1));
  IF v_ip = '' THEN
    RETURN 'unknown';
  END IF;
  RETURN left(v_ip, 64);
END;
$$;

-- Counts one hit. Returns true while still inside the cap.
CREATE OR REPLACE FUNCTION public.rl_hit(p_bucket text, p_key text, p_max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := left(coalesce(nullif(btrim(p_key), ''), 'unknown'), 128);
  v_count integer;
BEGIN
  INSERT INTO public.write_limits (bucket, key, day, count)
  VALUES (p_bucket, v_key, (now() AT TIME ZONE 'utc')::date, 1)
  ON CONFLICT (bucket, key, day)
  DO UPDATE SET count = public.write_limits.count + 1, updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count <= greatest(coalesce(p_max, 1), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.rl_hit(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rl_hit(text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rl_hit(text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rl_hit(text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.request_ip() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_ip() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Plausibility check for a submitted run. Pure; mirrored in TypeScript for
-- tests. Returns NULL when the run is acceptable, else a reason code.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_result_reject_reason(
  p_puzzle_number integer,
  p_puzzle_date date,
  p_rounds_solved integer,
  p_total_misses integer,
  p_round_events jsonb,
  p_elapsed_ms integer,
  p_today date DEFAULT (now() AT TIME ZONE 'utc')::date
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_launch constant date := date '2026-08-11';
  c_rounds constant integer := 3;
  c_misses_per_round constant integer := 2;
  c_ms_per_event constant integer := 250;
  v_expected integer;
  v_round jsonb;
  v_solves integer := 0;
  v_misses integer := 0;
  v_events integer := 0;
  v_r_solves integer;
  v_r_misses integer;
  v_r_len integer;
  v_mark text;
  v_i integer;
BEGIN
  IF p_puzzle_number IS NULL OR p_puzzle_date IS NULL THEN
    RETURN 'missing_puzzle';
  END IF;

  -- puzzle_number is a pure function of puzzle_date.
  v_expected := (p_puzzle_date - c_launch) + 1;
  IF p_puzzle_number <> v_expected OR p_puzzle_number < 1 THEN
    RETURN 'puzzle_mismatch';
  END IF;

  -- The puzzle date is the player's LOCAL date, so UTC-12..UTC+14 means the
  -- widest honest window is one calendar day either side of the UTC date.
  IF p_puzzle_date < p_today - 1 OR p_puzzle_date > p_today + 1 THEN
    RETURN 'date_out_of_window';
  END IF;

  IF p_rounds_solved IS NULL OR p_rounds_solved < 0 OR p_rounds_solved > c_rounds THEN
    RETURN 'rounds_out_of_range';
  END IF;

  IF p_total_misses IS NULL OR p_total_misses < 0
     OR p_total_misses > c_rounds * c_misses_per_round THEN
    RETURN 'misses_out_of_range';
  END IF;

  IF p_round_events IS NULL OR jsonb_typeof(p_round_events) <> 'array'
     OR jsonb_array_length(p_round_events) <> c_rounds THEN
    RETURN 'events_shape';
  END IF;

  FOR v_i IN 0 .. c_rounds - 1 LOOP
    v_round := p_round_events -> v_i;
    IF v_round IS NULL OR jsonb_typeof(v_round) <> 'array' THEN
      RETURN 'events_shape';
    END IF;
    v_r_len := jsonb_array_length(v_round);
    IF v_r_len < 1 OR v_r_len > c_misses_per_round THEN
      RETURN 'events_round_length';
    END IF;

    v_r_solves := 0;
    v_r_misses := 0;
    FOR v_mark IN SELECT jsonb_array_elements_text(v_round) LOOP
      IF v_mark = 'SOLVE' THEN
        v_r_solves := v_r_solves + 1;
      ELSIF v_mark = 'MISS' THEN
        v_r_misses := v_r_misses + 1;
      ELSE
        RETURN 'events_bad_mark';
      END IF;
    END LOOP;

    -- A round ends either on a solve (which must be its last mark) or on the
    -- second miss. Anything else could not have happened.
    IF v_r_solves > 1 THEN
      RETURN 'events_impossible_round';
    END IF;
    IF v_r_solves = 1 AND (v_round ->> (v_r_len - 1)) <> 'SOLVE' THEN
      RETURN 'events_impossible_round';
    END IF;
    IF v_r_solves = 0 AND v_r_misses <> c_misses_per_round THEN
      RETURN 'events_impossible_round';
    END IF;

    v_solves := v_solves + v_r_solves;
    v_misses := v_misses + v_r_misses;
    v_events := v_events + v_r_len;
  END LOOP;

  IF v_solves <> p_rounds_solved THEN
    RETURN 'events_solves_mismatch';
  END IF;
  IF v_misses <> p_total_misses THEN
    RETURN 'events_misses_mismatch';
  END IF;

  -- Elapsed is the thinking clock: it is paused during rolls, reveals and
  -- settles, so the floor comes from the minimum tap cadence instead — every
  -- recorded mark needs two deliberate card taps.
  IF p_elapsed_ms IS NULL OR p_elapsed_ms < v_events * c_ms_per_event THEN
    RETURN 'elapsed_too_fast';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.daily_result_reject_reason(integer, date, integer, integer, jsonb, integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daily_result_reject_reason(integer, date, integer, integer, jsonb, integer, date) TO service_role;

-- ---------------------------------------------------------------------------
-- save_daily_result: validate, rate limit, then insert. Every rejection is
-- silent (returns false) so a real player never sees a failure.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_daily_result(
  p_visitor_id text,
  p_puzzle_number integer,
  p_puzzle_date date,
  p_rounds_solved integer,
  p_total_misses integer,
  p_peek_used boolean,
  p_round_events jsonb,
  p_elapsed_ms integer,
  p_email text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_per_visitor_per_day constant integer := 10;
  c_per_ip_per_day constant integer := 40;
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_date date := coalesce(p_puzzle_date, (now() AT TIME ZONE 'utc')::date);
BEGIN
  IF length(v_visitor) = 0 THEN
    RETURN false;
  END IF;

  IF public.daily_result_reject_reason(
       p_puzzle_number, v_date, p_rounds_solved, p_total_misses,
       p_round_events, p_elapsed_ms
     ) IS NOT NULL THEN
    RETURN false;
  END IF;

  IF NOT public.rl_hit('daily_result_visitor', v_visitor, c_per_visitor_per_day) THEN
    RETURN false;
  END IF;
  IF NOT public.rl_hit('daily_result_ip', public.request_ip(), c_per_ip_per_day) THEN
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
$$;

-- ---------------------------------------------------------------------------
-- log_daily_events: same database-backed caps so the funnel cannot be flooded.
-- ---------------------------------------------------------------------------
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
  c_per_visitor_per_day constant integer := 400;
  c_per_ip_per_day constant integer := 2000;
  v_written integer := 0;
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_ip text;
  e jsonb;
  v_event text;
BEGIN
  IF length(v_visitor) = 0 THEN
    RETURN 0;
  END IF;
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
    RETURN 0;
  END IF;

  v_ip := public.request_ip();

  FOR e IN SELECT * FROM jsonb_array_elements(p_events) LIMIT 50 LOOP
    v_event := nullif(btrim(coalesce(e->>'event', '')), '');
    IF v_event IS NULL OR NOT (v_event = ANY (v_allowed)) THEN
      CONTINUE;
    END IF;

    IF NOT public.rl_hit('daily_events_visitor', v_visitor, c_per_visitor_per_day) THEN
      EXIT;
    END IF;
    IF NOT public.rl_hit('daily_events_ip', v_ip, c_per_ip_per_day) THEN
      EXIT;
    END IF;

    INSERT INTO public.daily_events (
      visitor_id, event, puzzle_number, props, referrer, utm_source
    ) VALUES (
      v_visitor,
      v_event,
      CASE WHEN jsonb_typeof(e->'puzzle_number') = 'number'
           THEN (e->>'puzzle_number')::integer ELSE NULL END,
      CASE WHEN jsonb_typeof(e->'props') = 'object' THEN e->'props' ELSE NULL END,
      left(nullif(btrim(coalesce(e->>'referrer', '')), ''), 120),
      left(nullif(btrim(coalesce(e->>'utm_source', '')), ''), 60)
    );
    v_written := v_written + 1;
  END LOOP;

  RETURN v_written;
END;
$$;