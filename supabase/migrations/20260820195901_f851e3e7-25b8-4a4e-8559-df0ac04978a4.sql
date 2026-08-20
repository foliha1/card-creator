-- Shared backfill helper: stamps an email onto a visitor's untagged results.
-- Never overwrites a non-null email; capped per call.
CREATE OR REPLACE FUNCTION public.backfill_result_emails(
  p_visitor_id text,
  p_email text,
  p_limit integer DEFAULT 500
)
RETURNS TABLE(updated_rows integer, collisions integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_visitor text := nullif(btrim(coalesce(p_visitor_id, '')), '');
  v_updated integer := 0;
  v_collisions integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit, 500), 0), 500);
BEGIN
  updated_rows := 0;
  collisions := 0;
  IF v_visitor IS NULL OR v_email = '' THEN
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT count(*) INTO v_collisions
  FROM public.daily_results
  WHERE visitor_id = v_visitor
    AND email IS NOT NULL
    AND lower(btrim(email)) <> v_email;

  WITH target AS (
    SELECT id FROM public.daily_results
    WHERE visitor_id = v_visitor AND email IS NULL
    ORDER BY puzzle_number
    LIMIT v_limit
  ), done AS (
    UPDATE public.daily_results r
    SET email = v_email
    FROM target t
    WHERE r.id = t.id
    RETURNING r.id
  )
  SELECT count(*) INTO v_updated FROM done;

  IF v_collisions > 0 THEN
    RAISE NOTICE 'backfill_result_emails: visitor % has % row(s) with a different email; left untouched', v_visitor, v_collisions;
  END IF;

  updated_rows := v_updated;
  collisions := v_collisions;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.backfill_result_emails(text, text, integer) FROM PUBLIC, anon, authenticated;

-- subscribe_daily (2-arg): backfill via the helper, no overwrites.
CREATE OR REPLACE FUNCTION public.subscribe_daily(p_email text, p_visitor_id text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR length(v_email) > 255 THEN
    RETURN false;
  END IF;

  INSERT INTO public.daily_subscribers (email, visitor_id, source)
  VALUES (v_email, nullif(btrim(coalesce(p_visitor_id, '')), ''), 'daily_result')
  ON CONFLICT (email) DO NOTHING;

  PERFORM public.backfill_result_emails(p_visitor_id, v_email, 500);

  RETURN true;
END;
$function$;

-- subscribe_daily (3-arg): same, keeping source handling.
CREATE OR REPLACE FUNCTION public.subscribe_daily(p_email text, p_visitor_id text, p_source text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_source text := coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'daily_result');
BEGIN
  IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR length(v_email) > 255 THEN
    RETURN false;
  END IF;

  IF v_source NOT IN ('daily_result', 'landing', 'prelaunch') THEN
    v_source := 'daily_result';
  END IF;

  INSERT INTO public.daily_subscribers (email, visitor_id, source)
  VALUES (v_email, nullif(btrim(coalesce(p_visitor_id, '')), ''), v_source)
  ON CONFLICT (email) DO NOTHING;

  PERFORM public.backfill_result_emails(p_visitor_id, v_email, 500);

  RETURN true;
END;
$function$;

-- One-off backfill of existing history. Visitors mapping to more than one
-- address are skipped, not guessed.
DO $$
DECLARE
  v_updated integer := 0;
  v_skipped integer := 0;
  v_collided text;
BEGIN
  CREATE TEMP TABLE _map AS
  WITH pairs AS (
    SELECT visitor_id, lower(btrim(email)) AS email
    FROM public.daily_results
    WHERE visitor_id IS NOT NULL AND email IS NOT NULL
    UNION
    SELECT visitor_id, lower(btrim(email))
    FROM public.daily_subscribers
    WHERE visitor_id IS NOT NULL AND email IS NOT NULL
  )
  SELECT visitor_id, min(email) AS email, count(DISTINCT email) AS n,
         string_agg(DISTINCT email, ', ') AS emails
  FROM pairs GROUP BY visitor_id;

  SELECT count(*), string_agg(visitor_id || ' -> ' || emails, ' | ')
    INTO v_skipped, v_collided
  FROM _map WHERE n > 1;

  WITH done AS (
    UPDATE public.daily_results r
    SET email = m.email
    FROM _map m
    WHERE r.visitor_id = m.visitor_id AND m.n = 1 AND r.email IS NULL
    RETURNING r.id
  )
  SELECT count(*) INTO v_updated FROM done;

  RAISE NOTICE 'one-off backfill: % row(s) updated, % visitor(s) skipped for colliding emails: %',
    v_updated, v_skipped, coalesce(v_collided, 'none');

  DROP TABLE _map;
END;
$$;