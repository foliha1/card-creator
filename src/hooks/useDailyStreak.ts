// ============================================================================
// useDailyStreak — reads the visitor's play streak from the server.
//
// The streak is computed in SQL (get_streak) from daily_results: consecutive
// puzzle numbers played, whether solved or not. A failed fetch returns null so
// callers can hide the line entirely instead of showing a zero.
// ============================================================================

import { useEffect, useState } from "react";
import { fetchStreak, type DailyStreak } from "@/lib/dailyResults";

/**
 * @param puzzleNumber today's puzzle number
 * @param ready        gate — only fetch once true (e.g. after the run is saved)
 * @param refreshKey   bump to re-read (e.g. after an email signup restores rows)
 */
export function useDailyStreak(
  puzzleNumber: number,
  ready = true,
  refreshKey = 0
): DailyStreak | null {
  const [streak, setStreak] = useState<DailyStreak | null>(null);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void fetchStreak(puzzleNumber).then((s) => {
      if (live) setStreak(s);
    });
    return () => {
      live = false;
    };
  }, [puzzleNumber, ready, refreshKey]);

  return streak;
}

