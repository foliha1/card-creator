-- 1. Seat ownership for the multiplayer claim arbiter -----------------------
CREATE TABLE IF NOT EXISTS public.room_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  seat integer NOT NULL,
  visitor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, game_id, seat),
  UNIQUE (room_id, game_id, visitor_id)
);

GRANT ALL ON public.room_seats TO service_role;

ALTER TABLE public.room_seats ENABLE ROW LEVEL SECURITY;
-- No policies: unreachable from the Data API. Written via the security-definer
-- RPC below and read by the claim arbiter with the service role.

CREATE OR REPLACE FUNCTION public.register_room_seats(
  p_room_id uuid,
  p_game_id uuid,
  p_host_visitor_id text,
  p_seats jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host text := btrim(coalesce(p_host_visitor_id, ''));
  v_seat jsonb;
  v_n integer := 0;
BEGIN
  IF p_room_id IS NULL OR p_game_id IS NULL OR v_host = '' THEN
    RETURN false;
  END IF;
  IF p_seats IS NULL OR jsonb_typeof(p_seats) <> 'array'
     OR jsonb_array_length(p_seats) < 1 OR jsonb_array_length(p_seats) > 6 THEN
    RETURN false;
  END IF;

  -- Only the room's host may declare the seat map for a game.
  IF NOT EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = p_room_id AND r.host_visitor_id = v_host
  ) THEN
    RETURN false;
  END IF;

  -- A game's seat map is written once; it never changes mid-game.
  IF EXISTS (
    SELECT 1 FROM public.room_seats s
    WHERE s.room_id = p_room_id AND s.game_id = p_game_id
  ) THEN
    RETURN true;
  END IF;

  FOR v_seat IN SELECT * FROM jsonb_array_elements(p_seats) LOOP
    IF jsonb_typeof(v_seat -> 'seat') <> 'number'
       OR nullif(btrim(coalesce(v_seat ->> 'visitor_id', '')), '') IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.room_seats (room_id, game_id, seat, visitor_id)
    VALUES (
      p_room_id,
      p_game_id,
      (v_seat ->> 'seat')::integer,
      left(btrim(v_seat ->> 'visitor_id'), 100)
    )
    ON CONFLICT DO NOTHING;
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.register_room_seats(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_room_seats(uuid, uuid, text, jsonb) TO anon, authenticated, service_role;

-- 2. Private backup bucket: admins only ------------------------------------
CREATE POLICY "Admins can read backup objects"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'daily-backups' AND public.is_admin());

CREATE POLICY "Admins can write backup objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'daily-backups' AND public.is_admin());

CREATE POLICY "Admins can update backup objects"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'daily-backups' AND public.is_admin())
WITH CHECK (bucket_id = 'daily-backups' AND public.is_admin());

CREATE POLICY "Admins can delete backup objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'daily-backups' AND public.is_admin());

-- 3. Admin allowlist: admins may read it ----------------------------------
GRANT SELECT ON public.admin_allowlist TO authenticated;

CREATE POLICY "Admins can read the allowlist"
ON public.admin_allowlist FOR SELECT TO authenticated
USING (public.is_admin());