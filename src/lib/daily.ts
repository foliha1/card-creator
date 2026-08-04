// ============================================================================
// Daily puzzle helpers — seed + puzzle number, both derived from the UTC date
// so every player worldwide gets the same puzzle on the same calendar day.
// ============================================================================

import { DAILY_ROUNDS, type DailyMark } from "@/lib/dailyEngine";

/** Fixed launch day (UTC). Puzzle #1. */
export const DAILY_LAUNCH_UTC = Date.UTC(2026, 7, 1); // 2026-08-01

const MS_PER_DAY = 86_400_000;

/** Midnight-UTC timestamp for the day the given date falls on. */
function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** `YYYY-MM-DD` in UTC. */
export function getDailyDateKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The shared seed for the day, e.g. `whoop-2026-08-04`. */
export function getDailySeed(date: Date = new Date()): string {
  return `whoop-${getDailyDateKey(date)}`;
}

/** Days elapsed since launch, starting at 1. Never below 1. */
export function getDailyNumber(date: Date = new Date()): number {
  const days = Math.floor((utcMidnight(date) - DAILY_LAUNCH_UTC) / MS_PER_DAY);
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
export function formatDailyShare(result: DailyResult): string {
  const rounds = (result.roundEvents ?? []).map((events, i) => {
    const peek = result.peekUsed && result.peekRound === i + 1 ? "👀" : "";
    const marks = events.map((m) => (m === "SOLVE" ? "🔵" : "🔴")).join("");
    return `R${i + 1} ${peek}${marks}`;
  });

  const solved = result.roundsSolved ?? 0;
  const misses = result.totalMisses ?? 0;
  const line3 =
    solved === 0
      ? "Whooped! Better luck tomorrow."
      : `${solved} of ${DAILY_ROUNDS} · ${misses === 0 ? "Clean" : `${misses} misses`}`;

  return [
    `WHOOP! WHOOP! #${result.puzzleNumber}`,
    rounds.join(" · "),
    line3,
    "",
    DAILY_SHARE_URL,
  ].join("\n");
}
