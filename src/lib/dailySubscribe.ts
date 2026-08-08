// ============================================================================
// Daily email capture — one address per person, written through the
// `ac-subscribe` edge function, which owns the database write and then forwards
// the address to the email sender. Never blocks the UI: every failure is
// surfaced as a simple boolean and swallowed otherwise.
// ============================================================================


import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor";

const SUBSCRIBED_KEY = "ww_daily_subscribed";
let inMemorySubscribed = false;

/** Mirrors the server-side check so we never send obvious junk. */
export function isValidEmail(value: string): boolean {
  const email = (value ?? "").trim();
  if (email.length === 0 || email.length > 255) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}

export function hasSubscribed(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(SUBSCRIBED_KEY) === "1";
    }
  } catch {
    // fall through
  }
  return inMemorySubscribed;
}

export function markSubscribed(): void {
  inMemorySubscribed = true;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SUBSCRIBED_KEY, "1");
    }
  } catch {
    // fall through
  }
}

/**
 * Subscribes an address. Duplicates resolve `true` — a repeat signup is quiet,
 * never an error the player sees.
 */
export async function subscribeDaily(
  email: string,
  visitorId: string = getVisitorId(),
  /** Where the signup came from. Omitted keeps the RPC's own default. */
  source?: "daily_result" | "landing"
): Promise<boolean> {
  if (!isValidEmail(email)) return false;
  try {
    const { data, error } = await supabase.rpc("subscribe_daily", {
      p_email: email.trim().toLowerCase(),
      p_visitor_id: visitorId,
      ...(source ? { p_source: source } : {}),
    });
    if (error || data !== true) return false;
    markSubscribed();
    return true;
  } catch {
    return false;
  }
}
