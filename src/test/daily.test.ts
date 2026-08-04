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
  pairsFor,
  rollsAreSolvable,
  remainingCount,
  currentRoll,
  STUDY_MS,
  MAX_MISSES,
  DAILY_ROUNDS,
  type DailyState,
} from "@/lib/dailyEngine";
import { createRng } from "@/lib/rng";
import { createDeck } from "@/cardData";
import { pickRoll } from "@/lib/rolls";

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

describe("daily board and dice are reproducible from the seed", () => {
  it("same seed, same nine cards and same three dice", () => {
    const a = initDailyState(SEED);
    const b = initDailyState(SEED);
    expect(a.grid.map((c) => c!.id)).toEqual(b.grid.map((c) => c!.id));
    expect(a.rolls).toEqual(b.rolls);
    expect(a.grid).toHaveLength(9);
    expect(a.rolls).toHaveLength(DAILY_ROUNDS);
  });

  it("draws all three rolls from the seeded source, in order, after the deal", () => {
    const s = initDailyState(SEED);
    // Reproduce the seeded stream: deck first, then rolls in triples until a
    // solvable set is found — exactly what init does.
    const rng = createRng(SEED);
    const grid = createDeck(rng).slice(0, 9);
    expect(s.grid.map((c) => c!.id)).toEqual(grid.map((c) => c.id));
    let rolls = [] as ReturnType<typeof pickRoll>[];
    for (let attempt = 0; attempt < 500; attempt++) {
      const candidate = [0, 1, 2].map(() => pickRoll(["SHAPE", "NUMBER", "COLOR"] as const, rng));
      if (rollsAreSolvable(grid, candidate)) {
        rolls = candidate;
        break;
      }
    }
    expect(s.rolls).toEqual(rolls);
  });

  it("differs across days", () => {
    const a = initDailyState("whoop-2026-08-04");
    const b = initDailyState("whoop-2026-08-05");
    expect(a.grid.map((c) => c!.id)).not.toEqual(b.grid.map((c) => c!.id));
  });
});

describe("no-valid-pair guard", () => {
  it("every day's three rolls stay solvable on every reachable board", () => {
    for (let d = 1; d <= 40; d++) {
      const s = initDailyState(`whoop-2026-09-${String(d).padStart(2, "0")}`);
      expect(rollsAreSolvable(s.grid, s.rolls)).toBe(true);
    }
  });

  it("rejects a roll set whose later round has no pair", () => {
    const board = [
      { id: "a", shape: "circle", number: 1, color: "red", svgPath: "" },
      { id: "b", shape: "circle", number: 2, color: "blue", svgPath: "" },
    ] as never as (null | Parameters<typeof pairsFor>[0][number])[];
    expect(pairsFor(board, "SHAPE")).toHaveLength(1);
    expect(
      rollsAreSolvable(board, [
        { attribute: "SHAPE", faceIndex: 0 },
        { attribute: "COLOR", faceIndex: 0 },
      ])
    ).toBe(false);
  });
});

/** Advance the machine to PLAY of round 1, with the clock started at `at`. */
function toPlay(at = 1000): DailyState {
  let s = initDailyState(SEED);
  s = dailyReducer(s, { type: "START" });
  s = dailyReducer(s, { type: "REVEAL" });
  s = dailyReducer(s, { type: "HIDE" });
  s = dailyReducer(s, { type: "ROLL_START" });
  return dailyReducer(s, { type: "PLAY_START", at });
}

function pairFor(s: DailyState, correct: boolean): [number, number] {
  const attr = currentRoll(s).attribute;
  if (correct) return pairsFor(s.grid, attr)[0];
  for (let i = 0; i < s.grid.length; i++) {
    for (let j = i + 1; j < s.grid.length; j++) {
      const a = s.grid[i];
      const b = s.grid[j];
      if (!a || !b) continue;
      const same =
        attr === "SHAPE"
          ? a.shape === b.shape
          : attr === "NUMBER"
            ? a.number === b.number
            : a.color === b.color;
      if (!same) return [i, j];
    }
  }
  throw new Error("no mismatched pair on board");
}

/** Solve the current round correctly at time `at`. */
function solveRound(s: DailyState, at: number): DailyState {
  const [i, j] = pairFor(s, true);
  let n = dailyReducer(s, { type: "CLAIM" });
  n = dailyReducer(n, { type: "SELECT", idx: i });
  n = dailyReducer(n, { type: "SELECT", idx: j });
  return dailyReducer(n, { type: "RESOLVE", at });
}

/** Re-enter PLAY for the next round with the clock restarting at `at`. */
function nextRound(s: DailyState, at: number): DailyState {
  let n = dailyReducer(s, { type: "CLEAR_MATCH" });
  n = dailyReducer(n, { type: "ROLL_START" });
  return dailyReducer(n, { type: "PLAY_START", at });
}

describe("start gate", () => {
  it("stays on READY until START, running nothing", () => {
    const s = initDailyState(SEED);
    expect(s.phase).toBe("READY");
    expect(s.faceUp).toBe(false);
    expect(s.startedAt).toBeNull();
    expect(dailyReducer(s, { type: "REVEAL" })).toBe(s);
    expect(dailyReducer(s, { type: "CLAIM" })).toBe(s);
    const started = dailyReducer(s, { type: "START" });
    expect(started.phase).toBe("DEAL");
    expect(dailyReducer(started, { type: "START" })).toBe(started);
  });
});

