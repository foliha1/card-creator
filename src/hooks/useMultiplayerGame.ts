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
  type ClaimGrantEnvelope,
  type Envelope,
  type EventEnvelope,
  type IntentAction,
  type IntentEnvelope,
  type IntentPayload,
  type StateEnvelope,
  type TransientEvent,
  type TransientEventKind,
} from "@/lib/multiplayer";

export interface SeatMapEntry {
  seat: number;
  visitor_id: string;
  display_name: string;
}

// Trailing throttle window for host broadcasts. Coalesces bursts (e.g. TUMBLE
// ticks during dice animation) into at most one message per interval, while
// always sending the LAST state of any burst so clients never desync.
const BROADCAST_THROTTLE_MS = 70;

// ---------- HOST ----------

export function useMultiplayerHost(opts: {
  channel: RealtimeChannel | null;
  seatMap: SeatMapEntry[];
  hostVisitorId: string;
  enabled: boolean;
  gameId: string;
  disconnectedSeats: number[];
}) {
  const { channel, seatMap, hostVisitorId, enabled, gameId, disconnectedSeats } = opts;
  const seatCount = Math.max(2, seatMap.length);
  const names = useMemo(() => (seatMap.length ? seatMap.map((e) => e.display_name) : ["Host", "Joiner"]), [seatMap]);
  // 3x3 = 9 cards for multiplayer.
  const g = useGameState("3x3", { seatCount, botSeats: [], names });

  const seqRef = useRef(0);
  const seatMapRef = useRef(seatMap);
  seatMapRef.current = seatMap;

  // ---- claim window tracking ----
  // Increments every time the claim state REOPENS: after a claim resolves
  // (claimBy transitions non-null → null) OR after a round ends (roundNum
  // increments). The claim-lock edge function's UNIQUE (room_id, claim_window)
  // constraint keys on this value.
  const claimWindowRef = useRef(0);
  const prevClaimByRef = useRef<number | null>(null);
  const prevRoundRef = useRef<number>(g.state.roundNum);
  if (g.state.roundNum !== prevRoundRef.current) {
    prevRoundRef.current = g.state.roundNum;
    claimWindowRef.current += 1;
  }
  if (prevClaimByRef.current !== null && g.state.claimBy === null) {
    claimWindowRef.current += 1;
  }
  prevClaimByRef.current = g.state.claimBy;

  // ---- trailing throttle for state broadcasts ----
  const latestStateRef = useRef(g.state);
  latestStateRef.current = g.state;
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentAtRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  channelRef.current = channel;
  const gameIdRef = useRef(gameId);
  gameIdRef.current = gameId;

  // Reset claim window + grant dedupe whenever the game id changes so a new
  // game in the same room starts at claim_window 0 with an unused (room,game)
  // scope, and stale grants from prior games are ignored.
  const prevGameIdRef = useRef(gameId);
  if (prevGameIdRef.current !== gameId) {
    prevGameIdRef.current = gameId;
    claimWindowRef.current = 0;
  }

  const doSend = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    seqRef.current += 1;
    const env: StateEnvelope = {
      v: PROTOCOL_VERSION,
      type: "state",
      seq: seqRef.current,
      payload: toPublicState(
        latestStateRef.current,
        seatMapRef.current,
        claimWindowRef.current,
        gameIdRef.current,
        disconnectedRef.current,
      ),
    };
    lastSentAtRef.current = Date.now();
    ch.send({ type: "broadcast", event: "msg", payload: env }).catch(() => {});
  }, []);

  // Track disconnected seats via a ref (used in doSend) and re-mark skip
  // whenever the reducer resets skip[] (round boundary). MARK_DISCONNECTED
  // is idempotent — the reducer only sets skip=true where it isn't already.
  const disconnectedRef = useRef<number[]>(disconnectedSeats);
  disconnectedRef.current = disconnectedSeats;
  useEffect(() => {
    if (!enabled || disconnectedSeats.length === 0) return;
    // Only dispatch if any listed seat is currently NOT flagged skip=true —
    // avoids a dispatch storm during every state tick.
    const needs = disconnectedSeats.some((s) => !g.state.skip[s]);
    if (needs) g.dispatch({ type: "MARK_DISCONNECTED", seats: disconnectedSeats });
  }, [enabled, disconnectedSeats, g.state.skip, g.state.roundNum, g.dispatch]);

  useEffect(() => {
    if (!enabled || !channel) return;
    const now = Date.now();
    const elapsed = now - lastSentAtRef.current;
    if (elapsed >= BROADCAST_THROTTLE_MS) {
      // Leading edge is fine as long as we STILL schedule a trailing send
      // if any later state change lands inside the window. The pattern
      // below guarantees the final state of a burst is always emitted:
      // we always (re)arm a trailing timer, and cancel it after doSend.
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      doSend();
      return;
    }
    // Inside the throttle window — arm/refresh a trailing send so the LAST
    // state of the burst always ships.
    if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
      doSend();
    }, BROADCAST_THROTTLE_MS - elapsed);
    return () => {
      // No teardown on state change; only clear on unmount below.
    };
  }, [enabled, channel, g.state, doSend]);

  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, []);

  // Receive intents and inject as reducer actions.
  useEffect(() => {
    if (!enabled || !channel) return;
    const handler = (msg: { payload: Envelope }) => {
      const env = msg.payload;
      if (!env || env.v !== PROTOCOL_VERSION) return;
      if (env.type === "intent") {
        const intent: IntentPayload = env.payload;
        const seatEntry = seatMapRef.current.find((e) => e.seat === intent.seat);
        if (!seatEntry) return;
        if (seatEntry.visitor_id !== intent.visitor_id) return;
        if (seatEntry.visitor_id === hostVisitorId) return;
        handleHostIntent(g.dispatch, g.doRollDice, intent.seat, intent.action);
      }
    };
    channel.on("broadcast", { event: "msg" }, handler);
  }, [enabled, channel, g.dispatch, g.doRollDice, hostVisitorId]);

  // Listen for authoritative claim grants from the arbiter edge function.
  // The host is the ONLY dispatcher of PLAYER_ENTER_CLAIM — even the host's
  // own WHOOP goes through the arbiter, then arrives here as a grant.
  const grantedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!enabled || !channel) return;
    const handler = (msg: { payload: Envelope }) => {
      const env = msg.payload;
      if (!env || env.v !== PROTOCOL_VERSION || env.type !== "claim_grant") return;
      const grant = (env as ClaimGrantEnvelope).payload;
      // Only act on the current window — stale grants are ignored.
      if (grant.claim_window !== claimWindowRef.current) return;
      const dedupeKey = `${grant.claim_window}:${grant.seat}`;
      if (grantedRef.current.has(dedupeKey)) return;
      grantedRef.current.add(dedupeKey);
      const phase = latestStateRef.current.phase;
      if (phase === "AWAITING_ROLL") {
        g.dispatch({ type: "PLAYER_ENTER_CLAIM_DURING_ROLL", by: grant.seat });
        // Kick the dice animation so the round proceeds into FLIPPING.
        void g.doRollDice();
      } else if (phase === "FLIPPING") {
        g.dispatch({ type: "PLAYER_ENTER_CLAIM", by: grant.seat });
      }
      // Any other phase (CLAIM_SELECTING, LAST_CALL, GAME_OVER) — ignore.
    };
    channel.on("broadcast", { event: "msg" }, handler);
  }, [enabled, channel, g.dispatch, g.doRollDice]);

  // ---- transient event emission ----
  // The host observes reducer transitions and emits transient events on the
  // wire. GREAT_MATCH fires on the tick a successful claim resolves;
  // NOPE fires on the tick a wrong claim resolves. Events carry a unique id
  // so receivers can dedupe (an event applied twice must not animate twice).
  const eventSeqRef = useRef(0);
  const prevScoresRef = useRef<number[]>(g.state.scores);
  const prevWrongCountRef = useRef<number[]>(g.state.wrongBy.map((s) => s.size));
  useEffect(() => {
    if (!enabled || !channel) return;
    const prevScores = prevScoresRef.current;
    const prevWrong = prevWrongCountRef.current;
    const nextWrong = g.state.wrongBy.map((s) => s.size);
    const send = (kind: TransientEventKind, seat: number) => {
      eventSeqRef.current += 1;
      const ev: TransientEvent = {
        id: `${gameIdRef.current}:${eventSeqRef.current}:${kind}:${seat}`,
        kind, seat, at: Date.now(),
      };
      const env: EventEnvelope = { v: PROTOCOL_VERSION, type: "event", seq: eventSeqRef.current, payload: ev };
      channel.send({ type: "broadcast", event: "msg", payload: env }).catch(() => {});
    };
    for (let i = 0; i < g.state.scores.length; i++) {
      if ((prevScores[i] ?? 0) < (g.state.scores[i] ?? 0)) send("GREAT_MATCH", i);
      if ((prevWrong[i] ?? 0) < (nextWrong[i] ?? 0)) send("NOPE", i);
    }
    prevScoresRef.current = g.state.scores.slice();
    prevWrongCountRef.current = nextWrong;
  }, [enabled, channel, g.state.scores, g.state.wrongBy]);

  return g;
}

