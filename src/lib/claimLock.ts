// ============================================================================
// claimLock — client wrapper for the claim-lock edge function (the arbiter).
//
// Every player (host included) MUST go through this on WHOOP. First insert
// at the server wins; losers see { outcome: "lost" }. There is no client-side
// tie-breaker — arrival order at Postgres is the ordering.
//
// Outcomes are tri-state so the UI can distinguish a genuine lost race from
// a transport/server error. Both fail closed (do NOT enter claim mode), but
// they surface different feedback to the player.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export type ClaimOutcome = "won" | "lost" | "error";

export interface ClaimLockResult {
  outcome: ClaimOutcome;
  won: boolean; // convenience; true iff outcome === "won"
  winner_seat: number | null;
  claim_window: number;
  error?: unknown;
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
      console.error("[claim-lock] invoke error — failing closed (error)", error);
      return { outcome: "error", won: false, winner_seat: null, claim_window: input.claim_window, error };
    }
    if (!data || typeof data !== "object") {
      console.error("[claim-lock] malformed response — failing closed (error)", data);
      return { outcome: "error", won: false, winner_seat: null, claim_window: input.claim_window, error: new Error("malformed_response") };
    }
    const d = data as { won?: boolean; winner_seat?: number; claim_window?: number; error?: string };
    if (d.error) {
      console.error("[claim-lock] server error — failing closed (error)", d.error);
      return { outcome: "error", won: false, winner_seat: null, claim_window: input.claim_window, error: d.error };
    }
    const won = !!d.won;
    return {
      outcome: won ? "won" : "lost",
      won,
      winner_seat: typeof d.winner_seat === "number" ? d.winner_seat : null,
      claim_window: typeof d.claim_window === "number" ? d.claim_window : input.claim_window,
    };
  } catch (e) {
    console.error("[claim-lock] threw — failing closed (error)", e);
    return { outcome: "error", won: false, winner_seat: null, claim_window: input.claim_window, error: e };
  }
}
