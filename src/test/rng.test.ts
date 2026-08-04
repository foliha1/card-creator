import { describe, it, expect } from "vitest";
import { createRng } from "@/lib/rng";
import { createDeck } from "@/cardData";
import { initialState } from "@/hooks/useGameState";

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng("2026-08-04");
    const b = createRng("2026-08-04");
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const r = createRng("range");
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = Array.from({ length: 20 }, createRng("seed-a"));
    const b = Array.from({ length: 20 }, createRng("seed-b"));
    expect(a).not.toEqual(b);
  });
});

describe("createDeck with a seeded rng", () => {
  it("is identical across two runs with the same seed", () => {
    const one = ids(createDeck(createRng("2026-08-04")));
    const two = ids(createDeck(createRng("2026-08-04")));
    expect(one).toEqual(two);
    expect(one).toHaveLength(48);
    expect(new Set(one).size).toBe(48);
  });

  it("differs for two different seeds", () => {
    const one = ids(createDeck(createRng("seed-a")));
    const two = ids(createDeck(createRng("seed-b")));
    expect(one).not.toEqual(two);
  });
});

describe("initialState seeding", () => {
  it("same seed yields the same grid, deck order and opening die", () => {
    const a = initialState(9, { seatCount: 2, seed: "2026-08-04" });
    const b = initialState(9, { seatCount: 2, seed: "2026-08-04" });
    expect(ids(a.grid.filter((c): c is NonNullable<typeof c> => !!c))).toEqual(
      ids(b.grid.filter((c): c is NonNullable<typeof c> => !!c))
    );
    expect(ids(a.deck)).toEqual(ids(b.deck));
    expect(a.dieValues).toEqual(b.dieValues);
    expect(a.rule).toEqual(b.rule);
  });

  it("different seeds yield different deck orders", () => {
    const a = initialState(9, { seatCount: 2, seed: "seed-a" });
    const b = initialState(9, { seatCount: 2, seed: "seed-b" });
    expect(ids(a.deck)).not.toEqual(ids(b.deck));
  });

  it("defaults to unseeded randomness when no seed is given", () => {
    const a = initialState(9, { seatCount: 2 });
    expect(a.seed).toBeNull();
    expect(typeof a.rng).toBe("function");
  });
});
