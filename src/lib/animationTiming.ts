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

export function applyAnimationTimingVars(root: HTMLElement = document.documentElement): void {
  root.style.setProperty("--ww-great-delay", `${GREAT_MATCH_DELAY_MS}ms`);
  root.style.setProperty("--ww-deal-stagger", `${DEAL_STAGGER_MS}ms`);
  root.style.setProperty("--ww-deal-move", `${DEAL_MOVE_MS}ms`);
}
