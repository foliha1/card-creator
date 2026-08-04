import { describe, it, expect } from "vitest";
import {
  getDailyDateKey,
  getDailyNumber,
  getDailySeed,
  dailyStorageKey,
  DAILY_LAUNCH_UTC,
} from "@/lib/daily";
import { initialState, reducer, type State } from "@/hooks/useGameState";

describe("getDailySeed", () => {
  it("formats whoop-YYYY-MM-DD in UTC", () => {
    expect(getDailySeed(new Date("2026-08-04T05:00:00Z"))).toBe("whoop-2026-08-04");
    expect(getDailyDateKey(new Date("2026-01-09T23:59:59Z"))).toBe("2026-01-09");
  });

  it("is the same for any time on the same UTC date", () => {
    const a = getDailySeed(new Date("2026-08-04T00:00:00Z"));
    const b = getDailySeed(new Date("2026-08-04T23:59:59Z"));
    expect(a).toBe(b);
  });

  it("differs for different dates", () => {
    expect(getDailySeed(new Date("2026-08-04T12:00:00Z"))).not.toBe(
      getDailySeed(new Date("2026-08-05T12:00:00Z"))
    );
  });

  it("keys storage per seed", () => {
    expect(dailyStorageKey("whoop-2026-08-04")).toBe("ww_daily_whoop-2026-08-04");
  });
});

describe("getDailyNumber", () => {
  it("starts at 1 on launch day", () => {
    expect(getDailyNumber(new Date(DAILY_LAUNCH_UTC))).toBe(1);
  });

  it("counts days elapsed since launch", () => {
    expect(getDailyNumber(new Date("2026-08-04T00:00:00Z"))).toBe(4);
    expect(getDailyNumber(new Date("2026-08-31T18:00:00Z"))).toBe(31);
  });

  it("never drops below 1 before launch", () => {
    expect(getDailyNumber(new Date("2020-01-01T00:00:00Z"))).toBe(1);
  });
});

describe("daily seed drives a reproducible puzzle", () => {
  it("same seed, same grid and opening die", () => {
    const seed = getDailySeed(new Date("2026-08-04T09:00:00Z"));
    const a = initialState(6, { seatCount: 1, seed });
    const b = initialState(6, { seatCount: 1, seed });
    expect(a.grid.map((c) => c?.id ?? null)).toEqual(b.grid.map((c) => c?.id ?? null));
    expect(a.dieValues).toEqual(b.dieValues);
  });
});

describe("flipCount and wrongCalls", () => {
  const start = (): State => {
    const s = initialState(6, { seatCount: 1, names: ["You"], seed: "whoop-2026-08-04" });
    return { ...s, phase: "FLIPPING", roller: 0, flipper: 0, rolling: false };
  };

  it("starts at zero", () => {
    const s = start();
    expect(s.flipCount).toBe(0);
    expect(s.wrongCalls).toBe(0);
  });

  it("increments once per flip", () => {
    let s = start();
    s = reducer(s, { type: "FLIP_START", by: 0, idx: 0, token: 1 });
    expect(s.flipCount).toBe(1);
    s = reducer(s, { type: "FLIP_COMPLETE", token: 1 });
    expect(s.flipCount).toBe(1);
    s = { ...s, phase: "FLIPPING", flipper: 0, inFlight: null };
    s = reducer(s, { type: "FLIP_START", by: 0, idx: 1, token: 2 });
    expect(s.flipCount).toBe(2);
  });

  it("does not increment on a rejected flip", () => {
    let s = start();
    s = reducer(s, { type: "FLIP_START", by: 0, idx: 0, token: 1 });
    // second flip while one is in flight is rejected
    s = reducer(s, { type: "FLIP_START", by: 0, idx: 2, token: 2 });
    expect(s.flipCount).toBe(1);
  });

  it("resets both on INIT", () => {
    let s = start();
    s = reducer(s, { type: "FLIP_START", by: 0, idx: 0, token: 1 });
    s = reducer(s, { type: "INIT", slotCount: 6, seatCount: 1 });
    expect(s.flipCount).toBe(0);
    expect(s.wrongCalls).toBe(0);
  });

  it("counts a wrong claim", () => {
    const base = start();
    // Force a grid with two cards that cannot match on SHAPE.
    const grid = base.grid;
    const a = grid[0]!;
    const bIdx = grid.findIndex((c, i) => i > 0 && c && c.shape !== a.shape);
    let s: State = {
      ...base,
      phase: "CLAIM_SELECTING",
      rule: ["SHAPE"],
      claimBy: 0,
      selectedCards: [0, bIdx],
    };
    s = reducer(s, { type: "PLAYER_RESOLVE_MATCH", by: 0 });
    expect(s.settleKind).toBe("WRONG");
    expect(s.wrongCalls).toBe(1);
  });
});
