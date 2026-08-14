DELETE FROM public.daily_results
WHERE puzzle_number <> (puzzle_date - DATE '2026-08-11') + 1;

-- admin_rejections: match the other admin reports exactly
REVOKE ALL ON FUNCTION public.admin_rejections(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rejections(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rejections(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rejections(date, date) TO service_role;

-- strip leftover blanket PUBLIC execute grants; keep explicit role grants intact
REVOKE ALL ON FUNCTION public.get_daily_results(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_results(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_daily_result(text, integer, date, integer, integer, boolean, jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_daily_result(text, integer, date, integer, integer, boolean, jsonb, integer, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.subscribe_daily(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_daily(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.subscribe_daily(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_daily(text, text, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.normalize_admin_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_admin_email() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_admin_email() TO service_role;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;