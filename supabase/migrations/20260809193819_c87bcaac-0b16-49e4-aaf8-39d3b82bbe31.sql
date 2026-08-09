CREATE OR REPLACE FUNCTION public.subscribe_daily(p_email text, p_visitor_id text, p_source text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_source text := coalesce(nullif(trim(coalesce(p_source, '')), ''), 'daily_result');
BEGIN
  IF v_email !~ '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR length(v_email) > 255 THEN
    RETURN false;
  END IF;

  IF v_source NOT IN ('daily_result', 'landing', 'prelaunch') THEN
    v_source := 'daily_result';
  END IF;

  INSERT INTO public.daily_subscribers (email, visitor_id, source)
  VALUES (v_email, nullif(trim(coalesce(p_visitor_id, '')), ''), v_source)
  ON CONFLICT (email) DO NOTHING;

  IF p_visitor_id IS NOT NULL AND length(trim(p_visitor_id)) > 0 THEN
    UPDATE public.daily_results
    SET email = v_email
    WHERE visitor_id = p_visitor_id AND (email IS NULL OR email <> v_email);
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.subscribe_daily(text, text, text) FROM anon, authenticated;