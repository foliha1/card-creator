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
  host_visitor_id: string;
  status: string;
}

export async function createRoom(hostVisitorId: string): Promise<RoomRow> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from("rooms")
      .insert({ room_code: code, host_visitor_id: hostVisitorId })
      .select("id, room_code, host_visitor_id, status")
      .single();
    if (!error && data) return data as RoomRow;
    lastErr = error;
    // 23505 = unique_violation. Retry only for that; otherwise bail.
    if (error && (error as { code?: string }).code !== "23505") break;
  }
  throw new Error(
    lastErr && typeof lastErr === "object" && "message" in lastErr
      ? String((lastErr as { message: string }).message)
      : "Could not create a room. Please try again.",
  );
}

export async function findRoomByCode(code: string): Promise<RoomRow | null> {
  const normalized = code.toUpperCase();
  if (!isValidRoomCode(normalized)) return null;
  const { data, error } = await supabase
    .from("rooms")
    .select("id, room_code, host_visitor_id, status")
    .eq("room_code", normalized)
    .maybeSingle();
  if (error) {
    console.warn("[rooms] lookup failed", error.message);
    return null;
  }
  return (data as RoomRow | null) ?? null;
}
