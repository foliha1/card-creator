// ============================================================================
// dailyRecall — the recall trend line's one calculation.
//
// First-time match rate = the share of ROUNDS a player solved without missing
// first. `round_events` stores each round as a list of marks, so a round whose
// list starts with "SOLVE" was found first time; ["MISS","SOLVE"] was not, and
// neither was ["MISS","MISS"].
//
// The trend compares the player's last three games with their first three.
// Rounds are the unit, not games: games can carry different round counts and a
// game-average would weight a short game like a long one.
// ============================================================================

import type { DailyMark } from "@/lib/dailyEngine";

/** The minimum history before the line means anything. */
export const RECALL_MIN_GAMES = 6;
/** Games per comparison window. */
export const RECALL_WINDOW = 3;

/** Just enough of a stored result for this calculation. */
export interface RecallGame {
  puzzle_number: number;
  round_events: DailyMark[][] | null;
}

export interface RecallTrend {
  /** Late-window first-time rate, whole percent. */
  latePct: number;
  /** Early-window first-time rate, whole percent. */
  earlyPct: number;
  /**
   * Percentage-POINT rise, whole numbers, only when the late window is at least
   * a point ahead. Null for flat or declining — a player who got worse is never
   * told so.
   */
  upPoints: number | null;
}

/** Rounds whose mark list starts with SOLVE, over all rounds in the window. */
function firstTimeRate(games: RecallGame[]): number | null {
  let rounds = 0;
  let firstTime = 0;
  for (const g of games) {
    const events = Array.isArray(g.round_events) ? g.round_events : [];
    for (const marks of events) {
      if (!Array.isArray(marks) || marks.length === 0) continue;
      rounds += 1;
      if (marks[0] === "SOLVE") firstTime += 1;
    }
  }
  if (rounds === 0) return null;
  return (firstTime / rounds) * 100;
}

/**
 * The trend, or null when there is nothing honest to show: fewer than six
 * games, or no scoreable rounds in either window.
 */
export function computeRecallTrend(rows: RecallGame[]): RecallTrend | null {
  if (!Array.isArray(rows)) return null;
  const games = [...rows].sort((a, b) => a.puzzle_number - b.puzzle_number);
  if (games.length < RECALL_MIN_GAMES) return null;

  const early = firstTimeRate(games.slice(0, RECALL_WINDOW));
  const late = firstTimeRate(games.slice(-RECALL_WINDOW));
  if (early === null || late === null) return null;

  const latePct = Math.round(late);
  const earlyPct = Math.round(early);
  const rise = Math.round(late - early);
  return { latePct, earlyPct, upPoints: rise >= 1 ? rise : null };
}

/**
 * "Your recall is climbing! 64% correct first match." when the late window is
 * ahead, otherwise the bare "64% correct first match."
 *
 * The improvement figure is deliberately not spoken: the first-3-vs-last-3
 * comparison still decides whether the sentence says "climbing" (and whether
 * the caller draws the arrow), it just isn't quoted in points.
 */
export function formatRecallLine(trend: RecallTrend): string {
  const stat = `${trend.latePct}% correct first match.`;
  return trend.upPoints === null ? stat : `Your recall is climbing! ${stat}`;
}

export const RECALL_TOOLTIP =
  "A correct first match is when you find a matching pair without missing first " +
  "in a round. This percentage is calculated by comparing your most recent 3 " +
  "games to your first 3.";
