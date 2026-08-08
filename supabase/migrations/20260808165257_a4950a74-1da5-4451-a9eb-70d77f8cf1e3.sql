CREATE OR REPLACE FUNCTION public.get_subscriber_email(p_visitor_id text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.e
  FROM (
    SELECT lower(trim(s.email)) AS e, s.created_at
    FROM public.daily_subscribers s
    WHERE nullif(trim(coalesce(p_visitor_id, '')), '') IS NOT NULL
      AND s.visitor_id = p_visitor_id
      AND s.email IS NOT NULL
    UNION ALL
    SELECT lower(trim(d.email)), d.created_at
    FROM public.daily_results d
    WHERE nullif(trim(coalesce(p_visitor_id, '')), '') IS NOT NULL
      AND d.visitor_id = p_visitor_id
      AND d.email IS NOT NULL
  ) t
  ORDER BY t.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.email_has_history(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_results d
    WHERE nullif(trim(coalesce(p_email, '')), '') IS NOT NULL
      AND d.email = lower(trim(p_email))
  )
$$;

REVOKE ALL ON FUNCTION public.get_subscriber_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_has_history(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscriber_email(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.email_has_history(text) TO anon, authenticated, service_role;