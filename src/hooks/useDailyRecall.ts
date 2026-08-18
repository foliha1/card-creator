// ============================================================================
// useDailyRecall — the recall trend behind the results-screen line.
//
// Reads the player's stored games (visitor rows unioned with any rows linked to
// a known email, so a switched device still reads its whole history) and
// reduces them to one trend. Null on any failure or too little history, so the
// caller renders nothing at all.
// ============================================================================

import { useEffect, useState } from "react";
import { fetchDailyResults } from "@/lib/dailyResults";
import { getSubscribedEmail } from "@/lib/dailySubscribe";
import { computeRecallTrend, type RecallTrend } from "@/lib/dailyRecall";

/**
 * @param ready      gate — only fetch once the run is saved
 * @param refreshKey bump to re-read (e.g. after an email signup)
 */
export function useDailyRecall(ready = true, refreshKey = 0): RecallTrend | null {
  const [trend, setTrend] = useState<RecallTrend | null>(null);

  // Preview-only override: ?recall=64-55 (late-early) or ?recall=1 for a sample.
  // Never affects real players — it only reads the URL, writes nothing.
  const fake = readFakeRecall();

  useEffect(() => {
    if (fake) return;
    if (!ready) return;
    let live = true;
    void fetchDailyResults(undefined, getSubscribedEmail()).then((rows) => {
      if (live) setTrend(computeRecallTrend(rows));
    });
    return () => {
      live = false;
    };
  }, [ready, refreshKey, fake]);

  return fake ?? trend;
}

/** Parses `?recall=` into a trend for demoing the line. Null when absent. */
function readFakeRecall(): RecallTrend | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("recall");
  if (!raw) return null;
  if (raw === "1" || raw === "true") return { latePct: 64, earlyPct: 55, upPoints: 9 };
  if (raw === "flat") return { latePct: 64, earlyPct: 70, upPoints: null };
  const m = /^(\d{1,3})-(\d{1,3})$/.exec(raw);
  if (!m) return null;
  const latePct = Math.min(100, Number(m[1]));
  const earlyPct = Math.min(100, Number(m[2]));
  const rise = latePct - earlyPct;
  return { latePct, earlyPct, upPoints: rise >= 1 ? rise : null };
}


export default useDailyRecall;
