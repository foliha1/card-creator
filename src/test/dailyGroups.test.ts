import { describe, expect, it } from "vitest";
import {
  GROUP_CODE_ALPHABET,
  GROUP_CODE_LENGTH,
  GROUP_MAX_MEMBERS,
  GROUP_MAX_PER_PERSON,
  pointsForPosition,
  rankScores,
  sameSeason,
  seasonPoints,
  seasonStart,
} from "@/lib/dailyGroups";

const s = (visitor_id: string, rounds_solved: number, total_misses: number) => ({
  visitor_id,
  rounds_solved,
  total_misses,
});

describe("today ranking", () => {
  it("ranks on rounds then misses", () => {
    const ranked = rankScores([s("a", 2, 0), s("b", 3, 4), s("c", 3, 1)]);
    expect(ranked.find((r) => r.visitor_id === "c")!.position).toBe(1);
    expect(ranked.find((r) => r.visitor_id === "b")!.position).toBe(2);
    expect(ranked.find((r) => r.visitor_id === "a")!.position).toBe(3);
  });

  it("shares a position for identical scores and skips to the next distinct", () => {
    const ranked = rankScores([s("a", 3, 0), s("b", 3, 0), s("c", 3, 0), s("d", 3, 1)]);
    expect(ranked.slice(0, 3).map((r) => r.position)).toEqual([1, 1, 1]);
    expect(ranked[3].position).toBe(4);
  });

  it("never uses elapsed time to break a tie", () => {
    const ranked = rankScores([
      { ...s("a", 3, 1), elapsed_ms: 1_000 },
      { ...s("b", 3, 1), elapsed_ms: 90_000 },
    ]);
    expect(ranked.map((r) => r.position)).toEqual([1, 1]);
  });
});

describe("season points", () => {
  it("awards 3/2/1 and nothing below third", () => {
    expect([1, 2, 3, 4, 20].map(pointsForPosition)).toEqual([3, 2, 1, 0, 0]);
  });

  it("gives every tied player the position's points and nothing to the next distinct", () => {
    const puzzle = { scores: [s("a", 3, 0), s("b", 3, 0), s("c", 3, 0), s("d", 3, 1)] };
    for (const v of ["a", "b", "c"]) {
      expect(seasonPoints(v, [puzzle]).points).toBe(3);
    }
    expect(seasonPoints("d", [puzzle]).points).toBe(0);
  });

  it("scores nothing for puzzles not played", () => {
    const puzzles = [
      { scores: [s("a", 3, 0), s("b", 2, 2)] },
      { scores: [s("a", 3, 0)] },
    ];
    expect(seasonPoints("b", puzzles)).toEqual({ points: 2, played: 1 });
    expect(seasonPoints("a", puzzles)).toEqual({ points: 6, played: 2 });
  });

  it("counts puzzles a mid-season joiner already played", () => {
    const week = [
      { scores: [s("a", 3, 0), s("late", 3, 0)] },
      { scores: [s("a", 3, 0), s("late", 2, 1)] },
    ];
    expect(seasonPoints("late", week)).toEqual({ points: 5, played: 2 });
  });
});

describe("season boundary", () => {
  // Puzzle 1 is 2026-08-11, a Tuesday.
  it("anchors seasons on Monday", () => {
    expect(seasonStart(1)).toBe("2026-08-10");
  });

  it("splits two puzzles either side of a Monday", () => {
    // Puzzle 6 = Sun 2026-08-16, puzzle 7 = Mon 2026-08-17.
    expect(seasonStart(6)).toBe("2026-08-10");
    expect(seasonStart(7)).toBe("2026-08-17");
    expect(sameSeason(6, 7)).toBe(false);
    expect(sameSeason(7, 12)).toBe(true);
  });
});

describe("caps and codes", () => {
  it("keeps the server-side caps in one place", () => {
    expect(GROUP_MAX_MEMBERS).toBe(20);
    expect(GROUP_MAX_PER_PERSON).toBe(5);
  });

  it("uses a 6-character code with no look-alike characters", () => {
    expect(GROUP_CODE_LENGTH).toBe(6);
    expect(GROUP_CODE_ALPHABET).toHaveLength(31);
    for (const ch of "ilo01") {
      expect(GROUP_CODE_ALPHABET).not.toContain(ch);
    }
  });
});
