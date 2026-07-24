import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PresenceStatus = "connecting" | "connected" | "error";

export interface PresenceParticipant {
  visitor_id: string;
  display_name: string;
  joined_at: number;
}

interface PresenceMeta {
  visitor_id: string;
  display_name: string;
  joined_at: number;
}

/**
 * Subscribes to Supabase Realtime PRESENCE for a room.
 *
 * SEAT ORDERING: This ordering is LOBBY-ONLY and provisional. Presence is
 * ephemeral and may reorder on reconnect. Seats MUST be frozen at game start
 * in a later prompt — do not build anything downstream that assumes the seat
 * indices derived from this hook are stable once a game begins.
 *
 * The hook only orders by joined_at then visitor_id. The caller supplies
 * host identity separately (from rooms.is_host) and pins the host to seat 0.
 */
export function useRoomPresence(
  roomId: string | null,
  visitorId: string,
  displayName: string,
): { participants: PresenceParticipant[]; status: PresenceStatus } {
  const [participants, setParticipants] = useState<PresenceParticipant[]>([]);
  const [status, setStatus] = useState<PresenceStatus>("connecting");
  const joinedAtRef = useRef<number>(Date.now());

  // Stable display name ref so re-track doesn't churn on every keystroke.
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  useEffect(() => {
    if (!roomId) {
      setParticipants([]);
      setStatus("connecting");
      return;
    }

    joinedAtRef.current = Date.now();
    setStatus("connecting");

    const channel: RealtimeChannel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: visitorId },
      },
    });

    const syncParticipants = () => {
      const state = channel.presenceState<PresenceMeta>();
      const seen = new Map<string, PresenceParticipant>();
      for (const key of Object.keys(state)) {
        const metas = state[key];
        if (!metas || metas.length === 0) continue;
        // Pick the earliest joined_at meta for this visitor.
        let best: PresenceMeta | null = null;
        for (const m of metas) {
          if (!best || m.joined_at < best.joined_at) best = m;
        }
        if (best) {
          seen.set(best.visitor_id, {
            visitor_id: best.visitor_id,
            display_name: best.display_name,
            joined_at: best.joined_at,
          });
        }
      }
      const list = Array.from(seen.values()).sort((a, b) => {
        if (a.joined_at !== b.joined_at) return a.joined_at - b.joined_at;
        return a.visitor_id.localeCompare(b.visitor_id);
      });
      setParticipants(list);
    };

    channel
      .on("presence", { event: "sync" }, syncParticipants)
      .on("presence", { event: "join" }, syncParticipants)
      .on("presence", { event: "leave" }, syncParticipants)
      .subscribe(async (subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          try {
            await channel.track({
              visitor_id: visitorId,
              display_name: displayNameRef.current,
              joined_at: joinedAtRef.current,
            } satisfies PresenceMeta);
            setStatus("connected");
          } catch (e) {
            console.warn("[presence] track failed", e);
            setStatus("error");
          }
        } else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT") {
          setStatus("error");
        } else if (subStatus === "CLOSED") {
          setStatus("connecting");
        }
      });

    return () => {
      try {
        channel.untrack();
      } catch {
        // ignore
      }
      supabase.removeChannel(channel);
    };
  }, [roomId, visitorId]);

  // If display name changes while connected, re-track quietly.
  useEffect(() => {
    if (!roomId || status !== "connected") return;
    const channel = supabase.getChannels().find((c) => c.topic === `realtime:room:${roomId}`);
    if (!channel) return;
    channel
      .track({
        visitor_id: visitorId,
        display_name: displayName,
        joined_at: joinedAtRef.current,
      } satisfies PresenceMeta)
      .catch(() => {
        /* non-fatal */
      });
  }, [displayName, roomId, status, visitorId]);

  return useMemo(() => ({ participants, status }), [participants, status]);
}
