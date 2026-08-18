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

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void fetchDailyResults(undefined, getSubscribedEmail()).then((rows) => {
      if (live) setTrend(computeRecallTrend(rows));
    });
    return () => {
      live = false;
    };
  }, [ready, refreshKey]);

  return trend;
}

export default useDailyRecall;
