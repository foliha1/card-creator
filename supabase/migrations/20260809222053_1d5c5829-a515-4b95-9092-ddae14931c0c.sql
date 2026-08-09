CREATE TABLE public.backup_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  kind text NOT NULL DEFAULT 'nightly',
  table_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  object_path text,
  bytes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read backup runs"
ON public.backup_runs FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX backup_runs_run_date_idx ON public.backup_runs (run_date DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_backup_runs_updated_at
BEFORE UPDATE ON public.backup_runs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();