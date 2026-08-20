// ============================================================================
// Daily streak milestone — every 10th day (10, 20, 30, …).
//
// Pure helpers only: the trigger test, the once-per-puzzle guard, and the
// preview flag. The streak itself is never computed here — the results screen
// passes in the number it already displays.
// ============================================================================

/** True for 10, 20, 30, … and false for 0, 9, 11, 19, negatives and null. */
export function isMilestoneStreak(streak: number | null | undefined): boolean {
  if (typeof streak !== "number" || !Number.isFinite(streak)) return false;
  if (streak <= 0) return false;
  return streak % 10 === 0;
}

const KEY = (puzzleNumber: number) => `ww-daily-milestone-${puzzleNumber}`;

/** Has the celebration already played for this puzzle on this device? */
export function hasCelebrated(puzzleNumber: number): boolean {
  try {
    return window.localStorage.getItem(KEY(puzzleNumber)) === "1";
  } catch {
    return false;
  }
}

/** Marks the celebration as played. Never called in preview mode. */
export function markCelebrated(puzzleNumber: number): void {
  try {
    window.localStorage.setItem(KEY(puzzleNumber), "1");
  } catch {
    /* private mode — the burst simply may replay */
  }
}

/**
 * Preview flag: `?milestone=1`. Deliberately independent of `?debug=1`, which
 * disables event tracking — this can be previewed on a normal tracked session.
 * Preview forces the milestone visuals only: it writes no result, changes no
 * stored streak, and never sets the once-per-puzzle guard.
 */
export function isMilestonePreview(search?: string): boolean {
  const raw =
    search ?? (typeof window === "undefined" ? "" : window.location.search);
  return new URLSearchParams(raw).get("milestone") === "1";
}

/** The streak shown while previewing, when the real streak is not a multiple of 10. */
export const PREVIEW_STREAK = 10;
