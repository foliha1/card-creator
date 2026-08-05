CREATE TABLE public.daily_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  visitor_id text,
  source text NOT NULL DEFAULT 'daily_result',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.daily_subscribers TO service_role;

ALTER TABLE public.daily_subscribers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.subscribe_daily(p_email text, p_visitor_id text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_email !~ '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR length(v_email) > 255 THEN
    RETURN false;
  END IF;

  INSERT INTO public.daily_subscribers (email, visitor_id, source)
  VALUES (v_email, nullif(trim(coalesce(p_visitor_id, '')), ''), 'daily_result')
  ON CONFLICT (email) DO NOTHING;

  IF p_visitor_id IS NOT NULL AND length(trim(p_visitor_id)) > 0 THEN
    UPDATE public.daily_results
    SET email = v_email
    WHERE visitor_id = p_visitor_id AND (email IS NULL OR email <> v_email);
  END IF;

  RETURN true;
END;
$$;