-- Multiplayer schema: rooms, claim_locks, analytics_events
-- Identity is a client-generated visitor_id (no Supabase Auth). Anon access is intentional and scoped per-table below.

-- =========================================================================
-- rooms: lobby/session records, discoverable by short shareable code
-- =========================================================================
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL, -- 6-char uppercase alphanumeric, generated client-side; client retries on unique-violation
  host_visitor_id text NOT NULL,
  status text NOT NULL DEFAULT 'lobby', -- expected values: 'lobby' | 'active' | 'completed' (no CHECK yet; kept flexible)
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_room_code ON public.rooms (room_code);

GRANT SELECT, INSERT ON public.rooms TO anon;
GRANT SELECT, INSERT ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Anyone can create a room (host identity is just a client-side visitor_id string).
CREATE POLICY "Anyone can create a room"
  ON public.rooms FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can look up a room (needed so a joiner can find a room by its code).
CREATE POLICY "Anyone can read rooms"
  ON public.rooms FOR SELECT
  TO anon, authenticated
  USING (true);

-- NOTE: intentionally no UPDATE/DELETE policies for anon. Room state transitions
-- (lobby -> active -> completed, last_active_at bumps) will go through a future
-- Edge Function using the service role key, which bypasses RLS.


-- =========================================================================
-- claim_locks: fairness primitive for "first WHOOP wins" per claim window
-- =========================================================================
-- SECURITY: RLS is enabled with ZERO anon policies on purpose.
-- Only a future Edge Function using the service role key writes here.
-- If clients could insert directly, a player could forge their own priority
-- by pre-inserting a row with an earlier timestamp / their own seat.
CREATE TABLE public.claim_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  claim_window integer NOT NULL, -- host-issued counter; increments every time the claim state resets to open
  player_seat integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- LOAD-BEARING: this UNIQUE constraint IS the fairness mechanism.
  -- Postgres guarantees only one INSERT per (room_id, claim_window) succeeds;
  -- every other concurrent insert fails with a unique_violation. That is how
  -- "first WHOOP wins" is decided atomically across players. DO NOT REMOVE.
  CONSTRAINT claim_locks_room_window_unique UNIQUE (room_id, claim_window)
);

CREATE INDEX idx_claim_locks_room_window ON public.claim_locks (room_id, claim_window);

GRANT ALL ON public.claim_locks TO service_role;
-- Deliberately no grants to anon/authenticated.

ALTER TABLE public.claim_locks ENABLE ROW LEVEL SECURITY;
-- No policies: with RLS enabled and no policies, anon/authenticated get zero access.
-- service_role bypasses RLS entirely.


-- =========================================================================
-- analytics_events: write-only funnel from the client
-- =========================================================================
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'invite_link_clicked' | 'room_created' | 'room_joined' | 'game_started' | 'game_completed' | 'room_replayed' | 'email_captured'
  room_code text, -- intentionally NO foreign key: a broken/mistyped link click should still log
  visitor_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events (event_type);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events (created_at DESC);

GRANT INSERT ON public.analytics_events TO anon;
GRANT INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Write-only from the client. Reads happen via the Supabase SQL editor (service role).
CREATE POLICY "Anyone can insert analytics events"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
-- No SELECT/UPDATE/DELETE policies for anon/authenticated.
