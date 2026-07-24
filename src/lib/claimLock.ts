// ============================================================================
// claimLock — client wrapper for the claim-lock edge function (the arbiter).
//
// Every player (host included) MUST go through this on WHOOP. First insert
// at the server wins; losers see { won: false }. There is no client-side
// tie-breaker — arrival order at Postgres is the ordering.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export interface ClaimLockResult {
  won: boolean;
  winner_seat: number | null;
  claim_window: number;
}

export async function callClaimLock(input: {
  room_id: string;
  game_id: string;
  claim_window: number;
  player_seat: number;
  visitor_id: string;
}): Promise<ClaimLockResult> {
  try {
    const { data, error } = await supabase.functions.invoke("claim-lock", {
      body: input,
    });
    if (error) {
      console.warn("[claim-lock] invoke error — failing safe (lost)", error);
      return { won: false, winner_seat: null, claim_window: input.claim_window };
    }
    if (!data || typeof data !== "object") {
      return { won: false, winner_seat: null, claim_window: input.claim_window };
    }
    const d = data as { won?: boolean; winner_seat?: number; claim_window?: number };
    return {
      won: !!d.won,
      winner_seat: typeof d.winner_seat === "number" ? d.winner_seat : null,
      claim_window: typeof d.claim_window === "number" ? d.claim_window : input.claim_window,
    };
  } catch (e) {
    console.warn("[claim-lock] threw — failing safe (lost)", e);
    return { won: false, winner_seat: null, claim_window: input.claim_window };
  }
}