describe("daily phase sequence", () => {
  it("runs READY → DEAL → STUDY → HIDE → ROLL → PLAY, flipping up then down once", () => {
    let s = dailyReducer(initDailyState(SEED), { type: "START" });
    expect(s.phase).toBe("DEAL");

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
    expect(STUDY_MS).toBe(10000);
  });

  it("requires a claim before cards can be selected", () => {
    const s = toPlay();
    expect(dailyReducer(s, { type: "SELECT", idx: 0 })).toBe(s);
    const claimed = dailyReducer(s, { type: "CLAIM" });
    expect(dailyReducer(claimed, { type: "SELECT", idx: 0 }).selected).toEqual([0]);
  });
});

describe("three-round progression and shrinking board", () => {
  it("removes each matched pair for good: 9 → 7 → 5 → 3", () => {
    let s = toPlay(0);
    expect(remainingCount(s)).toBe(9);
    expect(s.roundIndex).toBe(1);

    s = solveRound(s, 1000);
    expect(s.phase).toBe("HIDE");
    expect(s.roundIndex).toBe(2);
    expect(remainingCount(s)).toBe(7);
    expect(s.faceUp).toBe(false);

    s = nextRound(s, 2000);
    expect(currentRoll(s).attribute).toBe(s.rolls[1].attribute);
    s = solveRound(s, 3000);
    expect(s.roundIndex).toBe(3);
    expect(remainingCount(s)).toBe(5);

    s = nextRound(s, 4000);
    s = solveRound(s, 5000);
    expect(s.phase).toBe("DONE");
    expect(remainingCount(s)).toBe(3);
    // 1s + 1s + 1s of play; roll gaps are not counted.
    expect(s.elapsedMs).toBe(3000);
    expect(s.missesUsed).toBe(0);
    expect(dailyReducer(s, { type: "CLAIM" })).toBe(s);
  });

  it("pauses the clock between rounds", () => {
    let s = toPlay(0);
    s = solveRound(s, 1000);
    expect(s.startedAt).toBeNull();
    expect(liveElapsedMs(s, 9_999)).toBe(1000);
  });

  it("cannot select an emptied slot", () => {
    let s = toPlay(0);
    const [i] = pairFor(s, true);
    s = solveRound(s, 1000);
    s = nextRound(s, 2000);
    s = dailyReducer(s, { type: "CLAIM" });
    expect(dailyReducer(s, { type: "SELECT", idx: i }).selected).toEqual([]);
  });
});

describe("miss cap", () => {
  const wrongOnce = (s: DailyState, at: number): DailyState => {
    const [i, j] = pairFor(s, false);
    let n = dailyReducer(s, { type: "CLAIM" });
    n = dailyReducer(n, { type: "SELECT", idx: i });
    n = dailyReducer(n, { type: "SELECT", idx: j });
    return dailyReducer(n, { type: "RESOLVE", at });
  };

  it("spends one miss, adds no time penalty, and the round continues", () => {
    let s = toPlay(0);
    expect(MAX_MISSES).toBe(5);
    s = wrongOnce(s, 2000);
    expect(s.phase).toBe("PLAY");
    expect(s.roundIndex).toBe(1);
    expect(remainingCount(s)).toBe(9);
    expect(s.missesUsed).toBe(1);
    expect(s.marks).toEqual(["MISS"]);
    expect(s.failed).toBe(false);
    expect(s.elapsedMs).toBeNull();
    expect(liveElapsedMs(s, 2000)).toBe(2000);
    expect(s.faceUp).toBe(false);
    expect(s.claiming).toBe(false);
    expect(s.wrongPair).toHaveLength(2);
  });

  it("accumulates misses across rounds as one pool", () => {
    let s = toPlay(0);
    s = wrongOnce(s, 500);
    s = dailyReducer(s, { type: "CLEAR_WRONG" });
    s = solveRound(s, 1000);
    s = nextRound(s, 2000);
    s = wrongOnce(s, 2500);
    s = dailyReducer(s, { type: "CLEAR_WRONG" });
    s = wrongOnce(s, 2600);
    s = dailyReducer(s, { type: "CLEAR_WRONG" });
    s = solveRound(s, 3000);
    s = nextRound(s, 4000);
    s = solveRound(s, 5000);
    expect(s.phase).toBe("DONE");
    expect(s.failed).toBe(false);
    expect(s.missesUsed).toBe(3);
    expect(s.marks).toEqual(["MISS", "MATCH", "MISS", "MISS", "MATCH", "MATCH"]);
    expect(s.elapsedMs).toBe(3000);
  });

  it("ends the run immediately on the fifth miss", () => {
    let s = toPlay(0);
    for (let i = 0; i < 4; i++) {
      s = wrongOnce(s, 100 * (i + 1));
      s = dailyReducer(s, { type: "CLEAR_WRONG" });
      expect(s.phase).toBe("PLAY");
    }
    s = wrongOnce(s, 5000);
    expect(s.missesUsed).toBe(5);
    expect(s.phase).toBe("DONE");
    expect(s.failed).toBe(true);
    expect(s.roundIndex).toBe(1);
    expect(s.elapsedMs).toBe(5000);
    expect(dailyReducer(s, { type: "CLAIM" })).toBe(s);
  });

  it("records zero misses on a clean run", () => {
    let s = toPlay(0);
    s = solveRound(s, 1000);
    s = nextRound(s, 2000);
    s = solveRound(s, 3000);
    s = nextRound(s, 4000);
    s = solveRound(s, 5000);
    expect(s.phase).toBe("DONE");
    expect(s.missesUsed).toBe(0);
    expect(s.failed).toBe(false);
    expect(s.marks).toEqual(["MATCH", "MATCH", "MATCH"]);
    expect(formatSeconds(s.elapsedMs!)).toBe("3.0");
  });
});
