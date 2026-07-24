import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  reducer,
  initialState,
  type State,
  type Action,
  type Phase,
} from "@/hooks/useGameState";
import { ALL_CARDS, Card } from "@/cardData";

// ---------------------------------------------------------------------------
// Determinism: stub Math.random so initialState (deck shuffle + die roll) and
// the LAST_CALL die roll in cycleAdvance are deterministic. No production
// code changes are required for this.
// ---------------------------------------------------------------------------
let randSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  randSpy = vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  randSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Test helpers — build fully-controlled states without going through
// initialState (which owns randomness we want out of these unit tests).
// ---------------------------------------------------------------------------
function card(shape: string, number: number, color: string): Card {
  const id = `${shape}-${number}-${color}`;
  const c = ALL_CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`no such card: ${id}`);
  return c;
}

// Two cards that share SHAPE only.
const SHAPE_MATCH_A = card("circle", 1, "red");
const SHAPE_MATCH_B = card("circle", 2, "blue");
// Two cards that share nothing with the above (different shape/number/color).
const UNRELATED_A = card("square", 3, "yellow");
const UNRELATED_B = card("tri", 4, "blue");
const UNRELATED_C = card("star", 3, "red");
const UNRELATED_D = card("star", 4, "yellow");

function baseState(overrides: Partial<State> = {}): State {
  const grid: (Card | null)[] = [
    SHAPE_MATCH_A, // 0
    UNRELATED_A,   // 1
    SHAPE_MATCH_B, // 2
    UNRELATED_B,   // 3
    UNRELATED_C,   // 4
    UNRELATED_D,   // 5
  ];
  return {
    phase: "FLIPPING",
    slotCount: 6,
    roller: 0,
    flipper: 0,
    grid,
    deck: [card("square", 1, "blue"), card("square", 2, "red")],
    scores: [0, 0],
    rule: ["SHAPE"],
    dieValues: ["SHAPE"],
    wrongBy: [new Set<number>(), new Set<number>()],
    skip: [false, false],
    flippedThisCycle: new Set<number>(),
    claimedThisCycle: false,
    drawEmpty: false,
    roundNum: 1,
    roundsSinceClaim: 0,
    allFaceUp: false,
    selectedCards: [],
    matchedCards: new Set<number>(),
    peekingCard: null,
    rolling: false,
    message: "",
    messageType: "info",
    inFlight: null,
    claimPending: false,
    ...overrides,
  };
}

// ===========================================================================
// INIT
// ===========================================================================
describe("INIT", () => {
  it("returns a fresh initialState for the given slotCount", () => {
    const s = baseState({ scores: [7, 3], roundNum: 42 });
    const next = reducer(s, { type: "INIT", slotCount: 6 });
    expect(next.slotCount).toBe(6);
    expect(next.phase).toBe("AWAITING_ROLL");
    expect(next.scores).toEqual([0, 0]);
    expect(next.roundNum).toBe(1);
    expect(next.grid).toHaveLength(6);
  });

  it("is not phase-guarded (works from GAME_OVER)", () => {
    const s = baseState({ phase: "GAME_OVER" });
    const next = reducer(s, { type: "INIT", slotCount: 6 });
    expect(next.phase).toBe("AWAITING_ROLL");
  });
});

// ===========================================================================
// ROLL_START
// ===========================================================================
describe("ROLL_START", () => {
  it("sets rolling=true when in AWAITING_ROLL", () => {
    const s = baseState({ phase: "AWAITING_ROLL" });
    const next = reducer(s, { type: "ROLL_START" });
    expect(next.rolling).toBe(true);
  });

  it("is a NO-OP outside AWAITING_ROLL", () => {
    for (const phase of ["FLIPPING", "CLAIM_SELECTING", "CLAIM_RESOLVING", "LAST_CALL", "GAME_OVER"] as Phase[]) {
      const s = baseState({ phase });
      expect(reducer(s, { type: "ROLL_START" })).toBe(s);
    }
  });
});

// ===========================================================================
// TUMBLE
// ===========================================================================
describe("TUMBLE", () => {
  it("updates dieValues while rolling", () => {
    const s = baseState({ phase: "AWAITING_ROLL", rolling: true, dieValues: ["SHAPE"] });
    const next = reducer(s, { type: "TUMBLE", values: ["COLOR"] });
    expect(next.dieValues).toEqual(["COLOR"]);
  });

  it("is a NO-OP when not rolling", () => {
    const s = baseState({ rolling: false });
    expect(reducer(s, { type: "TUMBLE", values: ["COLOR"] })).toBe(s);
  });
});

