// ============================================================================
// useHeartbeat — application-level liveness, independent of Supabase presence.
//
// Rationale: Supabase presence 'leave' events cannot be relied on. A crashed
// or backgrounded client never untracks, and server-side reap of a dead
// socket has been observed to take well over a minute — long enough for the
// flip rotation to hard-lock on the ghost seat.
//
// Every mounted room client broadcasts a heartbeat every HEARTBEAT_INTERVAL_MS
// on the shared channel. Each heartbeat carries a `hidden` flag sourced from
// document.hidden — flipped explicitly on visibilitychange with an immediate
// broadcast so the host does not have to wait for the next interval (which,
// on hidden tabs, browsers throttle to ~1/minute). The host consumes these
// to build TWO sets:
//   - stale  → visitors past HEARTBEAT_STALE_MS with no recent visible ping
//              AND past HEARTBEAT_HIDDEN_STALE_MS if they last reported hidden.
//              This is the GONE set.
//   - away   → visitors currently reporting hidden but still within the
//              hidden-stale window. AWAY, not GONE.
//
// The host merges stale with the presence-based disconnected set; either
// signal is sufficient to mark a seat disconnected. SET_DISCONNECTED uses
// REPLACE semantics on the reducer, so resuming heartbeats automatically
// un-marks a seat — no explicit reconnect action required. AWAY is a UI-only
// signal; it does not feed the reducer, so the flip rotation does not skip
// a merely-backgrounded seat and the "fewer than 2 connected" end-game
// backstop does not fire on transient hides.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  AWAY_SKIP_MS,
  HEARTBEAT_END_GAME_STALE_MS,
  HEARTBEAT_HIDDEN_STALE_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  PROTOCOL_VERSION,
  type Envelope,
  type HeartbeatEnvelope,
} from "@/lib/multiplayer";
import type { BroadcastSubscribe } from "@/hooks/useMultiplayerGame";

