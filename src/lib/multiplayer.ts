// ============================================================================
// Multiplayer message envelope + intent shapes.
//
// Every broadcast message carries: { v, type, seq, payload }.
//   v   — protocol version. Bumped on breaking changes so stale tabs can
//         detect mismatch instead of silently misrendering.
//   seq — host-issued monotonically increasing counter. Clients ignore any
//         `state` message with seq <= last applied seq. Out-of-order delivery
//         must never rewind the board.
//   type — message discriminator. Today: "state" (host→all), "intent"
//         (joiner→host). A future "event" type (prompt 10) will carry
//         transient feedback (NICE!/TOO SLOW!/Great Match!/NOPE!); the
//         envelope shape is chosen so adding it is not a rewrite.
// ============================================================================

import type { PublicState } from "@/lib/publicState";
import type { Action } from "@/hooks/useGameState";

export const PROTOCOL_VERSION = 1;

// Intent actions a joiner may request. Roll is a special intent because the
// host owns dice animation; the joiner just asks. All other intents map
// 1:1 onto seat-generic reducer actions.
export type IntentAction =
  | { type: "REQUEST_ROLL" }
  | Extract<
      Action,
      | { type: "PLAYER_ENTER_CLAIM" }
      | { type: "PLAYER_ENTER_CLAIM_DURING_ROLL" }
      | { type: "PLAYER_SELECT_CARD" }
      | { type: "PLAYER_RESOLVE_MATCH" }
      | { type: "FLIP_START" }
      | { type: "LAST_CALL_CLAIM" }
    >;

export interface IntentPayload {
  seat: number;
  visitor_id: string; // sender identity for host-side validation
  action: IntentAction;
}

export interface StateEnvelope {
  v: number;
  type: "state";
  seq: number;
  payload: PublicState;
}

export interface IntentEnvelope {
  v: number;
  type: "intent";
  seq: number; // joiners just increment locally; host validates by content
  payload: IntentPayload;
}

// Emitted server-side by the claim-lock edge function on a successful lock.
// The host listens and dispatches PLAYER_ENTER_CLAIM for the granted seat.
// Joiners can ignore it — they see the winner via the next state broadcast.
export interface ClaimGrantEnvelope {
  v: number;
  type: "claim_grant";
  seq: number;
  payload: { claim_window: number; seat: number; visitor_id: string };
}

export type Envelope = StateEnvelope | IntentEnvelope | ClaimGrantEnvelope;

// Set<number>s inside State do not survive JSON.stringify — they serialize as
// {}. toPublicState() already flattens Sets to arrays. These helpers exist for
// callers who serialize arbitrary payloads: keep everything JSON-safe.
export function jsonSerialize(payload: unknown): string {
  return JSON.stringify(payload);
}

export function jsonDeserialize<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
