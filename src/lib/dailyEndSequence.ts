// ============================================================================
// dailyEndSequence — the one ordered chain that ends a daily run.
//
// The end of a run used to be a set of independent timeouts (settle timer,
// reveal timer, safety timer) that raced each other: the final reveal could
// fire on the same commit as the round-3 success animation, and the result
// screen could be stranded if the ghost callback landed on the wrong commit.
//
// This module replaces all of that with a single sequential chain. Each step
// only starts once the previous one has finished, and one cancel token covers
// the whole chain, so an unmount mid-flight cancels everything cleanly.
//
//   solved round 3:  settle (flip → hold → success → exit) → reveal → results
//   whooped round 3:                                          reveal → results
// ============================================================================

import { DAILY_FINAL_REVEAL_MS, DAILY_MATCH_SETTLE_MS } from "@/lib/animationTiming";

/** Hard bound on how long the chain ever waits on the settle step. */
export const SETTLE_TIMEOUT_MS = DAILY_MATCH_SETTLE_MS + 500;

export interface DailyEndSequenceOptions {
  /** True when round 3 was solved, so its success sequence plays first. */
  solved: boolean;
  /** Resolves when the solved pair has flipped, held, celebrated and exited. */
  awaitSettle: () => Promise<void>;
  /** Called as the settle step begins (solved runs only). */
  onSettleStart?: () => void;
  /** Called when the remaining cards flip face up. */
  onReveal: () => void;
  /** Called after the reveal hold, when the result screen may open. */
  onResults: () => void;
  /** Hold on the revealed board before the cross-fade. */
  revealHoldMs?: number;
  /** Safety bound on the settle step. */
  settleTimeoutMs?: number;
}

/** Starts the chain. Returns a cancel function that stops it at any step. */
export function runDailyEndSequence(opts: DailyEndSequenceOptions): () => void {
  const { solved, awaitSettle, onSettleStart, onReveal, onResults } = opts;
  const revealHoldMs = opts.revealHoldMs ?? DAILY_FINAL_REVEAL_MS;
  const settleTimeoutMs = opts.settleTimeoutMs ?? SETTLE_TIMEOUT_MS;

  let cancelled = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        timers.delete(t);
        resolve();
      }, ms);
      timers.add(t);
    });

  void (async () => {
    if (solved) {
      onSettleStart?.();
      // Whichever lands first: the settle finishing, or its safety bound.
      await Promise.race([awaitSettle(), sleep(settleTimeoutMs)]);
      if (cancelled) return;
    }
    onReveal();
    await sleep(revealHoldMs);
    if (cancelled) return;
    onResults();
  })();

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
    timers.clear();
  };
}
