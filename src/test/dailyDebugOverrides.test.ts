import { describe, it, expect } from "vitest";
import {
  resolveDailyContext,
  getDailySeed,
  getDailyNumber,
  getLocalDateString,
  dailyStorageKey,
} from "@/lib/daily";

// Local noon, so a day shift can never be pulled across a boundary by DST.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("resolveDailyContext — debug overrides", () => {
  const now = at(2026, 8, 10);

  it("is a plain today context without ?debug=1", () => {
    for (const q of ["", "?day=5", "?seed=abc", "?day=-3&seed=abc", "?debug=0&day=5"]) {
      const ctx = resolveDailyContext(q, now);
      expect(ctx.debug).toBe(false);
      expect(ctx.override).toBe("none");
      expect(ctx.dayOffset).toBe(0);
      expect(ctx.rawSeed).toBeNull();
      expect(ctx.seed).toBe(getDailySeed(now));
      expect(ctx.puzzleNumber).toBe(getDailyNumber(now));
      expect(ctx.dateKey).toBe(getLocalDateString(now));
    }
  });

  it("shifts seed, number, date key and storage key by whole days", () => {
    const tomorrow = resolveDailyContext("?debug=1&day=1", now);
    expect(tomorrow.override).toBe("day");
    expect(tomorrow.dayOffset).toBe(1);
    expect(tomorrow.seed).toBe("whoop-2026-08-11");
    expect(tomorrow.seed).not.toBe(getDailySeed(now));
    expect(tomorrow.puzzleNumber).toBe(getDailyNumber(now) + 1);
    expect(tomorrow.dateKey).toBe("2026-08-11");
    expect(dailyStorageKey(tomorrow.seed)).not.toBe(
      dailyStorageKey(getDailySeed(now))
    );

    const yesterday = resolveDailyContext("?debug=1&day=-1", now);
    expect(yesterday.seed).toBe("whoop-2026-08-09");
    expect(yesterday.puzzleNumber).toBe(getDailyNumber(now) - 1);
    expect(yesterday.dateKey).toBe("2026-08-09");
  });

  it("ignores a non-integer or zero day offset", () => {
    for (const q of ["?debug=1&day=0", "?debug=1&day=abc", "?debug=1&day=1.5"]) {
      const ctx = resolveDailyContext(q, now);
      expect(ctx.override).toBe("none");
      expect(ctx.seed).toBe(getDailySeed(now));
    }
  });

  it("replaces the seed outright, leaving number and date alone", () => {
    const ctx = resolveDailyContext("?debug=1&seed=whatever", now);
    expect(ctx.override).toBe("seed");
    expect(ctx.rawSeed).toBe("whatever");
    expect(ctx.seed).toBe("whatever");
    expect(ctx.puzzleNumber).toBe(getDailyNumber(now));
    expect(ctx.dateKey).toBe(getLocalDateString(now));
  });

  it("lets a raw seed win over a day offset", () => {
    const ctx = resolveDailyContext("?debug=1&day=5&seed=zzz", now);
    expect(ctx.override).toBe("seed");
    expect(ctx.seed).toBe("zzz");
    expect(ctx.dayOffset).toBe(0);
    expect(ctx.puzzleNumber).toBe(getDailyNumber(now));
  });

  it("still bypasses the lock with ?debug=1 alone", () => {
    const ctx = resolveDailyContext("?debug=1", now);
    expect(ctx.debug).toBe(true);
    expect(ctx.override).toBe("none");
    expect(ctx.seed).toBe(getDailySeed(now));
  });
});

describe("date helpers are untouched by query strings", () => {
  it("keeps getDailySeed / getDailyNumber / getLocalDateString pure", () => {
    const d = at(2026, 8, 4);
    expect(getLocalDateString(d)).toBe("2026-08-04");
    expect(getDailySeed(d)).toBe("whoop-2026-08-04");
    expect(getDailyNumber(d)).toBe(4);
  });
});