// ===========================================================================
// ROLL_LAND
// ===========================================================================
describe("ROLL_LAND", () => {
  it("sets dieValues and rule while rolling", () => {
    const s = baseState({ phase: "AWAITING_ROLL", rolling: true });
    const next = reducer(s, { type: "ROLL_LAND", values: ["COLOR"], rule: ["COLOR"] });
    expect(next.dieValues).toEqual(["COLOR"]);
    expect(next.rule).toEqual(["COLOR"]);
    expect(next.rolling).toBe(true); // rolling stays true until ROLL_SETTLE
  });

  it("is a NO-OP when not rolling", () => {
    const s = baseState({ rolling: false });
    expect(reducer(s, { type: "ROLL_LAND", values: ["COLOR"], rule: ["COLOR"] })).toBe(s);
  });
});

// ===========================================================================
// ROLL_SETTLE
// ===========================================================================
describe("ROLL_SETTLE", () => {
  it("clears rolling and enters FLIPPING with flipper=roller", () => {
    const s = baseState({ phase: "AWAITING_ROLL", rolling: true, roller: 1, flipper: 0 });
    const next = reducer(s, { type: "ROLL_SETTLE" });
    expect(next.rolling).toBe(false);
    expect(next.phase).toBe("FLIPPING");
    expect(next.flipper).toBe(1);
  });

  it("routes into CLAIM_SELECTING when claimPending was set", () => {
    const s = baseState({ phase: "AWAITING_ROLL", rolling: true, claimPending: true });
    const next = reducer(s, { type: "ROLL_SETTLE" });
    expect(next.phase).toBe("CLAIM_SELECTING");
    expect(next.claimPending).toBe(false);
    expect(next.selectedCards).toEqual([]);
  });

  it("is a NO-OP when not rolling", () => {
    const s = baseState({ rolling: false });
    expect(reducer(s, { type: "ROLL_SETTLE" })).toBe(s);
  });
});

// ===========================================================================
// FLIP_START
// ===========================================================================
describe("FLIP_START", () => {
  it("sets inFlight and peekingCard on the current flipper's flip", () => {
    const s = baseState({ phase: "FLIPPING", flipper: 0 });
    const next = reducer(s, { type: "FLIP_START", by: 0, idx: 0, token: 1 });
    expect(next.inFlight).toMatchObject({ kind: "flip", token: 1, by: 0, idx: 0 });
    expect(next.peekingCard).toBe(0);
  });

  it("is a NO-OP outside FLIPPING", () => {
    const s = baseState({ phase: "AWAITING_ROLL" });
    expect(reducer(s, { type: "FLIP_START", by: 0, idx: 0, token: 1 })).toBe(s);
  });

  it("is a NO-OP when by !== flipper", () => {
    const s = baseState({ phase: "FLIPPING", flipper: 0 });
    expect(reducer(s, { type: "FLIP_START", by: 1, idx: 0, token: 1 })).toBe(s);
  });

  it("is a NO-OP when another action is inFlight", () => {
    const s = baseState({
      phase: "FLIPPING",
      inFlight: { kind: "flip", token: 9, by: 0, idx: 1 },
    });
    expect(reducer(s, { type: "FLIP_START", by: 0, idx: 2, token: 10 })).toBe(s);
  });

  it("is a NO-OP when the idx is in the flipper's wrongBy set", () => {
    const s = baseState({
      phase: "FLIPPING",
      wrongBy: [new Set([0]), new Set()],
    });
    expect(reducer(s, { type: "FLIP_START", by: 0, idx: 0, token: 1 })).toBe(s);
  });

  it("is a NO-OP when the target slot is null", () => {
    const grid = baseState().grid.slice();
    grid[0] = null;
    const s = baseState({ grid });
    expect(reducer(s, { type: "FLIP_START", by: 0, idx: 0, token: 1 })).toBe(s);
  });
});

// ===========================================================================
// FLIP_COMPLETE
// ===========================================================================
describe("FLIP_COMPLETE", () => {
  it("consumes the current-token flip and advances the cycle", () => {
    const s = baseState({
      phase: "FLIPPING",
      flipper: 0,
      inFlight: { kind: "flip", token: 5, by: 0, idx: 0 },
      peekingCard: 0,
    });
    const next = reducer(s, { type: "FLIP_COMPLETE", token: 5 });
    // Cycle not complete after one flip (2-player game) → flipper rotates.
    expect(next.flipper).toBe(1);
    expect(next.inFlight).toBeNull();
    expect(next.peekingCard).toBeNull();
    expect(next.flippedThisCycle.has(0)).toBe(true);
  });

  it("STALE-TOKEN rejection: ignores completions whose token doesn't match", () => {
    const s = baseState({
      phase: "FLIPPING",
      inFlight: { kind: "flip", token: 5, by: 0, idx: 0 },
      peekingCard: 0,
    });
    expect(reducer(s, { type: "FLIP_COMPLETE", token: 4 })).toBe(s);
    expect(reducer(s, { type: "FLIP_COMPLETE", token: 6 })).toBe(s);
  });

  it("is a NO-OP when inFlight is not a flip", () => {
    const s = baseState({
      phase: "CLAIM_RESOLVING",
      inFlight: { kind: "claim", token: 5, by: 1, a: 0, b: 2 },
    });
    expect(reducer(s, { type: "FLIP_COMPLETE", token: 5 })).toBe(s);
  });
});

