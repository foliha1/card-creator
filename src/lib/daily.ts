// ============================================================================
// Daily puzzle helpers — seed + puzzle number, both derived from the UTC date
// so every player worldwide gets the same puzzle on the same calendar day.
// ============================================================================

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
  /** Misses spent, out of MAX_MISSES. */
  missesUsed: number;
  /** Matches and misses in the order they happened. */
  marks: ("MATCH" | "MISS")[];
  /** True when the run ended because the miss pool ran out. */
  failed: boolean;
  completedAt: string;
}


export function dailyStorageKey(seed: string): string {
  return `ww_daily_${seed}`;
}

export function loadDailyResult(seed: string): DailyResult | null {
  try {
    const raw = window.localStorage.getItem(dailyStorageKey(seed));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyResult & {
      attribute?: DailyResult["attributes"][number];
      wrongCalls?: number;
    };
    if (typeof parsed?.elapsedMs !== "number") return null;
    // Legacy single-round records stored one `attribute` instead of three.
    const attributes = Array.isArray(parsed.attributes)
      ? parsed.attributes
      : parsed.attribute
        ? [parsed.attribute]
        : [];
    const missesUsed =
      typeof parsed.missesUsed === "number" ? parsed.missesUsed : (parsed.wrongCalls ?? 0);
    const marks = Array.isArray(parsed.marks) ? parsed.marks : [];
    return { ...parsed, attributes, missesUsed, marks, failed: parsed.failed === true };
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
// Shareable result — squares and counts only. Never a card, position or rule.
// ---------------------------------------------------------------------------

export const DAILY_SHARE_URL = "whoop-whoop.lovable.app/today";
const DAILY_MAX_MISSES = 5;

/** The share text: title, marks row, misses left (or Failed), URL. */
export function formatDailyShare(result: DailyResult): string {
  const squares = (result.marks ?? [])
    .map((m) => (m === "MATCH" ? "🟦" : "🟥"))
    .join("");
  const left = Math.max(0, DAILY_MAX_MISSES - (result.missesUsed ?? 0));
  const line3 = result.failed ? "Failed" : `${left}/${DAILY_MAX_MISSES} misses left`;
  return [
    `WHOOP! WHOOP! #${result.puzzleNumber}`,
    squares,
    line3,
    DAILY_SHARE_URL,
  ].join("\n");
}

