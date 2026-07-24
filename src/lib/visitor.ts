const STORAGE_KEY = "ww_visitor_id";
let inMemoryId: string | null = null;

function generateUuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  // RFC4122-ish fallback
  const rnd = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-${((Math.random() * 4) | 8).toString(16)}${rnd(3)}-${rnd(12)}`;
}

export function getVisitorId(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const fresh = generateUuid();
      localStorage.setItem(STORAGE_KEY, fresh);
      return fresh;
    }
  } catch {
    // fall through to in-memory
  }
  if (!inMemoryId) inMemoryId = generateUuid();
  return inMemoryId;
}
