DELETE FROM public.claim_locks;
ALTER TABLE public.claim_locks DROP CONSTRAINT claim_locks_room_window_unique;
ALTER TABLE public.claim_locks ADD COLUMN game_id uuid NOT NULL;
-- Fairness mechanism: first successful INSERT wins the (room, game, window)
-- race. This unique constraint IS the arbitration — no timestamps, no client
-- clocks. Scoped by game_id so a fresh game in the same room resets windows.
ALTER TABLE public.claim_locks
  ADD CONSTRAINT claim_locks_room_game_window_unique UNIQUE (room_id, game_id, claim_window);