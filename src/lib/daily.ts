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
  /** Total time across all three rounds, including penalties, in ms. */
  elapsedMs: number;
  wrongCalls: number;
  completedAt: string;
}


export function dailyStorageKey(seed: string): string {
  return `ww_daily_${seed}`;
}

export function loadDailyResult(seed: string): DailyResult | null {
  try {
    const raw = window.localStorage.getItem(dailyStorageKey(seed));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyResult & { attribute?: DailyResult["attributes"][number] };
    if (typeof parsed?.elapsedMs !== "number") return null;
    // Legacy single-round records stored one `attribute` instead of three.
    const attributes = Array.isArray(parsed.attributes)
      ? parsed.attributes
      : parsed.attribute
        ? [parsed.attribute]
        : [];
    return { ...parsed, attributes };
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
