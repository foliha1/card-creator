// ============================================================================
// useSubscriberStatus — is this player a subscriber?
//
// Two layers, in order:
//   1. localStorage (`ww_daily_email`) — instant, no network.
//   2. the server (`get_subscriber_email` by visitor id) — catches a cleared
//      browser, and repopulates the local flag + email so layer 1 works next
//      time.
//
// The stored *email* is the source of truth, not the boolean flag: the lifetime
// stats read needs an address to union rows across devices.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSubscribed,
  fetchServerSubscriberEmail,
  getSubscribedEmail,
  markSubscribed,
} from "@/lib/dailySubscribe";

export function useSubscriberStatus(
  /** Fired when the server recognises a visitor local storage had forgotten. */
  onRecognized?: () => void
): {
  subscribed: boolean;
  /** The stored address, or null. Drives the "Playing as …" line. */
  email: string | null;
  markLocal: (email: string) => void;
  /** "Not you?" — forgets the address on this browser only. */
  forgetLocal: () => void;
} {
  const [email, setEmail] = useState<string | null>(() => getSubscribedEmail());
  // Once forgotten, an in-flight server lookup must not quietly re-recognise
  // this browser — the player just said it is not them. A ref, because the
  // mount effect's closure would never see a state update.
  const forgotten = useRef(false);

  useEffect(() => {
    if (getSubscribedEmail() !== null) return;
    let live = true;
    void fetchServerSubscriberEmail().then((found) => {
      if (!live || !found || forgotten.current) return;
      markSubscribed(found);
      setEmail(found);
      onRecognized?.();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markLocal = useCallback((next: string) => {
    forgotten.current = false;
    markSubscribed(next);
    setEmail(getSubscribedEmail());
  }, []);

  const forgetLocal = useCallback(() => {
    forgotten.current = true;
    clearSubscribed();
    setEmail(null);
  }, []);


  return { subscribed: email !== null, email, markLocal, forgetLocal };
}