// ===========================================================================
// HUMAN_ENTER_CLAIM
// ===========================================================================
describe("HUMAN_ENTER_CLAIM", () => {
  it("enters CLAIM_SELECTING from FLIPPING and records the held flip", () => {
    const s = baseState({
      phase: "FLIPPING",
      flipper: 0,
      inFlight: { kind: "flip", token: 5, by: 0, idx: 3 },
      peekingCard: 3,
    });
    const next = reducer(s, { type: "HUMAN_ENTER_CLAIM" });
    expect(next.phase).toBe("CLAIM_SELECTING");
    expect(next.flippedThisCycle.has(0)).toBe(true);
    expect(next.inFlight).toBeNull();
    expect(next.peekingCard).toBeNull();
    expect(next.selectedCards).toEqual([]);
  });

  it("records the flipper into flippedThisCycle when no flip is in flight", () => {
    const s = baseState({ phase: "FLIPPING", flipper: 0 });
    const next = reducer(s, { type: "HUMAN_ENTER_CLAIM" });
    expect(next.flippedThisCycle.has(0)).toBe(true);
  });

  it("is a NO-OP outside FLIPPING", () => {
    const s = baseState({ phase: "AWAITING_ROLL" });
    expect(reducer(s, { type: "HUMAN_ENTER_CLAIM" })).toBe(s);
  });
});

// ===========================================================================
// HUMAN_ENTER_CLAIM_DURING_ROLL
// ===========================================================================
describe("HUMAN_ENTER_CLAIM_DURING_ROLL", () => {
  it("sets claimPending in AWAITING_ROLL when human is roller", () => {
    const s = baseState({ phase: "AWAITING_ROLL", roller: 0 });
    const next = reducer(s, { type: "HUMAN_ENTER_CLAIM_DURING_ROLL" });
    expect(next.claimPending).toBe(true);
  });

  it("is a NO-OP outside AWAITING_ROLL", () => {
    const s = baseState({ phase: "FLIPPING", roller: 0 });
    expect(reducer(s, { type: "HUMAN_ENTER_CLAIM_DURING_ROLL" })).toBe(s);
  });

  it("is a NO-OP when human is not the roller", () => {
    const s = baseState({ phase: "AWAITING_ROLL", roller: 1 });
    expect(reducer(s, { type: "HUMAN_ENTER_CLAIM_DURING_ROLL" })).toBe(s);
  });

  it("is a NO-OP when already pending", () => {
    const s = baseState({ phase: "AWAITING_ROLL", roller: 0, claimPending: true });
    expect(reducer(s, { type: "HUMAN_ENTER_CLAIM_DURING_ROLL" })).toBe(s);
  });
});

// ===========================================================================
// HUMAN_SELECT_CARD
// ===========================================================================
describe("HUMAN_SELECT_CARD", () => {
  it("appends the index to selectedCards", () => {
    const s = baseState({ phase: "CLAIM_SELECTING", selectedCards: [] });
    const next = reducer(s, { type: "HUMAN_SELECT_CARD", idx: 2 });
    expect(next.selectedCards).toEqual([2]);
  });

  it("is a NO-OP outside CLAIM_SELECTING", () => {
    const s = baseState({ phase: "FLIPPING" });
    expect(reducer(s, { type: "HUMAN_SELECT_CARD", idx: 2 })).toBe(s);
  });

  it("is a NO-OP for a card in the human's wrongBy set", () => {
    const s = baseState({
      phase: "CLAIM_SELECTING",
      wrongBy: [new Set([2]), new Set()],
    });
    expect(reducer(s, { type: "HUMAN_SELECT_CARD", idx: 2 })).toBe(s);
  });

  it("is a NO-OP for a duplicate selection", () => {
    const s = baseState({ phase: "CLAIM_SELECTING", selectedCards: [2] });
    expect(reducer(s, { type: "HUMAN_SELECT_CARD", idx: 2 })).toBe(s);
  });

  it("is a NO-OP for a null grid slot", () => {
    const grid = baseState().grid.slice();
    grid[2] = null;
    const s = baseState({ phase: "CLAIM_SELECTING", grid });
    expect(reducer(s, { type: "HUMAN_SELECT_CARD", idx: 2 })).toBe(s);
  });

  it("is a NO-OP once two cards are already selected", () => {
    const s = baseState({ phase: "CLAIM_SELECTING", selectedCards: [0, 1] });
    expect(reducer(s, { type: "HUMAN_SELECT_CARD", idx: 3 })).toBe(s);
  });
});

