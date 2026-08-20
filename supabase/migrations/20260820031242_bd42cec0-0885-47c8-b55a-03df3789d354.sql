-- Group leaderboards: data layer only.
CREATE TABLE IF NOT EXISTS public.daily_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.daily_groups(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  email text,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS daily_group_members_visitor_idx
  ON public.daily_group_members (visitor_id);

-- No client access at all: every read and write goes through the
-- SECURITY DEFINER RPCs below. RLS on, zero policies, zero grants.
ALTER TABLE public.daily_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_group_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_groups FROM anon, authenticated;
REVOKE ALL ON public.daily_group_members FROM anon, authenticated;
GRANT ALL ON public.daily_groups TO service_role;
GRANT ALL ON public.daily_group_members TO service_role;

-- ---------------------------------------------------------------- helpers ---

-- puzzle_number is a pure function of the puzzle's local date.
CREATE OR REPLACE FUNCTION public.daily_puzzle_date(p_puzzle_number integer)
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$ SELECT date '2026-08-11' + (coalesce(p_puzzle_number, 1) - 1) $$;

-- Weekly season key, Monday-anchored, derived not stored.
CREATE OR REPLACE FUNCTION public.daily_season_start(p_puzzle_number integer)
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$ SELECT date_trunc('week', public.daily_puzzle_date(p_puzzle_number))::date $$;

CREATE OR REPLACE FUNCTION public.gen_daily_group_code()
RETURNS text
LANGUAGE plpgsql VOLATILE
SET search_path TO 'public'
AS $$
DECLARE
  c_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text := '';
  i integer;
BEGIN
  FOR i IN 1 .. 6 LOOP
    v_code := v_code || substr(c_alphabet, 1 + floor(random() * length(c_alphabet))::integer, 1);
  END LOOP;
  RETURN v_code;
END;
$$;

-- ------------------------------------------------------------------ writes ---

CREATE OR REPLACE FUNCTION public.create_daily_group(
  p_name text, p_visitor_id text, p_display_name text
)
RETURNS TABLE(group_id uuid, name text, code text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c_max_groups constant integer := 5;
  c_per_visitor_per_day constant integer := 5;
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_name text := left(btrim(coalesce(p_name, '')), 24);
  v_dn text := left(btrim(coalesce(p_display_name, '')), 8);
  v_code text;
  v_id uuid;
  v_try integer := 0;
BEGIN
  IF length(v_visitor) = 0 OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF length(v_dn) = 0 THEN v_dn := 'Player'; END IF;

  IF NOT public.rl_hit('daily_group_create', v_visitor, c_per_visitor_per_day) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  IF (SELECT count(*) FROM public.daily_group_members m WHERE m.visitor_id = v_visitor)
     >= c_max_groups THEN
    RAISE EXCEPTION 'group_limit_reached';
  END IF;

  LOOP
    v_try := v_try + 1;
    v_code := public.gen_daily_group_code();
    BEGIN
      INSERT INTO public.daily_groups (code, name, created_by)
      VALUES (v_code, v_name, v_visitor)
      RETURNING public.daily_groups.id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 20 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
    END;
  END LOOP;

  INSERT INTO public.daily_group_members (group_id, visitor_id, display_name)
  VALUES (v_id, v_visitor, v_dn);

  RETURN QUERY SELECT v_id, v_name, v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_daily_group(
  p_code text, p_visitor_id text, p_display_name text, p_email text DEFAULT NULL
)
RETURNS TABLE(group_id uuid, name text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c_max_members constant integer := 20;
  c_max_groups constant integer := 5;
  c_per_visitor_per_day constant integer := 20;
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_dn text := left(btrim(coalesce(p_display_name, '')), 8);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_id uuid;
  v_name text;
BEGIN
  IF length(v_visitor) = 0 OR length(v_code) = 0 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF length(v_dn) = 0 THEN v_dn := 'Player'; END IF;

  IF NOT public.rl_hit('daily_group_join', v_visitor, c_per_visitor_per_day) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT g.id, g.name INTO v_id, v_name
  FROM public.daily_groups g WHERE lower(g.code) = v_code LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  -- Idempotent: already a member just refreshes the name.
  IF EXISTS (SELECT 1 FROM public.daily_group_members m
             WHERE m.group_id = v_id AND m.visitor_id = v_visitor) THEN
    UPDATE public.daily_group_members m
    SET display_name = v_dn, email = coalesce(v_email, m.email)
    WHERE m.group_id = v_id AND m.visitor_id = v_visitor;
    RETURN QUERY SELECT v_id, v_name;
    RETURN;
  END IF;

  IF (SELECT count(*) FROM public.daily_group_members m WHERE m.group_id = v_id)
     >= c_max_members THEN
    RAISE EXCEPTION 'group_full';
  END IF;
  IF (SELECT count(*) FROM public.daily_group_members m WHERE m.visitor_id = v_visitor)
     >= c_max_groups THEN
    RAISE EXCEPTION 'group_limit_reached';
  END IF;

  INSERT INTO public.daily_group_members (group_id, visitor_id, display_name, email)
  VALUES (v_id, v_visitor, v_dn, v_email);

  RETURN QUERY SELECT v_id, v_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_daily_group(p_group_id uuid, p_visitor_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_left integer := 0;
BEGIN
  IF p_group_id IS NULL OR length(v_visitor) = 0 THEN RETURN false; END IF;

  DELETE FROM public.daily_group_members m
  WHERE m.group_id = p_group_id AND m.visitor_id = v_visitor;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT count(*)::integer INTO v_left
  FROM public.daily_group_members m WHERE m.group_id = p_group_id;

  IF v_left = 0 THEN
    DELETE FROM public.daily_groups g WHERE g.id = p_group_id;
  END IF;

  RETURN true;
END;
$$;

-- ------------------------------------------------------------------- reads ---

CREATE OR REPLACE FUNCTION public.get_group_today(
  p_group_id uuid, p_puzzle_number integer, p_visitor_id text
)
RETURNS TABLE(visitor_id text, display_name text, rounds_solved integer,
              total_misses integer, peek_used boolean, rank_position integer,
              not_played boolean, is_me boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH mem AS (
    SELECT m.visitor_id AS vid, m.display_name AS dn, m.email AS em
    FROM public.daily_group_members m WHERE m.group_id = p_group_id
  ),
  scored AS (
    SELECT mem.vid, mem.dn, b.rounds_solved AS rs, b.total_misses AS tm, b.peek_used AS pk
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
         (s.vid = p_visitor_id)
  FROM scored s
  ORDER BY (s.rs IS NULL), s.rs DESC NULLS LAST, s.tm ASC, s.dn ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_season(
  p_group_id uuid, p_puzzle_number integer, p_visitor_id text
)
RETURNS TABLE(visitor_id text, display_name text, points integer,
              puzzles_played integer, rank_position integer, is_me boolean,
              season_start date)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_week date := public.daily_season_start(p_puzzle_number);
  v_first integer := greatest(1, (v_week - date '2026-08-11') + 1);
BEGIN
  RETURN QUERY
  WITH mem AS (
    SELECT m.visitor_id AS vid, m.display_name AS dn, m.email AS em
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
    SELECT mem.vid, mem.dn,
           coalesce(sum(CASE placed.pos WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1
                                        ELSE 0 END), 0)::integer AS points,
           count(placed.n)::integer AS played
    FROM mem LEFT JOIN placed ON placed.vid = mem.vid
    GROUP BY mem.vid, mem.dn
  )
  SELECT p.vid, p.dn, p.points, p.played,
         (1 + (SELECT count(*) FROM pts o WHERE o.points > p.points))::integer,
         (p.vid = p_visitor_id),
         v_week
  FROM pts p
  ORDER BY p.points DESC, p.played DESC, p.dn ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_groups(
  p_visitor_id text, p_email text DEFAULT NULL, p_puzzle_number integer DEFAULT NULL
)
RETURNS TABLE(group_id uuid, name text, code text, member_count integer,
              my_position integer, my_points integer, puzzle_number integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_visitor text := left(btrim(coalesce(p_visitor_id, '')), 100);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_puzzle integer := p_puzzle_number;
BEGIN
  IF length(v_visitor) = 0 THEN RETURN; END IF;

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
            WHERE t.visitor_id = v_visitor LIMIT 1) END,
         CASE WHEN v_puzzle IS NULL THEN 0 ELSE
           coalesce((SELECT s.points FROM public.get_group_season(g.id, v_puzzle, v_visitor) s
                     WHERE s.visitor_id = v_visitor LIMIT 1), 0) END,
         v_puzzle
  FROM public.daily_groups g
  JOIN public.daily_group_members m ON m.group_id = g.id AND m.visitor_id = v_visitor
  ORDER BY m.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_daily_group(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_daily_group(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_daily_group(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_today(uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_season(uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_groups(text, text, integer) TO anon, authenticated;