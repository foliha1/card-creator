import { supabase } from "@/integrations/supabase/client";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
const MAX_ATTEMPTS = 5;

export function generateRoomCode(): string {
  let out = "";
  const bytes = new Uint32Array(CODE_LEN);
  try {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  } catch {
    for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== CODE_LEN) return false;
  for (const ch of code) if (!ALPHABET.includes(ch)) return false;
  return true;
}

export const ROOM_CODE_ALPHABET = ALPHABET;
export const ROOM_CODE_LENGTH = CODE_LEN;

export interface RoomRow {
  id: string;
  room_code: string;
  status: string;
  is_host: boolean;
}

function errorCode(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}

export async function createRoom(hostVisitorId: string): Promise<RoomRow> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    try {
      const { data, error } = await supabase.rpc("create_room", {
        p_code: code,
        p_visitor_id: hostVisitorId,
      });
      if (!error && data && Array.isArray(data) && data.length > 0) {
        return data[0] as RoomRow;
      }
      lastErr = error;
      // 23505 = unique_violation. Retry only for that; otherwise bail.
      if (error && errorCode(error) !== "23505") break;
    } catch (e) {
      // Network / thrown failure — do not retry blindly.
      lastErr = e;
      break;
    }
  }
  const msg =
    lastErr && typeof lastErr === "object" && "message" in lastErr
      ? String((lastErr as { message: string }).message)
      : "Could not create a room. Please try again.";
  throw new Error(msg);
}

export async function findRoomByCode(
  code: string,
  visitorId: string,
): Promise<RoomRow | null> {
  const normalized = code.toUpperCase();
  if (!isValidRoomCode(normalized)) return null;
  try {
    const { data, error } = await supabase.rpc("get_room_by_code", {
      p_code: normalized,
      p_visitor_id: visitorId,
    });
    if (error) {
      console.warn("[rooms] lookup failed", error.message);
      return null;
    }
    if (Array.isArray(data) && data.length > 0) return data[0] as RoomRow;
    return null;
  } catch (e) {
    console.warn("[rooms] lookup threw", e);
    return null;
  }
}
