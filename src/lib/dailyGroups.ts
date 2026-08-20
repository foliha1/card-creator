import { supabase } from "@/integrations/supabase/client";
import { DAILY_LAUNCH_UTC } from "@/lib/daily";

/**
 * Group leaderboards, data layer.
 *
 * Everything is keyed to puzzle number, never to a date: the daily seed rolls at
 * each player's local midnight, so a member in another timezone can be a puzzle
 * ahead. The ranking and points rules below mirror the SQL in the
 * `get_group_today` / `get_group_season` RPCs exactly, so the UI can reason about
 * them without a round trip.
 */

export const GROUP_MAX_MEMBERS = 20;
export const GROUP_MAX_PER_PERSON = 5;
export const GROUP_NAME_MAX = 24;
export const GROUP_CODE_LENGTH = 6;
/** No look-alike characters: no i, l, o, 0, 1. */
export const GROUP_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const MS_PER_DAY = 86_400_000;

export type GroupTodayRow = {
  visitor_id: string;
  display_name: string;
  rounds_solved: number;
  total_misses: number;
  peek_used: boolean;
  rank_position: number | null;
  not_played: boolean;
  is_me: boolean;
};

export type GroupSeasonRow = {
  visitor_id: string;
  display_name: string;
  points: number;
  puzzles_played: number;
  rank_position: number;
  is_me: boolean;
  season_start: string;
};

export type MyGroup = {
  group_id: string;
  name: string;
  code: string;
  member_count: number;
  my_position: number | null;
  my_points: number;
  puzzle_number: number | null;
};

/** A puzzle number is a pure function of its local date. */
export function puzzleDate(puzzleNumber: number): Date {
  return new Date(DAILY_LAUNCH_UTC + (Math.max(1, puzzleNumber) - 1) * MS_PER_DAY);
}

/**
 * Weekly season key, Monday-anchored, derived and never stored — same as
 * `date_trunc('week', puzzle_date)` in Postgres.
 */
export function seasonStart(puzzleNumber: number): string {
  const d = puzzleDate(puzzleNumber);
  const dow = d.getUTCDay(); // 0 = Sunday
  const back = (dow + 6) % 7; // Monday = 0
  const start = new Date(d.getTime() - back * MS_PER_DAY);
  return start.toISOString().slice(0, 10);
}

export function sameSeason(a: number, b: number): boolean {
  return seasonStart(a) === seasonStart(b);
}

export type Score = { rounds_solved: number; total_misses: number };

/**
 * Ranking: rounds solved desc, then misses asc. Ties share a position, and the
 * next distinct score takes the position it would have had counting all tied
 * players. Never ranks on elapsed_ms — that number is hidden from players.
 */
export function rankScores<T extends Score>(scores: T[]): (T & { position: number })[] {
  const better = (a: Score, b: Score) =>
    a.rounds_solved > b.rounds_solved ||
    (a.rounds_solved === b.rounds_solved && a.total_misses < b.total_misses);
  return scores.map((s) => ({
    ...s,
    position: 1 + scores.filter((o) => better(o, s)).length,
  }));
}

/** 3 for 1st, 2 for 2nd, 1 for 3rd, nothing below. Not playing scores nothing. */
export function pointsForPosition(position: number): number {
  if (position === 1) return 3;
  if (position === 2) return 2;
  if (position === 3) return 1;
  return 0;
}

/** Season points for one member across a set of per-puzzle score tables. */
export function seasonPoints(
  visitorId: string,
  puzzles: { scores: (Score & { visitor_id: string })[] }[],
): { points: number; played: number } {
  let points = 0;
  let played = 0;
  for (const p of puzzles) {
    const ranked = rankScores(p.scores);
    const mine = ranked.find((r) => r.visitor_id === visitorId);
    if (!mine) continue;
    played += 1;
    points += pointsForPosition(mine.position);
  }
  return { points, played };
}

// ---------------------------------------------------------------- RPC calls ---

export async function createGroup(name: string, visitorId: string, displayName: string) {
  const { data, error } = await supabase.rpc("create_daily_group", {
    p_name: name,
    p_visitor_id: visitorId,
    p_display_name: displayName,
  });
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

export async function joinGroup(
  code: string,
  visitorId: string,
  displayName: string,
  email?: string | null,
) {
  const { data, error } = await supabase.rpc("join_daily_group", {
    p_code: code,
    p_visitor_id: visitorId,
    p_display_name: displayName,
    p_email: email ?? undefined,
  });
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

export async function leaveGroup(groupId: string, visitorId: string) {
  const { data, error } = await supabase.rpc("leave_daily_group", {
    p_group_id: groupId,
    p_visitor_id: visitorId,
  });
  if (error) throw error;
  return data === true;
}

export async function fetchMyGroups(
  visitorId: string,
  email?: string | null,
  puzzleNumber?: number | null,
): Promise<MyGroup[]> {
  const { data, error } = await supabase.rpc("get_my_groups", {
    p_visitor_id: visitorId,
    p_email: email ?? undefined,
    p_puzzle_number: puzzleNumber ?? undefined,
  });
  if (error) throw error;
  return (data ?? []) as MyGroup[];
}

export async function fetchGroupToday(
  groupId: string,
  puzzleNumber: number,
  visitorId: string,
): Promise<GroupTodayRow[]> {
  const { data, error } = await supabase.rpc("get_group_today", {
    p_group_id: groupId,
    p_puzzle_number: puzzleNumber,
    p_visitor_id: visitorId,
  });
  if (error) throw error;
  return (data ?? []) as GroupTodayRow[];
}

export async function fetchGroupSeason(
  groupId: string,
  puzzleNumber: number,
  visitorId: string,
): Promise<GroupSeasonRow[]> {
  const { data, error } = await supabase.rpc("get_group_season", {
    p_group_id: groupId,
    p_puzzle_number: puzzleNumber,
    p_visitor_id: visitorId,
  });
  if (error) throw error;
  return (data ?? []) as GroupSeasonRow[];
}
