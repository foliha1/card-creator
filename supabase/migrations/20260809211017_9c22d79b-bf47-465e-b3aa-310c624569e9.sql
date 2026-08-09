CREATE OR REPLACE FUNCTION public.admin_export_subscribers()
RETURNS TABLE(email text, source text, synced_to_ac boolean, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;

  SELECT count(*)::integer INTO v_count FROM public.daily_subscribers;

  INSERT INTO public.daily_events (visitor_id, event, props)
  VALUES (left('admin:' || v_email, 100), 'admin_subscriber_export',
          jsonb_build_object('rows', v_count, 'admin_email', v_email));

  RETURN QUERY
  SELECT s.email, s.source, s.synced_to_ac, s.created_at
  FROM public.daily_subscribers s
  ORDER BY s.created_at ASC;
END;
$$;