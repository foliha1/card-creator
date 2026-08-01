/**
 * Subtle mobile haptic feedback.
 *
 * Uses the Vibration API, which is only meaningfully supported on mobile
 * browsers (Android Chrome et al). On unsupported platforms (iOS Safari,
 * desktop) every call is a silent no-op, so callers never need to guard.
 *
 * Patterns are intentionally short — this is a tap confirmation, not an alert.
 */

type Pattern = number | number[];

const canVibrate = (): boolean => {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  // Respect users who ask for reduced motion — a buzzing phone is motion too.
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    // Only fire on touch-first devices; avoids odd behaviour on hybrid laptops.
    if (!window.matchMedia("(pointer: coarse)").matches) return false;
  }
  return true;
};

const buzz = (pattern: Pattern) => {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* vibration is best-effort; never let it break an interaction */
  }
};

/** Standard button / card tap. */
export const hapticTap = () => buzz(8);

/** Slightly firmer confirmation: dice roll, WHOOP claim. */
export const hapticImpact = () => buzz(16);

/** Positive outcome: great match. */
export const hapticSuccess = () => buzz([10, 40, 18]);

/** Negative outcome: wrong claim / penalty. */
export const hapticError = () => buzz([22, 50, 22]);
