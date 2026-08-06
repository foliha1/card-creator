// Single source of truth for animation timings that BOTH CSS and JS need.
//
// The CSS rules in index.css read these through custom properties
// (`--ww-great-delay`, `--ww-deal-stagger`, `--ww-deal-move`) with the same
// literals as fallbacks; `applyAnimationTimingVars()` writes the authoritative
// values onto :root at startup so the two can never drift.

/** Delay before the great-match ghost animation starts (`.ww-great*`). */
export const GREAT_MATCH_DELAY_MS = 300;
/** Per-card stagger of the deal-in animation (`--ww-deal-i * stagger`). */
export const DEAL_STAGGER_MS = 60;
/** Duration of the deal-in move — a card "lands" at the end of it. */
export const DEAL_MOVE_MS = 900;
/** Internal per-card step of playDeal()'s multi-card burst (sounds.ts). */
export const SFX_DEAL_STEP_MS = 70;

// ---- daily-specific match sequence ----------------------------------------
// The daily needs two beats the multiplayer settle does not have: the pair is
// face down when it resolves, so it must flip up and then be held long enough
// to read before the shared ghost treatment plays.
/** Flip-up of the solved pair on the daily board (matches GameCard's flip). */
export const DAILY_MATCH_REVEAL_MS = 500;
/** Beat on the revealed pair before the success animation starts. */
export const DAILY_MATCH_HOLD_MS = 100;
/** Ghost treatment window — the same beat as SETTLE_MATCH_MS in useGameState. */
export const DAILY_MATCH_GREAT_MS = 1300;
/** Whole daily correct-match sequence: reveal → hold → ghost lift and fade. */
export const DAILY_MATCH_SETTLE_MS =
  DAILY_MATCH_REVEAL_MS + DAILY_MATCH_HOLD_MS + DAILY_MATCH_GREAT_MS;

/** Final beat after round 3: the remaining board is shown before the result. */
export const DAILY_FINAL_REVEAL_MS = 1500;

/** Cross-fade between daily screens (ready, gameplay, reveal, result). */
export const DAILY_SCREEN_FADE_MS = 250;


export function applyAnimationTimingVars(root: HTMLElement = document.documentElement): void {
  root.style.setProperty("--ww-great-delay", `${GREAT_MATCH_DELAY_MS}ms`);
  root.style.setProperty("--ww-deal-stagger", `${DEAL_STAGGER_MS}ms`);
  root.style.setProperty("--ww-deal-move", `${DEAL_MOVE_MS}ms`);
}
