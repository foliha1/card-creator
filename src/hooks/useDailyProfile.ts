// ============================================================================
// useDailyProfile — the two "worth giving your email" reads for the results
// screen: lifetime personal stats and today's percentile.
//
// Both are computed in SQL, both run only after the result has been persisted,
// and both resolve to null on any failure so the caller hides the element
// instead of showing zeroes.
// ============================================================================

import { useEffect, useState } from "react";
import {
  fetchDailyPercentile,
  fetchDailyStats,
  type DailyStats,
} from "@/lib/dailyResults";

/**
 * @param puzzleNumber today's puzzle number
 * @param ready        gate — only fetch once the run is saved
 * @param refreshKey   bump to re-read (e.g. after an email signup)
 */
export function useDailyProfile(
  puzzleNumber: number,
  ready = true,
  refreshKey = 0
): { stats: DailyStats | null; percentile: number | null } {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [percentile, setPercentile] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void fetchDailyStats().then((s) => {
      if (live) setStats(s);
    });
    void fetchDailyPercentile(puzzleNumber).then((p) => {
      if (live) setPercentile(p);
    });
    return () => {
      live = false;
    };
  }, [puzzleNumber, ready, refreshKey]);

  return { stats, percentile };
}
