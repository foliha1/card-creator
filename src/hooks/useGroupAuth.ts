// ============================================================================
// useGroupAuth — the account behind groups, and nothing else.
//
// Groups are the one place in the product that shows one person's result to
// other people, so they are the one place that needs a real account. Playing,
// subscribing, restoring, streaks, stats and the recall trend stay anonymous:
// nothing in this file is imported by any of them.
//
// On the first session seen, the device's play history is stamped with the
// account address through `backfill_result_emails` — capped, idempotent, and
// never overwriting a differing address. Without it, someone who signs in with
// an address their results were never tagged with reads as "not played" on
// every board forever.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor";

/** Survives the magic-link round trip, which leaves and re-enters the app. */
const PENDING_JOIN_KEY = "ww_group_pending_join";

export function readPendingJoin(): string {
  try {
    return window.localStorage.getItem(PENDING_JOIN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writePendingJoin(code: string): void {
  try {
    if (code) window.localStorage.setItem(PENDING_JOIN_KEY, code);
    else window.localStorage.removeItem(PENDING_JOIN_KEY);
  } catch {
    /* private mode: the query string still carries the code */
  }
}

export function clearPendingJoin(): void {
  writePendingJoin("");
}

export type GroupAuth = {
  session: Session | null;
  /** Null until the first session read resolves, so nothing flashes. */
  ready: boolean;
  email: string | null;
  sendLink: (email: string, redirectTo: string) => Promise<void>;
  signOut: () => void;
};

export function useGroupAuth(): GroupAuth {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const linked = useRef<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Link this device's history to the account, once per account per mount.
  useEffect(() => {
    const email = session?.user?.email ?? null;
    if (!email || linked.current === email) return;
    linked.current = email;
    void supabase
      .rpc("backfill_result_emails", {
        p_visitor_id: getVisitorId(),
        p_email: email,
        p_limit: 500,
      })
      .then(() => undefined, () => undefined);
  }, [session]);

  const sendLink = useCallback(async (email: string, redirectTo: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(() => {
    void supabase.auth.signOut();
  }, []);

  return { session, ready, email: session?.user?.email ?? null, sendLink, signOut };
}

export default useGroupAuth;
