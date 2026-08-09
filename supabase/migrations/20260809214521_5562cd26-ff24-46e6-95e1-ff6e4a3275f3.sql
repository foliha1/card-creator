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
  v_anchor date;
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
  -- widest honest window is one calendar day either side. Before launch the
  -- window anchors on launch day so pre-launch testing can still write.
  v_anchor := greatest(p_today, c_launch);
  IF p_puzzle_date < v_anchor - 1 OR p_puzzle_date > v_anchor + 1 THEN
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

  -- Elapsed is the thinking clock (paused during rolls, reveals and settles),
  -- so the floor is a tap cadence: two deliberate taps per recorded mark.
  IF p_elapsed_ms IS NULL OR p_elapsed_ms < v_events * c_ms_per_event THEN
    RETURN 'elapsed_too_fast';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.daily_result_reject_reason(integer, date, integer, integer, jsonb, integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daily_result_reject_reason(integer, date, integer, integer, jsonb, integer, date) TO service_role;