// Intent → local reducer dispatch. Reducer's phase/seat guards are the final
// authority; illegal intents (wrong turn, wrong phase, etc.) return the
// unchanged state and are a no-op — not a crash.
//
// NOTE: PLAYER_ENTER_CLAIM* is NOT handled here anymore — WHOOP goes through
// the claim-lock arbiter, which triggers PLAYER_ENTER_CLAIM via a server-side
// broadcast handled by the grant listener above.
function handleHostIntent(
  dispatch: (a: Action) => void,
  doRollDice: () => Promise<string[]>,
  seat: number,
  action: IntentAction,
) {
  switch (action.type) {
    case "REQUEST_ROLL":
      void doRollDice();
      return;
    case "PLAYER_ENTER_CLAIM":
    case "PLAYER_ENTER_CLAIM_DURING_ROLL":
      // Ignored — the arbiter is the only path into claim mode.
      return;
    case "PLAYER_SELECT_CARD":
      dispatch({ type: "PLAYER_SELECT_CARD", by: seat, idx: action.idx });
      return;
    case "PLAYER_RESOLVE_MATCH":
      dispatch({ type: "PLAYER_RESOLVE_MATCH", by: seat });
      return;
    case "FLIP_START":
      dispatch({ type: "FLIP_START", by: seat, idx: action.idx, token: action.token });
      return;
    case "LAST_CALL_CLAIM":
      dispatch({ type: "LAST_CALL_CLAIM", by: seat, a: action.a, b: action.b });
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
