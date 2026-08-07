// Regression coverage for the two ways the daily can end, on every path.
// Each ending must reach DONE with a frozen elapsed time — the run screen can
// never be left with nowhere to go.

import { describe, expect, it } from "vitest";
import {
  dailyReducer,
  initDailyState,
  matchesOn,
  pairsFor,
  DAILY_ROUNDS,
  MISSES_PER_ROUND,
  DAILY_ROLL_ATTRS,
  type DailyAction,
  type DailyState,
} from "@/lib/dailyEngine";

const R = (s: DailyState, a: DailyAction) => dailyReducer(s, a);

function toPlay(s: DailyState): DailyState {
  s = R(s, { type: "START" });
  s = R(s, { type: "REVEAL" });
  s = R(s, { type: "HIDE" });
  s = R(s, { type: "ROLL_START" });
  return R(s, { type: "PLAY_START", at: 0 });
}

/** HIDE → PLAY for rounds 2 and 3. */
function nextRound(s: DailyState): DailyState {
  s = R(s, { type: "ROLL_START" });
  return R(s, { type: "PLAY_START", at: 0 });
}

function claim(s: DailyState, i: number, j: number, at = 100): DailyState {
  s = R(s, { type: "SELECT", idx: i });
  s = R(s, { type: "SELECT", idx: j });
  return R(s, { type: "RESOLVE", at });
}

function goodPair(s: DailyState): [number, number] {
  const attr = s.rolls[s.roundIndex - 1].attribute;
  const options = pairsFor(s.grid, attr);
  expect(options.length).toBeGreaterThan(0);
  return options[0];
}

function badPair(s: DailyState): [number, number] {
  const attr = s.rolls[s.roundIndex - 1].attribute;
  for (let i = 0; i < s.grid.length; i++) {
    for (let j = i + 1; j < s.grid.length; j++) {
      const a = s.grid[i];
      const b = s.grid[j];
      if (a && b && !matchesOn(a, b, attr)) return [i, j];
    }
  }
  throw new Error("no mismatched pair available");
}

function whoopRound(s: DailyState): DailyState {
  for (let k = 0; k < MISSES_PER_ROUND; k++) {
    const [i, j] = badPair(s);
    s = claim(s, i, j);
  }
  expect(s.phase).toBe("WHOOPED");
  return R(s, { type: "ROUND_END", at: 200 });
}

const SEED = "whoop-2026-08-07";

describe("daily endings", () => {
  it("round 3 solved reaches DONE", () => {
    let s = toPlay(initDailyState(SEED));
    for (let r = 1; r <= DAILY_ROUNDS; r++) {
      const [i, j] = goodPair(s);
      s = claim(s, i, j, r * 100);
      if (r < DAILY_ROUNDS) {
        expect(s.phase).toBe("HIDE");
        s = nextRound(s);
      }
    }
    expect(s.phase).toBe("DONE");
    expect(s.roundsSolved).toBe(3);
    expect(s.failed).toBe(false);
    expect(s.elapsedMs).not.toBeNull();
  });

  it("rounds 1 and 2 solved, round 3 hits the miss cap, reaches DONE", () => {
    let s = toPlay(initDailyState(SEED));
    for (let r = 1; r <= 2; r++) {
      const [i, j] = goodPair(s);
      s = claim(s, i, j, r * 100);
      s = nextRound(s);
    }
    const before = s.grid.filter((c) => c !== null).length;
    s = whoopRound(s);
    expect(s.phase).toBe("DONE");
    expect(s.roundsSolved).toBe(2);
    expect(s.failed).toBe(false);
    expect(s.elapsedMs).not.toBeNull();
    // A failed round keeps its cards on the board.
    expect(s.grid.filter((c) => c !== null).length).toBe(before);
  });

  it("all three rounds fail and the run still reaches DONE", () => {
    let s = toPlay(initDailyState(SEED));
    for (let r = 1; r <= DAILY_ROUNDS; r++) {
      s = whoopRound(s);
      if (r < DAILY_ROUNDS) {
        expect(s.phase).toBe("HIDE");
        expect(s.roundIndex).toBe(r + 1);
        s = nextRound(s);
      }
    }
    expect(s.phase).toBe("DONE");
    expect(s.roundsSolved).toBe(0);
    expect(s.failed).toBe(true);
    expect(s.elapsedMs).not.toBeNull();
    expect(s.grid.filter((c) => c !== null).length).toBe(9);
  });
});

describe("daily rolls", () => {
  const seeds = Array.from({ length: 200 }, (_, i) => {
    const d = new Date(2026, 0, 1 + i);
    const p = (n: number) => String(n).padStart(2, "0");
    return `whoop-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });

  it("is reproducible for a given seed", () => {
    for (const seed of seeds.slice(0, 20)) {
      const a = initDailyState(seed).rolls;
      const b = initDailyState(seed).rolls;
      expect(a).toEqual(b);
    }
  });

  it("never repeats the previous round's rule", () => {
    for (const seed of seeds) {
      const rolls = initDailyState(seed).rolls;
      for (let i = 1; i < rolls.length; i++) {
        expect(rolls[i].attribute).not.toBe(rolls[i - 1].attribute);
      }
    }
  });

  it("spreads the three rules roughly evenly across 200 days", () => {
    const counts: Record<string, number> = { SHAPE: 0, NUMBER: 0, COLOR: 0 };
    for (const seed of seeds) {
      for (const roll of initDailyState(seed).rolls) counts[roll.attribute]++;
    }
    const total = seeds.length * DAILY_ROUNDS;
    for (const attr of DAILY_ROLL_ATTRS) {
      const share = counts[attr] / total;
      expect(share).toBeGreaterThan(0.25);
      expect(share).toBeLessThan(0.42);
    }
  });
});
