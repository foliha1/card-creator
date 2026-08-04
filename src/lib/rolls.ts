/**
 * Shared, seed-aware roll and safety-swap helpers.
 *
 * Every post-init randomness decision that must be reproducible for a seeded
 * game reads its numbers from ONE source: the `rng` held in reducer state.
 * When no seed was supplied that rng IS `Math.random`, so behaviour is
 * unchanged for ordinary games.
 *
 * NOT included here on purpose:
 *  - the roll animation's tumble ticks (visual only, stay random)
 *  - `tumbleSeed` (confirmed: only feeds RollHeroOverlay's spin count and
 *    direction, i.e. animation only — so it stays random)
 */

import type { Rng } from "@/lib/rng";
import type { Card } from "@/cardData";

/** Read the deterministic source off reducer state. */
export function rngOf(state: { rng?: Rng }): Rng {
  return state.rng ?? Math.random;
}

/** Pick the committed die outcome for one roll, in a fixed call order. */
export function pickRoll<T extends string>(
  attrs: readonly T[],
  rng: Rng
): { attribute: T; faceIndex: 0 | 1 } {
  const attribute = attrs[Math.floor(rng() * attrs.length)];
  const faceIndex = Math.floor(rng() * 2) as 0 | 1;
  return { attribute, faceIndex };
}

/** Animation-only jitter seed. Never drawn from the seeded stream. */
export function pickTumbleSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Dead-grid safety valve: swap two filled slots back into the deck, reshuffle,
 * and re-deal. Deterministic when `rng` is seeded.
 */
export function computeSafetySwap(
  grid: (Card | null)[],
  deck: Card[],
  rng: Rng
): { grid: (Card | null)[]; deck: Card[] } {
  const filledIndices = grid
    .map((c, i) => (c !== null ? i : -1))
    .filter((i) => i !== -1);
  const swapIndices = shuffle([...filledIndices], rng).slice(0, 2);
  const newDeck = [...deck];
  const newGrid = [...grid];
  for (const idx of swapIndices) {
    if (newGrid[idx]) newDeck.push(newGrid[idx]!);
  }
  shuffle(newDeck, rng);
  for (const idx of swapIndices) {
    newGrid[idx] = newDeck.length > 0 ? newDeck.shift()! : null;
  }
  return { grid: newGrid, deck: newDeck };
}
