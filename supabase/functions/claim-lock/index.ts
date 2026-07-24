// ============================================================================
// claim-lock — the WHOOP! arbiter.
//
// Fairness mechanism: a UNIQUE (room_id, claim_window) index on claim_locks.
// First successful INSERT wins. Arrival order at Postgres is the ordering.
// We NEVER trust client-supplied time.
//
// On a successful insert, the function broadcasts `claim_grant` on the room's
// Realtime channel using the service role client. The host listens and
// dispatches PLAYER_ENTER_CLAIM locally. This makes the arbiter the single
// authoritative announcer — a client cannot forge a win.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  room_id: string;
  game_id: string;
  claim_window: number;
  player_seat: number;
  visitor_id: string;
}

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return bad(405, "method_not_allowed");

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad(400, "invalid_json");
  }
  const { room_id, game_id, claim_window, player_seat, visitor_id } = body ?? {};
  if (
    typeof room_id !== "string" ||
    typeof game_id !== "string" ||
    !game_id ||
    typeof claim_window !== "number" ||
    !Number.isFinite(claim_window) ||
    claim_window < 0 ||
    typeof player_seat !== "number" ||
    !Number.isFinite(player_seat) ||
    player_seat < 0 ||
    typeof visitor_id !== "string" ||
    !visitor_id
  ) {
    return bad(400, "invalid_body");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Attempt to claim the window. UNIQUE (room_id, game_id, claim_window) is
  // the fairness mechanism — first insert wins.
  const { error: insertErr } = await supabase.from("claim_locks").insert({
    room_id,
    game_id,
    claim_window,
    player_seat,
  });

  if (!insertErr) {
    // We won — announce it authoritatively over Realtime.
    try {
      const channel = supabase.channel(`room:${room_id}`, {
        config: { broadcast: { self: true, ack: false } },
      });
      // Send without subscribing — Supabase supports one-shot broadcasts
      // via the REST endpoint under the hood when using .send from a
      // service-role client.
      await channel.send({
        type: "broadcast",
        event: "msg",
        payload: {
          v: 1,
          type: "claim_grant",
          seq: 0,
          payload: { claim_window, seat: player_seat, visitor_id },
        },
      });
      // Best-effort cleanup — do not block on it.
      supabase.removeChannel(channel).catch(() => {});
    } catch (e) {
      console.error("[claim-lock] broadcast failed", e);
      // Still report a win — the host/joiner reconcile through the next
      // state broadcast. The caller pressing WHOOP will see won=true and
      // will not double-arbitrate.
    }
    return new Response(
      JSON.stringify({ won: true, winner_seat: player_seat, claim_window }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 23505 = unique_violation → someone else already won this window.
  const code = (insertErr as { code?: string }).code;
  if (code === "23505") {
    const { data: existing, error: selErr } = await supabase
      .from("claim_locks")
      .select("player_seat")
      .eq("room_id", room_id)
      .eq("game_id", game_id)
      .eq("claim_window", claim_window)
      .maybeSingle();
    if (selErr || !existing) {
      return bad(500, "select_after_conflict_failed");
    }
    return new Response(
      JSON.stringify({ won: false, winner_seat: existing.player_seat, claim_window }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.error("[claim-lock] insert failed", insertErr);
  return bad(500, "insert_failed");
});
