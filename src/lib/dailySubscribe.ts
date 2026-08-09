// ============================================================================
// Daily email capture — one address per person, written through the
// `ac-subscribe` edge function, which owns the database write and then forwards
// the address to the email sender. Never blocks the UI: every failure is
// surfaced as a simple boolean and swallowed otherwise.
// ============================================================================


import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor";

const SUBSCRIBED_KEY = "ww_daily_subscribed";
const EMAIL_KEY = "ww_daily_email";
let inMemorySubscribed = false;
let inMemoryEmail: string | null = null;

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

/**
 * The address this browser subscribed with, if any. Passed to the streak and
 * stats reads so history from a previous device is folded back in.
 */
export function getSubscribedEmail(): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(EMAIL_KEY);
      if (v && isValidEmail(v)) return v;
    }
  } catch {
    // fall through
  }
  return inMemoryEmail;
}

export function markSubscribed(email?: string): void {
  inMemorySubscribed = true;
  const clean = email ? email.trim().toLowerCase() : null;
  if (clean && isValidEmail(clean)) inMemoryEmail = clean;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SUBSCRIBED_KEY, "1");
      if (inMemoryEmail) localStorage.setItem(EMAIL_KEY, inMemoryEmail);
    }
  } catch {
    // fall through
  }
}

/**
 * Server-side recognition. Given this browser's visitor id, returns the address
 * already on file for it (a previous signup on this device, or a run that was
 * linked to an address) — so clearing local storage no longer makes the app
 * forget a subscriber. Null on anything unexpected.
 */
export async function fetchServerSubscriberEmail(
  visitorId: string = getVisitorId()
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_subscriber_email", {
      p_visitor_id: visitorId,
    });
    if (error) return null;
    const email = typeof data === "string" ? data.trim().toLowerCase() : "";
    return isValidEmail(email) ? email : null;
  } catch {
    return null;
  }
}

/**
 * Whether this address already has daily history. Tells a genuine new signup
 * ("You're in.") from a returning player on a fresh browser ("Welcome back.").
 * Failures read as "new" — never block the signup.
 */
export async function emailHasHistory(email: string): Promise<boolean> {
  if (!isValidEmail(email)) return false;
  try {
    const { data, error } = await supabase.rpc("email_has_history", {
      p_email: email.trim().toLowerCase(),
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}


/**
 * Subscribes an address. Duplicates resolve `true` — a repeat signup is quiet,
 * never an error the player sees.
 */
export async function subscribeDaily(
  email: string,
  visitorId: string = getVisitorId(),
  /** Where the signup came from. Omitted keeps the server's own default. */
  source?: "daily_result" | "landing" | "prelaunch"
): Promise<boolean> {
  if (!isValidEmail(email)) return false;
  try {
    const { data, error } = await supabase.functions.invoke("ac-subscribe", {
      body: {
        email: email.trim().toLowerCase(),
        visitorId,
        ...(source ? { source } : {}),
      },
    });
    if (error || (data as { ok?: boolean } | null)?.ok !== true) return false;
    markSubscribed(email);
    return true;
  } catch {
    return false;
  }
}

