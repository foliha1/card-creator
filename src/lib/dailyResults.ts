// ============================================================================
// Daily results persistence — one row per visitor per puzzle, written through
// security-definer RPCs. Never blocks the UI: every failure is swallowed.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor";
import type { DailyResult } from "@/lib/daily";
import type { DailyMark } from "@/lib/dailyEngine";

export interface StoredDailyResult {
  puzzle_number: number;
  puzzle_date: string;
  rounds_solved: number;
  total_misses: number;
  peek_used: boolean;
  round_events: DailyMark[][];
  elapsed_ms: number;
  created_at: string;
}

/** `whoop-2026-08-05` → `2026-08-05`. Falls back to today (UTC). */
function puzzleDateFromSeed(seed: string): string {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(seed ?? "");
  if (m) return m[1];
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fire-and-forget write of a finished run. Resolves `true` when a new row was
 * stored, `false` when it was a duplicate or the write failed.
 */
export async function saveDailyResultRemote(
  result: DailyResult,
  visitorId: string = getVisitorId()
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("save_daily_result", {
      p_visitor_id: visitorId,
      p_puzzle_number: result.puzzleNumber,
      p_puzzle_date: puzzleDateFromSeed(result.seed),
      p_rounds_solved: result.roundsSolved,
      p_total_misses: result.totalMisses,
      p_peek_used: result.peekUsed,
      p_round_events: result.roundEvents ?? [],
      p_elapsed_ms: Math.round(result.elapsedMs ?? 0),
      p_email: null,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/** A visitor's stored results, ordered by puzzle number. Basis for streaks. */
export async function fetchDailyResults(
  visitorId: string = getVisitorId()
): Promise<StoredDailyResult[]> {
  try {
    const { data, error } = await supabase.rpc("get_daily_results", {
      p_visitor_id: visitorId,
    });
    if (error || !Array.isArray(data)) return [];
    return data as unknown as StoredDailyResult[];
  } catch {
    return [];
  }
}
