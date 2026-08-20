-- 1. auth identity on membership rows
ALTER TABLE public.daily_group_members
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS daily_group_members_user_id_idx
  ON public.daily_group_members (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS daily_group_members_group_user_uidx
  ON public.daily_group_members (group_id, user_id)
  WHERE user_id IS NOT NULL;

-- The account address is allowed to reach existing history through the
-- capped, idempotent backfill helper. It never overwrites a differing address.
GRANT EXECUTE ON FUNCTION public.backfill_result_emails(text, text, integer) TO authenticated;

-- 2. write RPCs: identity comes from the JWT, never from p_visitor_id
CREATE OR REPLACE FUNCTION public.create_daily_group(p_name text, p_visitor_id text, p_display_name text)
 RETURNS TABLE(group_id uuid, name text, code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_max_groups constant integer := 5;
  c_per_visitor_per_day constant integer := 5;
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(coalesce(auth.jwt() ->> 'email', ''))), '');
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_name text := left(btrim(coalesce(p_name, '')), 24);
  v_dn text := left(btrim(coalesce(p_display_name, '')), 8);
  v_code text;
  v_id uuid;
  v_try integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF length(v_name) = 0 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF length(v_dn) = 0 THEN v_dn := 'Player'; END IF;
  IF length(v_visitor) = 0 THEN v_visitor := v_uid::text; END IF;

  IF NOT public.rl_hit('daily_group_create', v_uid::text, c_per_visitor_per_day) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  IF (SELECT count(*) FROM public.daily_group_members m WHERE m.user_id = v_uid)
     >= c_max_groups THEN
    RAISE EXCEPTION 'group_limit_reached';
  END IF;

  LOOP
    v_try := v_try + 1;
    v_code := public.gen_daily_group_code();
    BEGIN
      INSERT INTO public.daily_groups (code, name, created_by)
      VALUES (v_code, v_name, v_uid::text)
      RETURNING public.daily_groups.id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 20 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
    END;
  END LOOP;

  INSERT INTO public.daily_group_members (group_id, visitor_id, display_name, email, user_id)
  VALUES (v_id, v_visitor, v_dn, v_email, v_uid);

  RETURN QUERY SELECT v_id, v_name, v_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_daily_group(p_code text, p_visitor_id text, p_display_name text, p_email text DEFAULT NULL::text)
 RETURNS TABLE(group_id uuid, name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_max_members constant integer := 20;
  c_max_groups constant integer := 5;
  c_per_visitor_per_day constant integer := 20;
  v_uid uuid := auth.uid();
  -- The account address wins; p_email is ignored for identity.
  v_email text := nullif(lower(btrim(coalesce(auth.jwt() ->> 'email', ''))), '');
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_dn text := left(btrim(coalesce(p_display_name, '')), 8);
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_id uuid;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF length(v_code) = 0 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF length(v_dn) = 0 THEN v_dn := 'Player'; END IF;
  IF length(v_visitor) = 0 THEN v_visitor := v_uid::text; END IF;

  IF NOT public.rl_hit('daily_group_join', v_uid::text, c_per_visitor_per_day) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT g.id, g.name INTO v_id, v_name
  FROM public.daily_groups g WHERE lower(g.code) = v_code LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.daily_group_members m
             WHERE m.group_id = v_id AND m.user_id = v_uid) THEN
    UPDATE public.daily_group_members m
    SET display_name = v_dn,
        email = coalesce(v_email, m.email),
        visitor_id = v_visitor
    WHERE m.group_id = v_id AND m.user_id = v_uid;
    RETURN QUERY SELECT v_id, v_name;
    RETURN;
  END IF;

  IF (SELECT count(*) FROM public.daily_group_members m WHERE m.group_id = v_id)
     >= c_max_members THEN
    RAISE EXCEPTION 'group_full';
  END IF;
  IF (SELECT count(*) FROM public.daily_group_members m WHERE m.user_id = v_uid)
     >= c_max_groups THEN
    RAISE EXCEPTION 'group_limit_reached';
  END IF;

  INSERT INTO public.daily_group_members (group_id, visitor_id, display_name, email, user_id)
  VALUES (v_id, v_visitor, v_dn, v_email, v_uid);

  RETURN QUERY SELECT v_id, v_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_daily_group(p_group_id uuid, p_visitor_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_left integer := 0;
BEGIN
  IF v_uid IS NULL OR p_group_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.daily_group_members m
  WHERE m.group_id = p_group_id AND m.user_id = v_uid;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT count(*)::integer INTO v_left
  FROM public.daily_group_members m WHERE m.group_id = p_group_id;

  IF v_left = 0 THEN
    DELETE FROM public.daily_groups g WHERE g.id = p_group_id;
  END IF;

  RETURN true;
END;
$function$;

-- 3. read RPCs: authenticated members only
CREATE OR REPLACE FUNCTION public.get_group_today(p_group_id uuid, p_puzzle_number integer, p_visitor_id text)
 RETURNS TABLE(visitor_id text, display_name text, rounds_solved integer, total_misses integer, peek_used boolean, rank_position integer, not_played boolean, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_group_id IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_group_members m
                 WHERE m.group_id = p_group_id AND m.user_id = v_uid) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH mem AS (
    SELECT m.visitor_id AS vid, m.display_name AS dn, m.email AS em, m.user_id AS uid
    FROM public.daily_group_members m WHERE m.group_id = p_group_id
  ),
  scored AS (
    SELECT mem.vid, mem.dn, mem.uid, b.rounds_solved AS rs, b.total_misses AS tm, b.peek_used AS pk
    FROM mem
    LEFT JOIN LATERAL (
      SELECT r.rounds_solved, r.total_misses, r.peek_used
      FROM public.daily_results r
      WHERE r.puzzle_number = p_puzzle_number
        AND (r.visitor_id = mem.vid
             OR (mem.em IS NOT NULL AND r.email = lower(btrim(mem.em))))
      ORDER BY r.rounds_solved DESC, r.total_misses ASC, r.created_at ASC
      LIMIT 1
    ) b ON true
  )
  SELECT s.vid, s.dn,
         coalesce(s.rs, 0)::integer,
         coalesce(s.tm, 0)::integer,
         coalesce(s.pk, false),
         CASE WHEN s.rs IS NULL THEN NULL ELSE (
           1 + (SELECT count(*) FROM scored o
                WHERE o.rs IS NOT NULL
                  AND (o.rs, -o.tm) > (s.rs, -s.tm))
         )::integer END,
         (s.rs IS NULL),
         (s.uid = v_uid)
  FROM scored s
  ORDER BY (s.rs IS NULL), s.rs DESC NULLS LAST, s.tm ASC, s.dn ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_group_season(p_group_id uuid, p_puzzle_number integer, p_visitor_id text)
 RETURNS TABLE(visitor_id text, display_name text, points integer, puzzles_played integer, rank_position integer, is_me boolean, season_start date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_week date := public.daily_season_start(p_puzzle_number);
  v_first integer := greatest(1, (public.daily_season_start(p_puzzle_number) - date '2026-08-11') + 1);
BEGIN
  IF v_uid IS NULL OR p_group_id IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_group_members m
                 WHERE m.group_id = p_group_id AND m.user_id = v_uid) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH mem AS (
    SELECT m.visitor_id AS vid, m.display_name AS dn, m.email AS em, m.user_id AS uid
    FROM public.daily_group_members m WHERE m.group_id = p_group_id
  ),
  nums AS (SELECT n FROM generate_series(v_first, p_puzzle_number) AS n),
  rows_ AS (
    SELECT mem.vid, nums.n, b.rounds_solved AS rs, b.total_misses AS tm
    FROM mem CROSS JOIN nums
    LEFT JOIN LATERAL (
      SELECT r.rounds_solved, r.total_misses
      FROM public.daily_results r
      WHERE r.puzzle_number = nums.n
        AND (r.visitor_id = mem.vid
             OR (mem.em IS NOT NULL AND r.email = lower(btrim(mem.em))))
      ORDER BY r.rounds_solved DESC, r.total_misses ASC, r.created_at ASC
      LIMIT 1
    ) b ON true
  ),
  placed AS (
    SELECT x.vid, x.n,
           1 + (SELECT count(*) FROM rows_ o
                WHERE o.n = x.n AND o.rs IS NOT NULL
                  AND (o.rs, -o.tm) > (x.rs, -x.tm)) AS pos
    FROM rows_ x WHERE x.rs IS NOT NULL
  ),
  pts AS (
    SELECT mem.vid, mem.dn, mem.uid,
           coalesce(sum(CASE placed.pos WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1
                                        ELSE 0 END), 0)::integer AS points,
           count(placed.n)::integer AS played
    FROM mem LEFT JOIN placed ON placed.vid = mem.vid
    GROUP BY mem.vid, mem.dn, mem.uid
  )
  SELECT p.vid, p.dn, p.points, p.played,
         (1 + (SELECT count(*) FROM pts o WHERE o.points > p.points))::integer,
         (p.uid = v_uid),
         v_week
  FROM pts p
  ORDER BY p.points DESC, p.played DESC, p.dn ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_groups(p_visitor_id text, p_email text DEFAULT NULL::text, p_puzzle_number integer DEFAULT NULL::integer)
 RETURNS TABLE(group_id uuid, name text, code text, member_count integer, my_position integer, my_points integer, puzzle_number integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(coalesce(auth.jwt() ->> 'email', ''))), '');
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_puzzle integer := p_puzzle_number;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  IF v_puzzle IS NULL THEN
    SELECT max(d.puzzle_number) INTO v_puzzle
    FROM public.daily_rows_for(v_visitor, v_email) d;
  END IF;

  RETURN QUERY
  SELECT g.id, g.name, g.code,
         (SELECT count(*)::integer FROM public.daily_group_members x
          WHERE x.group_id = g.id),
         CASE WHEN v_puzzle IS NULL THEN NULL ELSE
           (SELECT t.rank_position FROM public.get_group_today(g.id, v_puzzle, v_visitor) t
            WHERE t.is_me LIMIT 1) END,
         CASE WHEN v_puzzle IS NULL THEN 0 ELSE
           coalesce((SELECT s.points FROM public.get_group_season(g.id, v_puzzle, v_visitor) s
                     WHERE s.is_me LIMIT 1), 0) END,
         v_puzzle
  FROM public.daily_groups g
  JOIN public.daily_group_members m ON m.group_id = g.id AND m.user_id = v_uid
  ORDER BY m.joined_at ASC;
END;
$function$;