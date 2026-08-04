/**
 * Seeded random number source.
 *
 * `createRng(seed)` returns a `() => number` that behaves like `Math.random()`
 * (a float in [0, 1)), but is fully deterministic: the same seed produces the
 * same sequence every time, on every device.
 *
 * Implementation: cyrb128 string hash -> 128 bits of state, then mulberry32
 * seeded from the first word. Small, fast, no dependencies.
 */

export type Rng = () => number;

/** cyrb128 — hashes a string into four 32-bit words. */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/** mulberry32 — 32-bit seeded PRNG. */
export function mulberry32(a: number): Rng {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic `Math.random`-alike derived from a string seed. */
export function createRng(seed: string): Rng {
  const [h1] = cyrb128(seed);
  return mulberry32(h1);
}
