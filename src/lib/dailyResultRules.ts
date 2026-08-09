// ============================================================================
// Plausibility rules for a submitted daily run.
//
// THE SERVER IS THE AUTHORITY: `public.daily_result_reject_reason` in the
// database decides what is written. This module is a faithful mirror of that
// function, kept so the rules can be tested and reasoned about in one place.
// Changing a rule means changing both, and the parity tests exist to catch it.
//
// It is intentionally NOT used by the write path: the client never gets a vote.
// ============================================================================

import { DAILY_ROUNDS, MISSES_PER_ROUND, type DailyMark } from "@/lib/dailyEngine";

/** Launch day, as a UTC calendar date. Puzzle #1. */
export const DAILY_LAUNCH_DATE = "2026-08-11";

/**
 * Minimum thinking time credited to each recorded mark.
 *
 * The daily clock is a *thinking* clock: the engine pauses it during the roll
 * hero, the reveal, the match settle and the Whooped beat, so animation lengths
 * are not part of it and cannot be used as the floor. What every mark does
 * require is two deliberate card taps, so the floor is a tap cadence: 250ms per
 * mark. A clean three-round run therefore cannot finish under 750ms, and a
 * six-miss run cannot finish under 2250ms.
 */
export const MIN_MS_PER_EVENT = 250;

export type DailyRejectReason =
  | "missing_puzzle"
  | "puzzle_mismatch"
  | "date_out_of_window"
  | "rounds_out_of_range"
  | "misses_out_of_range"
  | "events_shape"
  | "events_round_length"
  | "events_bad_mark"
  | "events_impossible_round"
  | "events_solves_mismatch"
  | "events_misses_mismatch"
  | "elapsed_too_fast";

export interface DailySubmission {
  puzzleNumber: number | null;
  /** `YYYY-MM-DD`. */
  puzzleDate: string | null;
  roundsSolved: number | null;
  totalMisses: number | null;
  roundEvents: unknown;
  elapsedMs: number | null;
}

const MS_PER_DAY = 86_400_000;

function dayNumber(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  if (!Number.isFinite(t)) return null;
  return Math.round(t / MS_PER_DAY);
}

/**
 * Null when the run is acceptable, else the reason it is refused.
 * `todayUtc` is the server's UTC calendar date.
 */
export function dailyResultRejectReason(
  s: DailySubmission,
  todayUtc: string
): DailyRejectReason | null {
  const n = s.puzzleNumber;
  const date = s.puzzleDate;
  if (n === null || n === undefined || !date) return "missing_puzzle";

  const day = dayNumber(date);
  const launch = dayNumber(DAILY_LAUNCH_DATE)!;
  const today = dayNumber(todayUtc);
  if (day === null || today === null) return "missing_puzzle";

  // puzzle_number is a pure function of puzzle_date.
  if (n !== day - launch + 1 || n < 1) return "puzzle_mismatch";

  // The date is the player's LOCAL date and locales span UTC-12..UTC+14, so one
  // calendar day either side is the widest honest window — and no wider. Before
  // launch the window anchors on launch day so pre-launch testing can write.
  const anchor = Math.max(today, launch);
  if (day < anchor - 1 || day > anchor + 1) return "date_out_of_window";

  const solved = s.roundsSolved;
  if (solved === null || solved === undefined || solved < 0 || solved > DAILY_ROUNDS) {
    return "rounds_out_of_range";
  }

  const misses = s.totalMisses;
  if (
    misses === null ||
    misses === undefined ||
    misses < 0 ||
    misses > DAILY_ROUNDS * MISSES_PER_ROUND
  ) {
    return "misses_out_of_range";
  }

  const rounds = s.roundEvents;
  if (!Array.isArray(rounds) || rounds.length !== DAILY_ROUNDS) return "events_shape";

  let solves = 0;
  let missCount = 0;
  let events = 0;

  for (const round of rounds) {
    if (!Array.isArray(round)) return "events_shape";
    if (round.length < 1 || round.length > MISSES_PER_ROUND) {
      return "events_round_length";
    }

    let rSolves = 0;
    let rMisses = 0;
    for (const mark of round as DailyMark[]) {
      if (mark === "SOLVE") rSolves += 1;
      else if (mark === "MISS") rMisses += 1;
      else return "events_bad_mark";
    }

    // A round ends either on a solve (necessarily its last mark) or on the
    // second miss. Anything else could not have happened.
    if (rSolves > 1) return "events_impossible_round";
    if (rSolves === 1 && round[round.length - 1] !== "SOLVE") {
      return "events_impossible_round";
    }
    if (rSolves === 0 && rMisses !== MISSES_PER_ROUND) {
      return "events_impossible_round";
    }

    solves += rSolves;
    missCount += rMisses;
    events += round.length;
  }

  if (solves !== solved) return "events_solves_mismatch";
  if (missCount !== misses) return "events_misses_mismatch";

  const elapsed = s.elapsedMs;
  if (elapsed === null || elapsed === undefined || elapsed < events * MIN_MS_PER_EVENT) {
    return "elapsed_too_fast";
  }

  return null;
}