// ===========================================================================
// HUMAN_RESOLVE_MATCH
// ===========================================================================
describe("HUMAN_RESOLVE_MATCH", () => {
  it("correct match: +2 points, refills slots, winner rolls next round", () => {
    const s = baseState({
      phase: "CLAIM_SELECTING",
      selectedCards: [0, 2], // SHAPE_MATCH_A + SHAPE_MATCH_B share SHAPE
      rule: ["SHAPE"],
      roller: 1, // opponent rolled — should switch to human on correct claim
      flipper: 1,
      roundNum: 3,
    });
    const next = reducer(s, { type: "HUMAN_RESOLVE_MATCH" });
    expect(next.scores).toEqual([2, 0]);
    expect(next.phase).toBe("AWAITING_ROLL");
    // Winner rolls
    expect(next.roller).toBe(0);
    expect(next.flipper).toBe(0);
    expect(next.roundNum).toBe(4);
    // startRound resets matchedCards; the interim matchedCards set is not observable here.
    expect(next.matchedCards.size).toBe(0);
    // Refilled from deck (base deck had 2 cards, so slot 0 & 2 now non-null)
    expect(next.grid[0]).not.toBeNull();
    expect(next.grid[2]).not.toBeNull();
  });

  it("wrong match: no score, adds both to human's wrongBy, sets skip[0], stays in FLIPPING via cycleAdvance", () => {
    const s = baseState({
      phase: "CLAIM_SELECTING",
      selectedCards: [1, 3], // unrelated cards, no shared SHAPE
      rule: ["SHAPE"],
      flipper: 0,
      flippedThisCycle: new Set([0]), // human already recorded their flip
    });
    const next = reducer(s, { type: "HUMAN_RESOLVE_MATCH" });
    expect(next.scores).toEqual([0, 0]);
    expect(next.wrongBy[0].has(1)).toBe(true);
    expect(next.wrongBy[0].has(3)).toBe(true);
    expect(next.skip[0]).toBe(true);
    // human already flipped this cycle → cycleAdvance passes flipper to opponent
    expect(next.flipper).toBe(1);
    expect(next.phase).toBe("FLIPPING");
  });

  it("is a NO-OP outside CLAIM_SELECTING", () => {
    const s = baseState({ phase: "FLIPPING", selectedCards: [0, 2] });
    expect(reducer(s, { type: "HUMAN_RESOLVE_MATCH" })).toBe(s);
  });

  it("is a NO-OP when fewer than 2 cards are selected", () => {
    const s = baseState({ phase: "CLAIM_SELECTING", selectedCards: [0] });
    expect(reducer(s, { type: "HUMAN_RESOLVE_MATCH" })).toBe(s);
  });
});

// ===========================================================================
// SKIP_TICK
// ===========================================================================
describe("SKIP_TICK", () => {
  it("consumes the current flipper's skip flag and advances the cycle (one turn lost)", () => {
    const s = baseState({
      phase: "FLIPPING",
      flipper: 0,
      skip: [true, false],
    });
    const next = reducer(s, { type: "SKIP_TICK" });
    expect(next.skip).toEqual([false, false]);
    // Cycle advances: flipper rotates to opponent, flippedThisCycle records human.
    expect(next.flipper).toBe(1);
    expect(next.flippedThisCycle.has(0)).toBe(true);
  });

  it("is a NO-OP when the flipper has no skip flag", () => {
    const s = baseState({ phase: "FLIPPING", flipper: 0, skip: [false, false] });
    expect(reducer(s, { type: "SKIP_TICK" })).toBe(s);
  });

  it("is a NO-OP outside FLIPPING", () => {
    const s = baseState({ phase: "AWAITING_ROLL", skip: [true, false] });
    expect(reducer(s, { type: "SKIP_TICK" })).toBe(s);
  });

  it("is a NO-OP while another action is inFlight", () => {
    const s = baseState({
      phase: "FLIPPING",
      flipper: 0,
      skip: [true, false],
      inFlight: { kind: "flip", token: 1, by: 0, idx: 0 },
    });
    expect(reducer(s, { type: "SKIP_TICK" })).toBe(s);
  });
});

