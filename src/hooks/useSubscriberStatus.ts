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

import { useCallback, useEffect, useState } from "react";
import {
  fetchServerSubscriberEmail,
  getSubscribedEmail,
  markSubscribed,
} from "@/lib/dailySubscribe";

export function useSubscriberStatus(
  /** Fired when the server recognises a visitor local storage had forgotten. */
  onRecognized?: () => void
): { subscribed: boolean; markLocal: (email: string) => void } {
  const [subscribed, setSubscribed] = useState(
    () => getSubscribedEmail() !== null
  );

  useEffect(() => {
    if (getSubscribedEmail() !== null) return;
    let live = true;
    void fetchServerSubscriberEmail().then((email) => {
      if (!live || !email) return;
      markSubscribed(email);
      setSubscribed(true);
      onRecognized?.();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markLocal = useCallback((email: string) => {
    markSubscribed(email);
    setSubscribed(true);
  }, []);

  return { subscribed, markLocal };
}