// EVERY client (host and joiner) calls this. Sends heartbeats on a fixed
// cadence for the lifetime of the channel. Cheap: one broadcast every 5s.
// Additionally sends immediately on visibilitychange so hide→show and
// show→hide transitions do not have to wait for the throttled interval on
// hidden tabs.
export function useHeartbeatSender(
  channel: RealtimeChannel | null,
  visitorId: string,
  enabled: boolean,
): void {
  const seqRef = useRef(0);
  useEffect(() => {
    if (!enabled || !channel) return;
    const send = () => {
      seqRef.current += 1;
      const env: HeartbeatEnvelope = {
        v: PROTOCOL_VERSION,
        type: "heartbeat",
        seq: seqRef.current,
        payload: {
          visitor_id: visitorId,
          at: Date.now(),
          hidden: typeof document !== "undefined" ? document.hidden : false,
        },
      };
      channel.send({ type: "broadcast", event: "msg", payload: env }).catch(() => {});
    };
    // Send immediately on wire-up so the host doesn't need to wait a full
    // interval to see us. Then on the fixed cadence.
    send();
    const id = window.setInterval(send, HEARTBEAT_INTERVAL_MS);
    // visibilitychange fires reliably on both hide and show, including on
    // mobile Safari (unlike pagehide/beforeunload for the hide case). Send
    // immediately on either edge — the show-edge send is the critical one:
    // it un-marks an AWAY chip the moment the tab returns without waiting
    // for the throttled interval to catch up.
    const onVis = () => send();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [channel, visitorId, enabled]);
}

export interface HeartbeatMonitorResult {
  staleVisitors: string[];
  awayVisitors: string[];
  // Visitors whose LAST heartbeat (any state, hidden or visible) arrived more
  // than HEARTBEAT_END_GAME_STALE_MS ago, OR who were never heard from past
  // the same grace window. This is the stricter "table empty" signal — a
  // hidden-but-still-pinging client is NOT in this set. Used ONLY by the
  // irreversible end-game guard, never by SET_DISCONNECTED or turn skipping.
  endGameVisitors: string[];
}

// HOST-ONLY. Watches inbound heartbeats and derives:
//   - staleVisitors: visitor_ids past their applicable stale threshold
//     (HEARTBEAT_STALE_MS if last seen visible, HEARTBEAT_HIDDEN_STALE_MS if
//     last seen hidden). Feeds SET_DISCONNECTED → GONE.
//   - awayVisitors: visitor_ids that last reported hidden and are within the
//     hidden-stale window. UI-only → AWAY.
//
// Only visitor_ids in `watchedVisitorIds` are tracked — that's the frozen
// seatMap post-start. The host is treated as always-live and never appears
// in either set.
export function useHeartbeatMonitor(opts: {
  channel: RealtimeChannel | null;
  onBroadcast: BroadcastSubscribe;
  enabled: boolean;
  watchedVisitorIds: string[];
  hostVisitorId: string;
}): HeartbeatMonitorResult {
  const { channel, onBroadcast, enabled, watchedVisitorIds, hostVisitorId } = opts;
  const [staleVisitors, setStaleVisitors] = useState<string[]>([]);
  const [awayVisitors, setAwayVisitors] = useState<string[]>([]);
  const [endGameVisitors, setEndGameVisitors] = useState<string[]>([]);

  // Last local receive time + last-known hidden flag, per visitor.
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const hiddenRef = useRef<Map<string, boolean>>(new Map());
  const monitorStartRef = useRef<number>(Date.now());
  const watchedRef = useRef<string[]>(watchedVisitorIds);
  watchedRef.current = watchedVisitorIds;
  const hostRef = useRef<string>(hostVisitorId);
  hostRef.current = hostVisitorId;

  // Reset the mount reference when monitoring (re)enables so grace period
  // is measured from THIS enable, not from the component's original mount.
  useEffect(() => {
    if (!enabled) return;
    monitorStartRef.current = Date.now();
    lastSeenRef.current = new Map();
    hiddenRef.current = new Map();
    setStaleVisitors([]);
    setAwayVisitors([]);
    setEndGameVisitors([]);
  }, [enabled]);

  // Ingest heartbeats. Uses LOCAL receive time — sender clocks are untrusted.
  useEffect(() => {
    if (!enabled || !channel) return;
    const handler = (msg: { payload: unknown }) => {
      const env = msg.payload as Envelope;
      if (!env || env.v !== PROTOCOL_VERSION || env.type !== "heartbeat") return;
      const hb = (env as HeartbeatEnvelope).payload;
      if (!hb?.visitor_id) return;
      lastSeenRef.current.set(hb.visitor_id, Date.now());
      hiddenRef.current.set(hb.visitor_id, !!hb.hidden);
    };
    return onBroadcast(handler);
  }, [enabled, channel, onBroadcast]);

  // Recompute sets on a poll. Cheap — bounded by seat count (≤ 6).
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = Date.now();
      const started = monitorStartRef.current;
      const graceExpired = now - started > HEARTBEAT_STALE_MS;
      const endGameGraceExpired = now - started > HEARTBEAT_END_GAME_STALE_MS;
      const stale: string[] = [];
      const away: string[] = [];
      const endGame: string[] = [];
      for (const vid of watchedRef.current) {
        if (vid === hostRef.current) continue; // host is authoritative
        const last = lastSeenRef.current.get(vid);
        const hidden = hiddenRef.current.get(vid) === true;
        if (last == null) {
          // Never heard from. Stale after the normal grace, end-game only
          // after the much longer grace — so a slow-joining peer can't tip
          // the table below the end-game floor on the host's first minute.
          if (graceExpired) stale.push(vid);
          if (endGameGraceExpired) endGame.push(vid);
          continue;
        }
        const age = now - last;
        // Apply the extended threshold if the LAST heartbeat we got said the
        // client was hidden — that heartbeat is our only evidence the tab
        // still exists, so trust it until the long threshold expires.
        const threshold = hidden ? HEARTBEAT_HIDDEN_STALE_MS : HEARTBEAT_STALE_MS;
        if (age > threshold) {
          stale.push(vid);
        } else if (hidden) {
          away.push(vid);
        }
        // End-game set is intentionally hidden-agnostic: only a total
        // heartbeat blackout for the long window counts. A hidden client
        // that is still pinging is proof-of-life and stays OUT of this set.
        if (age > HEARTBEAT_END_GAME_STALE_MS) endGame.push(vid);
      }
      const same = (prev: string[], next: string[]) =>
        prev.length === next.length && prev.every((v, i) => v === next[i]);
      setStaleVisitors((prev) => (same(prev, stale) ? prev : stale));
      setAwayVisitors((prev) => (same(prev, away) ? prev : away));
      setEndGameVisitors((prev) => (same(prev, endGame) ? prev : endGame));
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return { staleVisitors, awayVisitors, endGameVisitors };
}

// Host-drop note: if the host tab is the one that dies, no one is running
// this monitor — there is no other authority in the current architecture.
// The remaining clients will simply stop receiving state broadcasts and
// heartbeats from the host; the reducer they see is frozen at the last
// snapshot. Host migration is out of scope for this hook and would require
// a separate election/promotion pass.