// ===========================================================================
// CLAIM_START (opponent-initiated)
// ===========================================================================
describe("CLAIM_START", () => {
  it("puts the state into CLAIM_RESOLVING for a valid opponent claim", () => {
    const s = baseState({ phase: "FLIPPING" });
    const next = reducer(s, { type: "CLAIM_START", by: 1, a: 0, b: 2, token: 7 });
    expect(next.phase).toBe("CLAIM_RESOLVING");
    expect(next.inFlight).toMatchObject({ kind: "claim", token: 7, by: 1, a: 0, b: 2 });
    expect(next.flippedThisCycle.has(1)).toBe(true);
    expect(next.peekingCard).toBeNull();
  });

  it("is a NO-OP outside FLIPPING (e.g. AWAITING_ROLL)", () => {
    const s = baseState({ phase: "AWAITING_ROLL" });
    expect(reducer(s, { type: "CLAIM_START", by: 1, a: 0, b: 2, token: 1 })).toBe(s);
  });

  it("is a NO-OP for by === 0 (humans use HUMAN_RESOLVE_MATCH)", () => {
    const s = baseState({ phase: "FLIPPING" });
    expect(reducer(s, { type: "CLAIM_START", by: 0, a: 0, b: 2, token: 1 })).toBe(s);
  });

  it("is a NO-OP when either target slot is null", () => {
    const grid = baseState().grid.slice();
    grid[2] = null;
    const s = baseState({ phase: "FLIPPING", grid });
    expect(reducer(s, { type: "CLAIM_START", by: 1, a: 0, b: 2, token: 1 })).toBe(s);
  });

  it("is a NO-OP when a card is in the claimant's wrongBy set", () => {
    const s = baseState({
      phase: "FLIPPING",
      wrongBy: [new Set(), new Set([0])],
    });
    expect(reducer(s, { type: "CLAIM_START", by: 1, a: 0, b: 2, token: 1 })).toBe(s);
  });
});

// ===========================================================================
// CLAIM_RESOLVE
// ===========================================================================
describe("CLAIM_RESOLVE", () => {
  it("correct opponent claim: +2 opponent, winner rolls (opponent becomes roller)", () => {
    const s = baseState({
      phase: "CLAIM_RESOLVING",
      inFlight: { kind: "claim", token: 7, by: 1, a: 0, b: 2 },
      roller: 0,
      flipper: 0,
      rule: ["SHAPE"],
      roundNum: 5,
    });
    const next = reducer(s, { type: "CLAIM_RESOLVE", token: 7 });
    expect(next.scores).toEqual([0, 2]);
    expect(next.phase).toBe("AWAITING_ROLL");
    expect(next.roller).toBe(1);
    expect(next.flipper).toBe(1);
    expect(next.roundNum).toBe(6);
  });

  it("wrong opponent claim: adds to opponent wrongBy, sets skip[1], stays in FLIPPING", () => {
    const s = baseState({
      phase: "CLAIM_RESOLVING",
      inFlight: { kind: "claim", token: 7, by: 1, a: 1, b: 3 },
      rule: ["SHAPE"],
      flippedThisCycle: new Set([0, 1]), // ensure cycle already complete → roll passes on cycleAdvance
      claimedThisCycle: false,
    });
    const next = reducer(s, { type: "CLAIM_RESOLVE", token: 7 });
    expect(next.scores).toEqual([0, 0]);
    // Full cycle with no successful claim → cycleAdvance starts a new round
    expect(next.phase).toBe("AWAITING_ROLL");
    // wrongBy is reset by startRound at round transition
    expect(next.wrongBy[1].has(1)).toBe(false);
    // The skip that was just set gets cleared by startRound too.
    expect(next.skip).toEqual([false, false]);
  });

  it("wrong opponent claim mid-cycle: retains wrongBy + skip and stays in FLIPPING", () => {
    const s = baseState({
      phase: "CLAIM_RESOLVING",
      inFlight: { kind: "claim", token: 7, by: 1, a: 1, b: 3 },
      rule: ["SHAPE"],
      flippedThisCycle: new Set(), // cycle NOT complete yet
    });
    const next = reducer(s, { type: "CLAIM_RESOLVE", token: 7 });
    expect(next.phase).toBe("FLIPPING");
    expect(next.wrongBy[1].has(1)).toBe(true);
    expect(next.wrongBy[1].has(3)).toBe(true);
    expect(next.skip[1]).toBe(true);
  });

  it("STALE-TOKEN rejection: mismatched tokens are ignored", () => {
    const s = baseState({
      phase: "CLAIM_RESOLVING",
      inFlight: { kind: "claim", token: 7, by: 1, a: 0, b: 2 },
    });
    expect(reducer(s, { type: "CLAIM_RESOLVE", token: 6 })).toBe(s);
    expect(reducer(s, { type: "CLAIM_RESOLVE", token: 8 })).toBe(s);
  });

  it("is a NO-OP when inFlight is not a claim", () => {
    const s = baseState({
      phase: "FLIPPING",
      inFlight: { kind: "flip", token: 7, by: 0, idx: 0 },
    });
    expect(reducer(s, { type: "CLAIM_RESOLVE", token: 7 })).toBe(s);
  });
});

