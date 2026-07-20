// WCAG contrast utilities. Brand colors are never mutated; these helpers only
// pick or nudge FOREGROUND colors so text stays readable on any background.

export type RGB = { r: number; g: number; b: number };

function parseHex(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function parseColor(input: string): RGB {
  if (!input) return { r: 0, g: 0, b: 0 };
  if (input.startsWith("#")) return parseHex(input);
  const m = input.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(",").map((s) => parseFloat(s.trim()));
    return { r, g, b };
  }
  // fallback (e.g. "wild", named colors we don't parse) — treat as mid gray
  return { r: 128, g: 128, b: 128 };
}

function relLuminance({ r, g, b }: RGB): number {
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** WCAG contrast ratio between two colors. */
export function contrastRatio(fg: string, bg: string): number {
  const L1 = relLuminance(parseColor(fg));
  const L2 = relLuminance(parseColor(bg));
  const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
}

/** WCAG AA thresholds: 4.5 for normal text, 3.0 for large/UI. */
export function meetsAA(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? 3 : 4.5);
}

/**
 * Pick the first candidate that meets AA against `bg`. If none pass,
 * returns the candidate with the highest contrast so text stays as
 * readable as possible without changing the brand background.
 */
export function pickReadable(bg: string, candidates: string[], large = false): string {
  const target = large ? 3 : 4.5;
  let best = candidates[0];
  let bestRatio = 0;
  for (const c of candidates) {
    const r = contrastRatio(c, bg);
    if (r >= target) return c;
    if (r > bestRatio) {
      bestRatio = r;
      best = c;
    }
  }
  return best;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/**
 * Return `fg` if it already meets AA on `bg`; otherwise blend it toward
 * black or white (whichever direction improves contrast) until AA is met.
 * Hue is preserved as much as possible so brand character stays intact.
 */
export function ensureAA(fg: string, bg: string, large = false): string {
  if (meetsAA(fg, bg, large)) return fg;
  const target = large ? 3 : 4.5;
  const bgLum = relLuminance(parseColor(bg));
  const towards: RGB = bgLum > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const base = parseColor(fg);
  let lo = 0;
  let hi = 1;
  let out = towards;
  // 12 iterations of binary search is plenty for 8-bit color.
  for (let i = 0; i < 12; i++) {
    const t = (lo + hi) / 2;
    const candidate = mix(base, towards, t);
    if (relLuminance(candidate) === bgLum) {
      lo = t;
      continue;
    }
    const ratio = contrastRatio(toHex(candidate), bg);
    out = candidate;
    if (ratio >= target) hi = t;
    else lo = t;
  }
  // Ensure we return a version that actually passes (fall back to extreme).
  const hex = toHex(out);
  return meetsAA(hex, bg, large) ? hex : toHex(towards);
}
