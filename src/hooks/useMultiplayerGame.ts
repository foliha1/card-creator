// ============================================================================
// useMultiplayerGame — wraps useGameState for the host (who runs the reducer
// and broadcasts) or receives PublicState for the joiner (who only renders).
//
// KNOWN LIMITATION: a backgrounded host tab throttles setInterval/setTimeout.
// Dice roll animations and bot-style timers can stall until the tab is
// refocused. Not solved here — reconnect handling is prompt 11.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useGameState, type Action } from "@/hooks/useGameState";
import { toPublicState, type PublicState } from "@/lib/publicState";
import {
  PROTOCOL_VERSION,
  type Envelope,
  type IntentAction,
  type IntentEnvelope,
  type IntentPayload,
  type StateEnvelope,
} from "@/lib/multiplayer";

export interface SeatMapEntry {
  seat: number;
  visitor_id: string;
  display_name: string;
}

// ---------- HOST ----------

export function useMultiplayerHost(opts: {
  channel: RealtimeChannel | null;
  seatMap: SeatMapEntry[];
  hostVisitorId: string;
  enabled: boolean;
}) {
  const { channel, seatMap, hostVisitorId, enabled } = opts;
  const seatCount = Math.max(2, seatMap.length);
  const names = useMemo(() => (seatMap.length ? seatMap.map((e) => e.display_name) : ["Host", "Joiner"]), [seatMap]);
  const g = useGameState("3x2", { seatCount, botSeats: [], names });


  const seqRef = useRef(0);
  const seatMapRef = useRef(seatMap);
  seatMapRef.current = seatMap;

  // Broadcast state after every reducer tick.
  useEffect(() => {
    if (!enabled || !channel) return;
    seqRef.current += 1;
    const env: StateEnvelope = {
      v: PROTOCOL_VERSION,
      type: "state",
      seq: seqRef.current,
      payload: toPublicState(g.state, seatMapRef.current),
    };
    channel.send({ type: "broadcast", event: "msg", payload: env }).catch(() => {});
  }, [enabled, channel, g.state]);

  // Receive intents and inject as reducer actions.
  useEffect(() => {
    if (!enabled || !channel) return;
    const handler = (msg: { payload: Envelope }) => {
      const env = msg.payload;
      if (!env || env.v !== PROTOCOL_VERSION || env.type !== "intent") return;
      const intent: IntentPayload = env.payload;
      // Validate sender matches claimed seat.
      const seatEntry = seatMapRef.current.find((e) => e.seat === intent.seat);
      if (!seatEntry) return;
      if (seatEntry.visitor_id !== intent.visitor_id) return;
      // Ignore intents from host's own seat over the wire — host acts locally.
      if (seatEntry.visitor_id === hostVisitorId) return;
      handleHostIntent(g.dispatch, g.doRollDice, intent.seat, intent.action);
    };
    const sub = channel.on("broadcast", { event: "msg" }, handler);
    // The channel is subscribed by useRoomPresence; do not re-subscribe here.
    return () => {
      // Supabase's channel.on returns the channel itself; unsub via removing
      // listener is not directly supported. Ignoring on teardown is safe
      // because the entire channel is torn down by the presence hook.
      void sub;
    };
  }, [enabled, channel, g.dispatch, g.doRollDice, hostVisitorId]);

  return g;
}

// Intent → local reducer dispatch. Reducer's phase/seat guards are the final
// authority; illegal intents (wrong turn, wrong phase, etc.) return the
// unchanged state and are a no-op — not a crash.
function handleHostIntent(
  dispatch: (a: Action) => void,
  doRollDice: () => Promise<string[]>,
  seat: number,
  action: IntentAction,
) {
  switch (action.type) {
    case "REQUEST_ROLL":
      // Guard-checked inside runRollAnimation via ROLL_START phase check;
      // this just triggers the host-side animation.
      void doRollDice();
      return;
    case "PLAYER_ENTER_CLAIM":
      dispatch({ type: "PLAYER_ENTER_CLAIM", by: seat });
      return;
    case "PLAYER_ENTER_CLAIM_DURING_ROLL":
      dispatch({ type: "PLAYER_ENTER_CLAIM_DURING_ROLL", by: seat });
      return;
    case "PLAYER_SELECT_CARD":
      dispatch({ type: "PLAYER_SELECT_CARD", by: seat, idx: action.idx });
      return;
    case "PLAYER_RESOLVE_MATCH":
      dispatch({ type: "PLAYER_RESOLVE_MATCH", by: seat });
      return;
    case "FLIP_START":
      dispatch({
        type: "FLIP_START",
        by: seat,
        idx: action.idx,
        token: action.token,
      });
      return;
    case "LAST_CALL_CLAIM":
      dispatch({
        type: "LAST_CALL_CLAIM",
        by: seat,
        a: action.a,
        b: action.b,
      });
      return;
  }
}

// ---------- JOINER ----------

export function useMultiplayerJoiner(opts: {
  channel: RealtimeChannel | null;
  mySeat: number | null;
  visitorId: string;
  enabled: boolean;
}) {
  const { channel, mySeat, visitorId, enabled } = opts;
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const lastSeqRef = useRef(0);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!enabled || !channel) return;
    const handler = (msg: { payload: Envelope }) => {
      const env = msg.payload;
      if (!env || env.v !== PROTOCOL_VERSION || env.type !== "state") return;
      // Out-of-order guard: never rewind.
      if (env.seq <= lastSeqRef.current) return;
      lastSeqRef.current = env.seq;
      setPublicState(env.payload);
    };
    channel.on("broadcast", { event: "msg" }, handler);
  }, [enabled, channel]);

  const sendIntent = useCallback(
    (action: IntentAction) => {
      if (!channel || mySeat === null) return;
      seqRef.current += 1;
      const env: IntentEnvelope = {
        v: PROTOCOL_VERSION,
        type: "intent",
        seq: seqRef.current,
        payload: { seat: mySeat, visitor_id: visitorId, action },
      };
      channel.send({ type: "broadcast", event: "msg", payload: env }).catch(() => {});
    },
    [channel, mySeat, visitorId],
  );

  return { publicState, sendIntent };
}