// ===========================================================================
// LAST_CALL_CLAIM
// ===========================================================================
describe("LAST_CALL_CLAIM", () => {
  it("human valid claim in LAST_CALL: +2, cards removed, no refill", () => {
    const s = baseState({
      phase: "LAST_CALL",
      rule: ["SHAPE"],
      deck: [],
      // Ensure a second pair remains so the game doesn't end.
      grid: [
        SHAPE_MATCH_A,          // 0
        card("square", 1, "red"),  // 1 shares SHAPE with 3
        SHAPE_MATCH_B,          // 2
        card("square", 2, "blue"), // 3
        UNRELATED_C,            // 4
        UNRELATED_D,            // 5
      ],
    });
    const next = reducer(s, { type: "LAST_CALL_CLAIM", by: 0, a: 0, b: 2 });
    expect(next.scores).toEqual([2, 0]);
    expect(next.grid[0]).toBeNull();
    expect(next.grid[2]).toBeNull();
  });

  it("opponent valid claim in LAST_CALL: +2 opponent", () => {
    const s = baseState({
      phase: "LAST_CALL",
      rule: ["SHAPE"],
      grid: [
        SHAPE_MATCH_A,
        card("square", 1, "red"),
        SHAPE_MATCH_B,
        card("square", 2, "blue"),
        UNRELATED_C,
        UNRELATED_D,
      ],
    });
    const next = reducer(s, { type: "LAST_CALL_CLAIM", by: 1, a: 0, b: 2 });
    expect(next.scores).toEqual([0, 2]);
  });

  it("ends the game when the grid has no valid pair left", () => {
    const s = baseState({
      phase: "LAST_CALL",
      rule: ["SHAPE"],
      grid: [SHAPE_MATCH_A, null, SHAPE_MATCH_B, null, null, null],
    });
    const next = reducer(s, { type: "LAST_CALL_CLAIM", by: 0, a: 0, b: 2 });
    expect(next.phase).toBe("GAME_OVER");
    expect(next.scores).toEqual([2, 0]);
  });

  it("is a NO-OP outside LAST_CALL", () => {
    const s = baseState({ phase: "FLIPPING" });
    expect(reducer(s, { type: "LAST_CALL_CLAIM", by: 0, a: 0, b: 2 })).toBe(s);
  });

  it("is a NO-OP for invalid pair (does NOT penalize) — matches current behaviour", () => {
    const s = baseState({ phase: "LAST_CALL", rule: ["SHAPE"] });
    const next = reducer(s, { type: "LAST_CALL_CLAIM", by: 0, a: 1, b: 3 });
    expect(next).toBe(s);
  });

  it("is a NO-OP when a === b", () => {
    const s = baseState({ phase: "LAST_CALL" });
    expect(reducer(s, { type: "LAST_CALL_CLAIM", by: 0, a: 0, b: 0 })).toBe(s);
  });
});

// ===========================================================================
// SAFETY_SWAP
// ===========================================================================
describe("SAFETY_SWAP", () => {
  it("replaces grid + deck and shows the warning message", () => {
    const newGrid = baseState().grid.slice();
    newGrid[0] = UNRELATED_A;
    const newDeck: Card[] = [];
    const s = baseState();
    const next = reducer(s, { type: "SAFETY_SWAP", grid: newGrid, deck: newDeck });
    expect(next.grid).toBe(newGrid);
    expect(next.deck).toBe(newDeck);
    expect(next.messageType).toBe("warning");
  });

  it("is NOT phase-guarded (applies from any phase, including GAME_OVER)", () => {
    // NOTE: this is *current* reducer behaviour. If we want to lock a
    // phase guard around SAFETY_SWAP, that's a real change, not a test.
    const s = baseState({ phase: "GAME_OVER" });
    const next = reducer(s, { type: "SAFETY_SWAP", grid: s.grid, deck: s.deck });
    expect(next.messageType).toBe("warning");
  });
});

// ===========================================================================
// REMOVE_MATCHED
// ===========================================================================
describe("REMOVE_MATCHED", () => {
  it("clears the matched slots in the grid", () => {
    const s = baseState({ matchedCards: new Set([0, 2]) });
    const next = reducer(s, { type: "REMOVE_MATCHED" });
    expect(next.grid[0]).toBeNull();
    expect(next.grid[2]).toBeNull();
  });

  it("is a NO-OP when matchedCards is empty", () => {
    const s = baseState({ matchedCards: new Set() });
    expect(reducer(s, { type: "REMOVE_MATCHED" })).toBe(s);
  });
});

// ===========================================================================
// SET_MESSAGE
// ===========================================================================
describe("SET_MESSAGE", () => {
  it("updates message and messageType from any phase", () => {
    const s = baseState({ phase: "GAME_OVER" });
    const next = reducer(s, { type: "SET_MESSAGE", message: "hi", messageType: "warning" });
    expect(next.message).toBe("hi");
    expect(next.messageType).toBe("warning");
  });
});

