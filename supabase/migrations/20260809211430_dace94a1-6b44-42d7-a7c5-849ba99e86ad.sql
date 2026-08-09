REVOKE EXECUTE ON FUNCTION public.admin_export_subscribers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_export_subscribers() TO authenticated, service_role;