// ============================================================================
// seatOwnership — server-side check that a visitor really occupies a seat.
//
// Seat maps are frozen by the host at game start and persisted to
// public.room_seats via the register_room_seats RPC (host-only). The claim
// arbiter joins against that record so a client cannot claim, or release,
// a seat that is not theirs.
// ============================================================================

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type SeatCheck = { ok: true } | { ok: false; reason: string };

export async function verifySeatOwner(
  supabase: SupabaseClient,
  input: { room_id: string; game_id: string; seat: number; visitor_id: string },
): Promise<SeatCheck> {
  const { data, error } = await supabase
    .from("room_seats")
    .select("visitor_id")
    .eq("room_id", input.room_id)
    .eq("game_id", input.game_id)
    .eq("seat", input.seat)
    .maybeSingle();

  if (error) {
    console.error("[seatOwnership] lookup failed", error);
    return { ok: false, reason: "seat_lookup_failed" };
  }
  if (!data) return { ok: false, reason: "seat_not_registered" };
  if (data.visitor_id !== input.visitor_id) return { ok: false, reason: "seat_not_owned" };
  return { ok: true };
}
