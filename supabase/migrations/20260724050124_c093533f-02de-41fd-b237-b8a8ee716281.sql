
-- Drop anon direct-access policies on rooms
DROP POLICY IF EXISTS "Anyone can create a room" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can read rooms" ON public.rooms;

-- Drop redundant index (duplicates the one auto-created by the UNIQUE constraint)
DROP INDEX IF EXISTS public.idx_claim_locks_room_window;

-- create_room RPC
CREATE OR REPLACE FUNCTION public.create_room(p_code text, p_visitor_id text)
RETURNS TABLE (id uuid, room_code text, status text, is_host boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.rooms (room_code, host_visitor_id)
  VALUES (upper(p_code), p_visitor_id)
  RETURNING public.rooms.id, public.rooms.room_code, public.rooms.status, true;
END;
$$;

-- get_room_by_code RPC
CREATE OR REPLACE FUNCTION public.get_room_by_code(p_code text, p_visitor_id text)
RETURNS TABLE (id uuid, room_code text, status text, is_host boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.room_code, r.status, (r.host_visitor_id = p_visitor_id) AS is_host
  FROM public.rooms r
  WHERE r.room_code = upper(p_code)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.create_room(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_room_by_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_room(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_by_code(text, text) TO anon, authenticated;
