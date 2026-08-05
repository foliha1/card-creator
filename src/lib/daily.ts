// ============================================================================
// Daily puzzle helpers — seed + puzzle number, both derived from the device's
// LOCAL calendar date, so the puzzle rolls over at each player's own midnight
// while everyone on the same calendar date shares the same puzzle.
// ============================================================================

import { DAILY_ROUNDS, type DailyMark } from "@/lib/dailyEngine";

/** Fixed launch day. Puzzle #1 is the local calendar date 2026-08-01. */
export const DAILY_LAUNCH_UTC = Date.UTC(2026, 7, 1); // 2026-08-01

const MS_PER_DAY = 86_400_000;

/**
 * `YYYY-MM-DD` for the given date in the device's local time zone.
 * Single source of truth for every date the daily puzzle keys off.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DD` (local). */
export function getDailyDateKey(date: Date = new Date()): string {
  return getLocalDateString(date);
}

/** The shared seed for the day, e.g. `whoop-2026-08-04`. */
export function getDailySeed(date: Date = new Date()): string {
  return `whoop-${getLocalDateString(date)}`;
}

/**
 * Days elapsed since launch, starting at 1, counted in whole calendar days.
 * Calendar parts are projected onto UTC midnight before differencing, so DST
 * transitions can never skip or repeat a day.
 */
export function getDailyNumber(date: Date = new Date()): number {
  const [y, m, d] = getLocalDateString(date).split("-").map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - DAILY_LAUNCH_UTC) / MS_PER_DAY);
  return Math.max(1, days + 1);
}


// ---------------------------------------------------------------------------
// One attempt per day — completion record in localStorage.
// ---------------------------------------------------------------------------

export interface DailyResult {
  seed: string;
  puzzleNumber: number;
  /** The three rules the dice landed on, in round order. */
  attributes: ("SHAPE" | "NUMBER" | "COLOR")[];
  /** Total run time in ms. Recorded silently as a future tiebreak. */
  elapsedMs: number;
  /** Rounds solved by a correct call, 0 → 3. */
  roundsSolved: number;
  /** Misses spent across the run. */
  totalMisses: number;
  /** Per-round event lists, index 0 = round 1. */
  roundEvents: DailyMark[][];
  /** Whether the single peek was spent. */
  peekUsed: boolean;
  /** The round the peek was used in, or null. */
  peekRound: number | null;
  /** True when no round was solved. */
  failed: boolean;
  completedAt: string;
}

export function dailyStorageKey(seed: string): string {
  return `ww_daily_${seed}`;
}

const emptyRounds = (): DailyMark[][] =>
  Array.from({ length: DAILY_ROUNDS }, () => [] as DailyMark[]);

export function loadDailyResult(seed: string): DailyResult | null {
  try {
    const raw = window.localStorage.getItem(dailyStorageKey(seed));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyResult> & {
      attribute?: DailyResult["attributes"][number];
      missesUsed?: number;
      wrongCalls?: number;
    };
    if (typeof parsed?.elapsedMs !== "number") return null;
    // Legacy single-round records stored one `attribute` instead of three.
    const attributes = Array.isArray(parsed.attributes)
      ? parsed.attributes
      : parsed.attribute
        ? [parsed.attribute]
        : [];
    const totalMisses =
      typeof parsed.totalMisses === "number"
        ? parsed.totalMisses
        : (parsed.missesUsed ?? parsed.wrongCalls ?? 0);
    const roundEvents = Array.isArray(parsed.roundEvents)
      ? parsed.roundEvents
      : emptyRounds();
    return {
      seed: parsed.seed ?? seed,
      puzzleNumber: parsed.puzzleNumber ?? 1,
      attributes,
      elapsedMs: parsed.elapsedMs,
      roundsSolved: typeof parsed.roundsSolved === "number" ? parsed.roundsSolved : 0,
      totalMisses,
      roundEvents,
      peekUsed: parsed.peekUsed === true,
      peekRound: typeof parsed.peekRound === "number" ? parsed.peekRound : null,
      failed: parsed.failed === true,
      completedAt: parsed.completedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDailyResult(result: DailyResult): void {
  try {
    window.localStorage.setItem(
      dailyStorageKey(result.seed),
      JSON.stringify(result)
    );
  } catch {
    /* storage unavailable — the attempt just won't persist */
  }
}

// ---------------------------------------------------------------------------
// Shareable result — marks and counts only. Never a card, position or rule.
// ---------------------------------------------------------------------------

export const DAILY_SHARE_URL = "whoop-whoop.lovable.app/today";

/**
 * The share text:
 *   WHOOP! WHOOP! #14
 *   R1 🔵 · R2 👀🔴🔵 · R3 🔴🔵
 *   3 of 3 · 3 misses
 *
 *   whoop-whoop.lovable.app/today
 */
/** Streaks only make the share block at 3+ days — below that it's clutter. */
const SHARE_STREAK_MIN = 3;

export function formatDailyShare(result: DailyResult, streak?: number | null): string {
  const rounds = (result.roundEvents ?? []).map((events, i) => {
    const peek = result.peekUsed && result.peekRound === i + 1 ? "👀" : "";
    const marks = events.map((m) => (m === "SOLVE" ? "🔵" : "🔴")).join("");
    return `R${i + 1} ${peek}${marks}`;
  });

  const solved = result.roundsSolved ?? 0;
  const misses = result.totalMisses ?? 0;
  const streakTag =
    typeof streak === "number" && streak >= SHARE_STREAK_MIN
      ? ` · ${streak} day streak`
      : "";
  const line3 =
    (solved === 0
      ? "Whooped! Better luck tomorrow."
      : `${solved} of ${DAILY_ROUNDS} · ${misses === 0 ? "Clean" : `${misses} misses`}`) +
    streakTag;

  return [
    `WHOOP! WHOOP! #${result.puzzleNumber}`,
    rounds.join(" · "),
    line3,
    "",
    DAILY_SHARE_URL,
  ].join("\n");
}
