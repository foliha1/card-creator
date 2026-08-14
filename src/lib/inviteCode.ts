// ============================================================================
// Invite code — a stable, random per-browser token used only in invite links.
//
// Deliberately NOT derived from the visitor id: an invite link is handed to
// other people, so it must not carry an identifier we use anywhere else.
// ============================================================================

const STORAGE_KEY = "ww_invite_code";
/** No look-alike characters: no 0/o, 1/l/i, or 7. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 8;

let inMemoryCode: string | null = null;

function generateCode(): string {
  const n = ALPHABET.length;
  let out = "";
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(LENGTH);
      crypto.getRandomValues(bytes);
      for (let i = 0; i < LENGTH; i += 1) out += ALPHABET[bytes[i] % n];
      return out;
    }
  } catch {
    // fall through
  }
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * n)];
  }
  return out;
}

export function getInviteCode(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const fresh = generateCode();
      localStorage.setItem(STORAGE_KEY, fresh);
      return fresh;
    }
  } catch {
    // fall through
  }
  if (!inMemoryCode) inMemoryCode = generateCode();
  return inMemoryCode;
}
