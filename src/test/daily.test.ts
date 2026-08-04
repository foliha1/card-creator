import { describe, it, expect } from "vitest";
import {
  getDailyDateKey,
  getDailyNumber,
  getDailySeed,
  dailyStorageKey,
  DAILY_LAUNCH_UTC,
} from "@/lib/daily";
import {
  dailyReducer,
  initDailyState,
  liveElapsedMs,
  formatSeconds,
  STUDY_MS,
  WRONG_PENALTY_MS,
  type DailyState,
} from "@/lib/dailyEngine";

describe("getDailySeed", () => {
  it("formats whoop-YYYY-MM-DD in UTC", () => {
    expect(getDailySeed(new Date("2026-08-04T05:00:00Z"))).toBe("whoop-2026-08-04");
    expect(getDailyDateKey(new Date("2026-01-09T23:59:59Z"))).toBe("2026-01-09");
  });

  it("is the same for any time on the same UTC date", () => {
    expect(getDailySeed(new Date("2026-08-04T00:00:00Z"))).toBe(
      getDailySeed(new Date("2026-08-04T23:59:59Z"))
    );
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

const SEED = "whoop-2026-08-04";

describe("daily board is reproducible from the seed", () => {
  it("same seed, same six cards and same die", () => {
    const a = initDailyState(SEED);
    const b = initDailyState(SEED);
    expect(a.grid.map((c) => c.id)).toEqual(b.grid.map((c) => c.id));
    expect(a.attribute).toBe(b.attribute);
    expect(a.faceIndex).toBe(b.faceIndex);
    expect(a.grid).toHaveLength(6);
  });

  it("always deals a solvable board for the rolled attribute", () => {
    for (let d = 1; d <= 40; d++) {
      const s = initDailyState(`whoop-2026-09-${String(d).padStart(2, "0")}`);
      const pairs = s.grid.flatMap((c, i) =>
        s.grid.slice(i + 1).filter((o) => {
          if (s.attribute === "SHAPE") return o.shape === c.shape;
          if (s.attribute === "NUMBER") return o.number === c.number;
          return o.color === c.color;
        })
      );
      expect(pairs.length).toBeGreaterThan(0);
    }
  });
});

/** Advance the machine to PLAY, with the clock started at `at`. */
function toPlay(at = 1000): DailyState {
  let s = initDailyState(SEED);
  s = dailyReducer(s, { type: "REVEAL" });
  s = dailyReducer(s, { type: "HIDE" });
  s = dailyReducer(s, { type: "ROLL_START" });
  return dailyReducer(s, { type: "PLAY_START", at });
}

function pairFor(s: DailyState, correct: boolean): [number, number] {
  const same = (a: number, b: number) => {
    const x = s.grid[a];
    const y = s.grid[b];
    if (s.attribute === "SHAPE") return x.shape === y.shape;
    if (s.attribute === "NUMBER") return x.number === y.number;
    return x.color === y.color;
  };
  for (let i = 0; i < s.grid.length; i++) {
    for (let j = i + 1; j < s.grid.length; j++) {
      if (same(i, j) === correct) return [i, j];
    }
  }
  throw new Error(`no ${correct ? "matching" : "mismatched"} pair on board`);
}

describe("daily phase sequence", () => {
  it("runs DEAL → STUDY → HIDE → ROLL → PLAY, flipping the board up then down", () => {
    let s = initDailyState(SEED);
    expect(s.phase).toBe("DEAL");
    expect(s.faceUp).toBe(false);

    s = dailyReducer(s, { type: "REVEAL" });
    expect(s.phase).toBe("STUDY");
    expect(s.faceUp).toBe(true);

    s = dailyReducer(s, { type: "HIDE" });
    expect(s.phase).toBe("HIDE");
    expect(s.faceUp).toBe(false);

    s = dailyReducer(s, { type: "ROLL_START" });
    expect(s.phase).toBe("ROLL");

    s = dailyReducer(s, { type: "PLAY_START", at: 500 });
    expect(s.phase).toBe("PLAY");
    expect(s.startedAt).toBe(500);
    expect(STUDY_MS).toBe(5000);
  });

  it("ignores out-of-order transitions", () => {
    const s = initDailyState(SEED);
    expect(dailyReducer(s, { type: "HIDE" })).toBe(s);
    expect(dailyReducer(s, { type: "ROLL_START" })).toBe(s);
    expect(dailyReducer(s, { type: "PLAY_START", at: 1 })).toBe(s);
    const study = dailyReducer(s, { type: "REVEAL" });
    expect(dailyReducer(study, { type: "REVEAL" })).toBe(study);
  });

  it("rejects claims and selections before PLAY", () => {
    const s = dailyReducer(initDailyState(SEED), { type: "REVEAL" });
    expect(dailyReducer(s, { type: "CLAIM" })).toBe(s);
    expect(dailyReducer(s, { type: "SELECT", idx: 0 })).toBe(s);
  });

  it("requires a claim before cards can be selected", () => {
    const s = toPlay();
    expect(dailyReducer(s, { type: "SELECT", idx: 0 })).toBe(s);
    const claimed = dailyReducer(s, { type: "CLAIM" });
    expect(claimed.claiming).toBe(true);
    expect(dailyReducer(claimed, { type: "SELECT", idx: 0 }).selected).toEqual([0]);
  });

  it("a correct pair stops the clock and ends the puzzle", () => {
    let s = toPlay(1000);
    const [i, j] = pairFor(s, true);
    s = dailyReducer(s, { type: "CLAIM" });
    s = dailyReducer(s, { type: "SELECT", idx: i });
    s = dailyReducer(s, { type: "SELECT", idx: j });
    s = dailyReducer(s, { type: "RESOLVE", at: 5500 });
    expect(s.phase).toBe("DONE");
    expect(s.elapsedMs).toBe(4500);
    expect(s.wrongCalls).toBe(0);
    expect(s.matchedPair).toEqual([i, j]);
    // Puzzle is over: no further play.
    expect(dailyReducer(s, { type: "CLAIM" })).toBe(s);
  });
});

describe("wrong-pair penalty", () => {
  const wrongOnce = (s: DailyState, at: number): DailyState => {
    const [i, j] = pairFor(s, false);
    let n = dailyReducer(s, { type: "CLAIM" });
    n = dailyReducer(n, { type: "SELECT", idx: i });
    n = dailyReducer(n, { type: "SELECT", idx: j });
    return dailyReducer(n, { type: "RESOLVE", at });
  };

  it("adds exactly 1 second, counts the wrong call, and play continues", () => {
    let s = toPlay(0);
    s = wrongOnce(s, 2000);
    expect(WRONG_PENALTY_MS).toBe(1000);
    expect(s.phase).toBe("PLAY");
    expect(s.wrongCalls).toBe(1);
    expect(s.penaltyMs).toBe(1000);
    expect(s.elapsedMs).toBeNull();
    expect(s.faceUp).toBe(false); // cards stay down
    expect(s.claiming).toBe(false);
    expect(s.selected).toEqual([]);
    expect(s.wrongPair).toHaveLength(2);
  });

  it("stacks penalties into the final time", () => {
    let s = toPlay(0);
    s = wrongOnce(s, 1000);
    s = dailyReducer(s, { type: "CLEAR_WRONG" });
    s = wrongOnce(s, 2000);
    s = dailyReducer(s, { type: "CLEAR_WRONG" });
    expect(s.wrongCalls).toBe(2);

    const [i, j] = pairFor(s, true);
    s = dailyReducer(s, { type: "CLAIM" });
    s = dailyReducer(s, { type: "SELECT", idx: i });
    s = dailyReducer(s, { type: "SELECT", idx: j });
    s = dailyReducer(s, { type: "RESOLVE", at: 10_000 });
    expect(s.elapsedMs).toBe(12_000); // 10s raw + 2s of penalties
  });

  it("shows the penalty on the live clock immediately", () => {
    let s = toPlay(0);
    expect(liveElapsedMs(s, 3000)).toBe(3000);
    s = wrongOnce(s, 3000);
    expect(liveElapsedMs(s, 3000)).toBe(4000);
    expect(formatSeconds(4000)).toBe("4.0");
    expect(formatSeconds(4567)).toBe("4.5");
  });
});
