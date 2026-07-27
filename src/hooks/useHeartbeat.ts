// ============================================================================
// useHeartbeat — application-level liveness, independent of Supabase presence.
//
// Rationale: Supabase presence 'leave' events cannot be relied on. A crashed
// or backgrounded client never untracks, and server-side reap of a dead
// socket has been observed to take well over a minute — long enough for the
// flip rotation to hard-lock on the ghost seat.
//
// Every mounted room client broadcasts a heartbeat every HEARTBEAT_INTERVAL_MS
// on the shared channel. The host consumes these to build a live set of
// visitor_ids that have gone stale (last heartbeat older than
// HEARTBEAT_STALE_MS) — including visitor_ids we have NEVER heard from
// after a grace period equal to the stale threshold from the host's mount.
//
// The host merges this set with the presence-based one; either signal is
// sufficient to mark a seat disconnected. SET_DISCONNECTED uses REPLACE
// semantics on the reducer, so resuming heartbeats automatically un-mark a
// seat — no explicit reconnect action required.
//
// Not solved here: if the HOST itself is the client that drops, no one is
// running the monitor. See return note at bottom of this file.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  PROTOCOL_VERSION,
  type Envelope,
  type HeartbeatEnvelope,
} from "@/lib/multiplayer";
import type { BroadcastSubscribe } from "@/hooks/useMultiplayerGame";

// EVERY client (host and joiner) calls this. Sends heartbeats on a fixed
// cadence for the lifetime of the channel. Cheap: one broadcast every 5s.
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
        payload: { visitor_id: visitorId, at: Date.now() },
      };
      channel.send({ type: "broadcast", event: "msg", payload: env }).catch(() => {});
    };
    // Send immediately on wire-up so the host doesn't need to wait a full
    // interval to see us. Then on the fixed cadence.
    send();
    const id = window.setInterval(send, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [channel, visitorId, enabled]);
}

// HOST-ONLY. Watches inbound heartbeats and derives the set of visitor_ids
// that have gone stale. Only visitor_ids in `watchedVisitorIds` are tracked
// — that's the frozen seatMap post-start; before that we don't care.
//
// The host is treated as always-live (its own heartbeat is authoritative and
// its clock IS the reference). We still record it, but it can never appear
// in the stale set — the host cannot mark itself disconnected.
export function useHeartbeatMonitor(opts: {
  channel: RealtimeChannel | null;
  onBroadcast: BroadcastSubscribe;
  enabled: boolean;
  watchedVisitorIds: string[];
  hostVisitorId: string;
}): string[] {
  const { channel, onBroadcast, enabled, watchedVisitorIds, hostVisitorId } = opts;
  const [staleVisitors, setStaleVisitors] = useState<string[]>([]);

  const lastSeenRef = useRef<Map<string, number>>(new Map());
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
    setStaleVisitors([]);
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
    };
    return onBroadcast(handler);
  }, [enabled, channel, onBroadcast]);

  // Recompute stale set on a poll. Cheap — bounded by seat count (≤ 6).
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = Date.now();
      const started = monitorStartRef.current;
      const graceExpired = now - started > HEARTBEAT_STALE_MS;
      const stale: string[] = [];
      for (const vid of watchedRef.current) {
        if (vid === hostRef.current) continue; // host is authoritative
        const last = lastSeenRef.current.get(vid);
        if (last == null) {
          // Never heard from — only count as stale AFTER the grace period,
          // so a fresh host mount doesn't ghost every peer for the first
          // 15 seconds while we wait for their first heartbeat.
          if (graceExpired) stale.push(vid);
        } else if (now - last > HEARTBEAT_STALE_MS) {
          stale.push(vid);
        }
      }
      setStaleVisitors((prev) => {
        // Stable identity when membership unchanged — prevents needless
        // downstream memo invalidation.
        if (prev.length === stale.length && prev.every((v, i) => v === stale[i])) return prev;
        return stale;
      });
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return staleVisitors;
}

// Host-drop note: if the host tab is the one that dies, no one is running
// this monitor — there is no other authority in the current architecture.
// The remaining clients will simply stop receiving state broadcasts and
// heartbeats from the host; the reducer they see is frozen at the last
// snapshot. Host migration is out of scope for this hook and would require
// a separate election/promotion pass.