// ===========================================================================
// Behavioural coverage — the pieces most at risk in the multiplayer refactor.
// ===========================================================================
describe("stale-token rejection (both flip + claim)", () => {
  it("FLIP_COMPLETE with a stale token does nothing; the current token completes the flip", () => {
    const s = baseState({
      phase: "FLIPPING",
      inFlight: { kind: "flip", token: 10, by: 0, idx: 0 },
      peekingCard: 0,
    });
    // Stale token first.
    const stale = reducer(s, { type: "FLIP_COMPLETE", token: 9 });
    expect(stale).toBe(s);
    // Current token completes.
    const fresh = reducer(s, { type: "FLIP_COMPLETE", token: 10 });
    expect(fresh.inFlight).toBeNull();
    expect(fresh.flippedThisCycle.has(0)).toBe(true);
  });

  it("CLAIM_RESOLVE with a stale token does nothing; the current token resolves the claim", () => {
    const s = baseState({
      phase: "CLAIM_RESOLVING",
      inFlight: { kind: "claim", token: 12, by: 1, a: 0, b: 2 },
      rule: ["SHAPE"],
    });
    expect(reducer(s, { type: "CLAIM_RESOLVE", token: 11 })).toBe(s);
    const fresh = reducer(s, { type: "CLAIM_RESOLVE", token: 12 });
    expect(fresh.scores).toEqual([0, 2]);
  });
});

describe("skip penalty end-to-end", () => {
  it("wrong claim → skip[i]=true → the very next SKIP_TICK for that player consumes exactly one turn", () => {
    // Setup: human just made a wrong claim, opponent has already flipped this
    // cycle (so cycleAdvance after skip completes the round).
    let s = baseState({
      phase: "CLAIM_SELECTING",
      selectedCards: [1, 3], // wrong pair
      rule: ["SHAPE"],
      flipper: 0,
      flippedThisCycle: new Set([0]),
    });
    s = reducer(s, { type: "HUMAN_RESOLVE_MATCH" });
    expect(s.skip[0]).toBe(true);
    // After cycleAdvance, flipper is now opponent (1). Simulate the opponent
    // completing their flip so the cycle rolls back to the human.
    // Instead, just simulate reaching the human's next turn: set flipper=0 again.
    s = { ...s, flipper: 0, flippedThisCycle: new Set(), phase: "FLIPPING" };
    // First SKIP_TICK: consumes the flag AND counts as human's flip for this cycle.
    const afterFirst = reducer(s, { type: "SKIP_TICK" });
    expect(afterFirst.skip[0]).toBe(false);
    expect(afterFirst.flippedThisCycle.has(0)).toBe(true);
    // Second SKIP_TICK (no penalty left): NO-OP, no additional turn lost.
    const afterSecond = reducer(afterFirst, { type: "SKIP_TICK" });
    expect(afterSecond).toBe(afterFirst);
  });
});

describe("cycle advancement in a 2-player game", () => {
  it("first flip rotates the flipper; second flip completes the cycle (no draw → passes roll)", () => {
    // Set up mid-cycle: human just finished their flip.
    let s = baseState({
      phase: "FLIPPING",
      flipper: 0,
      inFlight: { kind: "flip", token: 1, by: 0, idx: 0 },
      peekingCard: 0,
      flippedThisCycle: new Set(),
    });
    s = reducer(s, { type: "FLIP_COMPLETE", token: 1 });
    expect(s.flipper).toBe(1);
    expect(s.phase).toBe("FLIPPING");
    // Opponent flip.
    s = { ...s, inFlight: { kind: "flip", token: 2, by: 1, idx: 3 }, peekingCard: 3 };
    s = reducer(s, { type: "FLIP_COMPLETE", token: 2 });
    // Cycle complete, deck not empty → new round via startRound (roll passes clockwise).
    expect(s.phase).toBe("AWAITING_ROLL");
    expect(s.roller).toBe(1); // roller rotated
  });
});

describe("winner rolls (v6.2)", () => {
  it("human correct claim makes the human next roller", () => {
    const s = baseState({
      phase: "CLAIM_SELECTING",
      selectedCards: [0, 2],
      rule: ["SHAPE"],
      roller: 1,
      flipper: 1,
    });
    const next = reducer(s, { type: "HUMAN_RESOLVE_MATCH" });
    expect(next.roller).toBe(0);
    expect(next.flipper).toBe(0);
  });

  it("opponent correct claim makes the opponent next roller", () => {
    const s = baseState({
      phase: "CLAIM_RESOLVING",
      inFlight: { kind: "claim", token: 3, by: 1, a: 0, b: 2 },
      rule: ["SHAPE"],
      roller: 0,
      flipper: 0,
    });
    const next = reducer(s, { type: "CLAIM_RESOLVE", token: 3 });
    expect(next.roller).toBe(1);
    expect(next.flipper).toBe(1);
  });
});

