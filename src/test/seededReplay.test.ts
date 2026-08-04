import { describe, it, expect } from "vitest";
import { createRng } from "@/lib/rng";
import { initialState, reducer, type State } from "@/hooks/useGameState";
import { computeSafetySwap, pickRoll, rngOf } from "@/lib/rolls";

const ROLL_ATTRS = ["SHAPE", "NUMBER", "COLOR"] as const;
const ids = (cards: { id: string }[]) => cards.map((c) => c.id);
const gridIds = (s: State) => s.grid.map((c) => c?.id ?? null);

/**
 * Replays a scripted seeded game: opening deal + N rolls + a safety swap,
 * all drawing from the single rng held in state.
 */
function replay(seed: string, rolls = 6) {
  let s = initialState(9, { seatCount: 2, seed });
  const rng = rngOf(s);
  const openingGrid = gridIds(s);
  const dieSequence: string[] = [...s.dieValues];
  const faceSequence: number[] = [];

  for (let i = 0; i < rolls; i++) {
    const { attribute, faceIndex } = pickRoll(ROLL_ATTRS, rng);
    dieSequence.push(attribute);
    faceSequence.push(faceIndex);
  }

  const swapped = computeSafetySwap(s.grid, s.deck, rng);
  s = reducer(s, { type: "SAFETY_SWAP", grid: swapped.grid, deck: swapped.deck });

  return {
    openingGrid,
    dieSequence,
    faceSequence,
    postSwapGrid: gridIds(s),
    postSwapDeck: ids(s.deck),
  };
}

describe("seeded game replay", () => {
  it("replays identically twice for the same seed", () => {
    const a = replay("2026-08-04");
    const b = replay("2026-08-04");
    expect(a.openingGrid).toEqual(b.openingGrid);
    expect(a.dieSequence).toEqual(b.dieSequence);
    expect(a.faceSequence).toEqual(b.faceSequence);
    expect(a.postSwapGrid).toEqual(b.postSwapGrid);
    expect(a.postSwapDeck).toEqual(b.postSwapDeck);
  });

  it("diverges for a different seed", () => {
    const a = replay("2026-08-04");
    const b = replay("2026-08-05");
    expect(
      a.dieSequence.join() !== b.dieSequence.join() ||
        a.openingGrid.join() !== b.openingGrid.join()
    ).toBe(true);
    expect(a.postSwapDeck).not.toEqual(b.postSwapDeck);
  });

  it("produces a varied die sequence, not one repeated value", () => {
    const { dieSequence } = replay("variety-check", 30);
    expect(new Set(dieSequence).size).toBeGreaterThan(1);
  });

  it("safety swap keeps the 48-card set intact", () => {
    const s = initialState(9, { seatCount: 2, seed: "swap" });
    const swapped = computeSafetySwap(s.grid, s.deck, rngOf(s));
    const before = [...ids(s.grid.filter((c): c is NonNullable<typeof c> => !!c)), ...ids(s.deck)];
    const after = [
      ...ids(swapped.grid.filter((c): c is NonNullable<typeof c> => !!c)),
      ...ids(swapped.deck),
    ];
    expect(after.sort()).toEqual(before.sort());
  });

  it("unseeded games still use Math.random and vary run to run", () => {
    const a = initialState(9, { seatCount: 2 });
    const b = initialState(9, { seatCount: 2 });
    expect(a.seed).toBeNull();
    expect(ids(a.deck)).not.toEqual(ids(b.deck));
  });
});

describe("rngOf", () => {
  it("falls back to Math.random when state carries no rng", () => {
    expect(rngOf({} as { rng?: () => number })).toBe(Math.random);
  });
});

describe("pickRoll", () => {
  it("is deterministic for a given seed", () => {
    const one = Array.from({ length: 10 }, ((r) => () => pickRoll(ROLL_ATTRS, r))(createRng("p")));
    const two = Array.from({ length: 10 }, ((r) => () => pickRoll(ROLL_ATTRS, r))(createRng("p")));
    expect(one).toEqual(two);
  });
});
