// The end of a daily run must reach the result screen on every ending, and the
// final reveal must never start before the round-3 success sequence finishes.
// Each ending is driven through the real reducer, then handed to the same
// end-of-run chain the page uses.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  dailyReducer,
  initDailyState,
  matchesOn,
  pairsFor,
  DAILY_ROUNDS,
  MISSES_PER_ROUND,
  type DailyAction,
  type DailyState,
} from "@/lib/dailyEngine";
import { runDailyEndSequence } from "@/lib/dailyEndSequence";
import { DAILY_FINAL_REVEAL_MS, DAILY_MATCH_SETTLE_MS } from "@/lib/animationTiming";

const R = (s: DailyState, a: DailyAction) => dailyReducer(s, a);

function toPlay(s: DailyState): DailyState {
  s = R(s, { type: "START" });
  s = R(s, { type: "REVEAL" });
  s = R(s, { type: "HIDE" });
  s = R(s, { type: "ROLL_START" });
  return R(s, { type: "PLAY_START", at: 0 });
}

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
  return pairsFor(s.grid, s.rolls[s.roundIndex - 1].attribute)[0];
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
  return R(s, { type: "ROUND_END", at: 200 });
}

const SEED = "whoop-2026-08-07";

/** Runs the chain for a finished state, recording the order of its steps. */
function endedOnSolve(s: DailyState): boolean {
  const last = s.roundEvents[s.roundEvents.length - 1] ?? [];
  return last[last.length - 1] === "SOLVE";
}

async function playOutEnding(final: DailyState) {
  const steps: string[] = [];
  let releaseSettle: (() => void) | null = null;

  const cancel = runDailyEndSequence({
    solved: endedOnSolve(final),
    awaitSettle: () =>
      new Promise<void>((resolve) => {
        releaseSettle = resolve;
      }),
    onSettleStart: () => steps.push("settle"),
    onReveal: () => steps.push("reveal"),
    onResults: () => steps.push("results"),
  });

  if (endedOnSolve(final)) {
    // Mid-settle: the reveal must not have started yet.
    await vi.advanceTimersByTimeAsync(DAILY_MATCH_SETTLE_MS - 1);
    expect(steps).toEqual(["settle"]);
    releaseSettle?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(steps).toEqual(["settle", "reveal"]);
    // The hold runs its full length before results.
    await vi.advanceTimersByTimeAsync(DAILY_FINAL_REVEAL_MS - 1);
    expect(steps).toEqual(["settle", "reveal"]);
    await vi.advanceTimersByTimeAsync(1);
  } else {
    await vi.advanceTimersByTimeAsync(0);
    expect(steps).toEqual(["reveal"]);
    await vi.advanceTimersByTimeAsync(DAILY_FINAL_REVEAL_MS - 1);
    expect(steps).toEqual(["reveal"]);
    await vi.advanceTimersByTimeAsync(1);
  }

  cancel();
  return steps;
}

describe("daily end-of-run sequence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("round 3 solved: settle, then reveal, then results", async () => {
    let s = toPlay(initDailyState(SEED));
    for (let r = 1; r <= DAILY_ROUNDS; r++) {
      const [i, j] = goodPair(s);
      s = claim(s, i, j, r * 100);
      if (r < DAILY_ROUNDS) s = nextRound(s);
    }
    expect(s.phase).toBe("DONE");
    expect(await playOutEnding(s)).toEqual(["settle", "reveal", "results"]);
  });

  it("all three rounds solved reaches results", async () => {
    let s = toPlay(initDailyState(SEED));
    for (let r = 1; r <= DAILY_ROUNDS; r++) {
      const [i, j] = goodPair(s);
      s = claim(s, i, j, r * 100);
      if (r < DAILY_ROUNDS) s = nextRound(s);
    }
    expect(s.roundsSolved).toBe(3);
    expect(await playOutEnding(s)).toContain("results");
  });

  it("round 3 ended on two misses: reveal without a settle step", async () => {
    let s = toPlay(initDailyState(SEED));
    for (let r = 1; r <= 2; r++) {
      const [i, j] = goodPair(s);
      s = claim(s, i, j, r * 100);
      s = nextRound(s);
    }
    s = whoopRound(s);
    expect(s.phase).toBe("DONE");
    expect(await playOutEnding(s)).toEqual(["reveal", "results"]);
  });

  it("all three rounds failed reaches results", async () => {
    let s = toPlay(initDailyState(SEED));
    for (let r = 1; r <= DAILY_ROUNDS; r++) {
      s = whoopRound(s);
      if (r < DAILY_ROUNDS) s = nextRound(s);
    }
    expect(s.phase).toBe("DONE");
    expect(await playOutEnding(s)).toEqual(["reveal", "results"]);
  });

  it("reaches results even if the settle never reports back", async () => {
    const steps: string[] = [];
    runDailyEndSequence({
      solved: true,
      awaitSettle: () => new Promise<void>(() => {}),
      onReveal: () => steps.push("reveal"),
      onResults: () => steps.push("results"),
    });
    await vi.advanceTimersByTimeAsync(
      DAILY_MATCH_SETTLE_MS + 500 + DAILY_FINAL_REVEAL_MS
    );
    expect(steps).toEqual(["reveal", "results"]);
  });

  it("cancels cleanly mid-chain", async () => {
    const steps: string[] = [];
    const cancel = runDailyEndSequence({
      solved: false,
      awaitSettle: () => Promise.resolve(),
      onReveal: () => steps.push("reveal"),
      onResults: () => steps.push("results"),
    });
    await vi.advanceTimersByTimeAsync(0);
    cancel();
    await vi.advanceTimersByTimeAsync(DAILY_FINAL_REVEAL_MS * 2);
    expect(steps).toEqual(["reveal"]);
  });
});