describe("LAST_CALL entry conditions", () => {
  it("cycle-complete + drawEmpty + no-claim-this-cycle enters LAST_CALL", () => {
    // Human already flipped; opponent about to complete the cycle.
    const s = baseState({
      phase: "FLIPPING",
      flipper: 1,
      drawEmpty: true,
      claimedThisCycle: false,
      flippedThisCycle: new Set([0]),
      inFlight: { kind: "flip", token: 4, by: 1, idx: 3 },
      peekingCard: 3,
    });
    const next = reducer(s, { type: "FLIP_COMPLETE", token: 4 });
    expect(next.phase).toBe("LAST_CALL");
    expect(next.allFaceUp).toBe(true);
    // die rule reset with Math.random=0 → ATTRIBUTES[0] = "SHAPE".
    expect(next.rule).toEqual(["SHAPE"]);
  });

  it("cycle-complete + drawEmpty + claimedThisCycle does NOT enter LAST_CALL (passes roll instead)", () => {
    const s = baseState({
      phase: "FLIPPING",
      flipper: 1,
      drawEmpty: true,
      claimedThisCycle: true,
      flippedThisCycle: new Set([0]),
      inFlight: { kind: "flip", token: 4, by: 1, idx: 3 },
      peekingCard: 3,
    });
    const next = reducer(s, { type: "FLIP_COMPLETE", token: 4 });
    expect(next.phase).toBe("AWAITING_ROLL");
  });
});

describe("game over terminal", () => {
  it("startRound with no cards left and empty deck yields GAME_OVER", () => {
    // Force a scenario: correct human claim removes the last two cards, no deck.
    const s = baseState({
      phase: "CLAIM_SELECTING",
      selectedCards: [0, 2],
      rule: ["SHAPE"],
      deck: [], // empty
      // Leave only the two selected cards on the grid.
      grid: [
        SHAPE_MATCH_A,
        null,
        SHAPE_MATCH_B,
        null,
        null,
        null,
      ],
    });
    const next = reducer(s, { type: "HUMAN_RESOLVE_MATCH" });
    expect(next.phase).toBe("GAME_OVER");
    expect(next.scores).toEqual([2, 0]);
  });

  it("further actions after GAME_OVER are ignored where phase-guarded", () => {
    const s = baseState({ phase: "GAME_OVER" });
    expect(reducer(s, { type: "ROLL_START" })).toBe(s);
    expect(reducer(s, { type: "HUMAN_ENTER_CLAIM" })).toBe(s);
    expect(reducer(s, { type: "HUMAN_SELECT_CARD", idx: 0 })).toBe(s);
    expect(reducer(s, { type: "FLIP_START", by: 0, idx: 0, token: 1 })).toBe(s);
    expect(reducer(s, { type: "SKIP_TICK" })).toBe(s);
    expect(reducer(s, { type: "LAST_CALL_CLAIM", by: 0, a: 0, b: 2 })).toBe(s);
  });
});

describe("scoring", () => {
  it("correct human claim adds exactly 2 to scores[0]", () => {
    const s = baseState({
      phase: "CLAIM_SELECTING",
      selectedCards: [0, 2],
      rule: ["SHAPE"],
      scores: [4, 6],
    });
    const next = reducer(s, { type: "HUMAN_RESOLVE_MATCH" });
    expect(next.scores).toEqual([6, 6]);
  });

  it("correct opponent claim adds exactly 2 to scores[1]", () => {
    const s = baseState({
      phase: "CLAIM_RESOLVING",
      inFlight: { kind: "claim", token: 1, by: 1, a: 0, b: 2 },
      rule: ["SHAPE"],
      scores: [4, 6],
    });
    const next = reducer(s, { type: "CLAIM_RESOLVE", token: 1 });
    expect(next.scores).toEqual([4, 8]);
  });

  it("last-call claim also awards +2 (no Double Jeopardy in this reducer)", () => {
    const s = baseState({
      phase: "LAST_CALL",
      rule: ["SHAPE"],
      grid: [
        SHAPE_MATCH_A,
        card("square", 1, "red"),
        SHAPE_MATCH_B,
        card("square", 2, "blue"),
        UNRELATED_C,
        UNRELATED_D,
      ],
    });
    const next = reducer(s, { type: "LAST_CALL_CLAIM", by: 0, a: 0, b: 2 });
    expect(next.scores).toEqual([2, 0]);
  });
});

// Confirm initialState is deterministic under our stub — a sanity check.
describe("initialState (deterministic under Math.random stub)", () => {
  it("produces the same state on repeated calls", () => {
    const a = initialState(6);
    const b = initialState(6);
    expect(a.grid.map((c) => c?.id)).toEqual(b.grid.map((c) => c?.id));
    expect(a.rule).toEqual(b.rule);
    expect(a.dieValues).toEqual(b.dieValues);
  });
});
