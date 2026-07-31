import type { CSSProperties } from "react";

/**
 * Literal brand hues as authored in the source art. These are the values the
 * SVGs and the intro Lottie ship with, and the fallbacks for the themed CSS
 * variables. Use these wherever a real hex is required (contrast maths,
 * canvas, stored theme values) — never for CSS, which should use `COLORS`.
 */
export const BRAND_HEX = {
  red: "#d72229",
  redHover: "#b81b20",
  blue: "#0072b2",
  blueHover: "#005a8f",
  orange: "#e79024",
  orangeHover: "#c47618",
} as const;

export const COLORS = {
  // UI surface (window/content backgrounds)
  surface: "#F8F2E9",
  surfaceHover: "#e8e0d4",
  panel: "#D0C3AF",
  panelMuted: "#ADA290",
  panelMutedHover: "#bdb5a4",
  // Ink ramp: ink (strong text), inkMuted (secondary/subtle text)
  ink: "#231f20",
  // Darkened from #706662 so it meets WCAG AA (4.5:1) on every surface — including panel (#D0C3AF).
  inkMuted: "#544c4a",
  // Brand hues — themed at runtime via the palette CSS variables. Paper and
  // ink above are fixed and never change with a theme.
  red: `var(--ww-hue-1, ${BRAND_HEX.red})`,
  redHover: `var(--ww-hue-1-hover, ${BRAND_HEX.redHover})`,
  blue: `var(--ww-hue-2, ${BRAND_HEX.blue})`,
  blueHover: `var(--ww-hue-2-hover, ${BRAND_HEX.blueHover})`,
  orange: `var(--ww-hue-3, ${BRAND_HEX.orange})`,
  orangeHover: `var(--ww-hue-3-hover, ${BRAND_HEX.orangeHover})`,
  success: "#59cd90",
  successHover: "#4ab87d",
  // Theme background (backs the "Off-White" theme swatch — distinct from `surface`, the UI background)
  offWhite: "#fef9f0",
  // Play-mode accent tints used on the "How do you want to play?" screen.
  soloTint: "#97DAFF",
  peepsTint: "#FFC1C3",
} as const;


export const BORDER = {
  standard: `1.5px solid ${COLORS.ink}`,
  heavy: `2px solid ${COLORS.ink}`,
} as const;

export const RADIUS = {
  sm: 4,
  md: 6,
  lg: 8,
} as const;

export const SPACE = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
  6: 12,
  7: 14,
  8: 16,
  10: 20,
  12: 24,
  14: 28,
  16: 32,
} as const;

export const SHADOW = {
  windowFocused: "4px 6px 0 rgba(0,0,0,0.3)",
  windowUnfocused: "3px 4px 0 rgba(0,0,0,0.15)",
} as const;

export const MOTION = {
  fast: "150ms ease-out",
  base: "250ms ease-out",
  slow: "400ms ease-in-out",
} as const;

// Background-theme swatches. These are persisted and fed to contrast maths,
// so they must be real hex values, not themed CSS variables.
export const THEME_SWATCHES = [
  { color: BRAND_HEX.red, label: "Red" },
  { color: BRAND_HEX.blue, label: "Blue" },
  { color: BRAND_HEX.orange, label: "Orange" },
  { color: COLORS.offWhite, label: "Off-White" },
  { color: "wild", label: "Wild" },
] as const;

export const FONT_FAMILY = '"Friend", Georgia, "Times New Roman", serif';

export const TEXT = {
  // role: { size, mobileSize, weight, italic, lineHeight }
  caption: { size: 14, mobileSize: 12, weight: 400, italic: false, lineHeight: 1.4 },
  captionItalic: { size: 14, mobileSize: 12, weight: 400, italic: true, lineHeight: 1.4 },
  body: { size: 17, mobileSize: 15, weight: 400, italic: false, lineHeight: 1.55 },
  label: { size: 17, mobileSize: 15, weight: 700, italic: false, lineHeight: 1.3 },
  subhead: { size: 21, mobileSize: 18, weight: 700, italic: false, lineHeight: 1.25 },
  heading: { size: 26, mobileSize: 22, weight: 700, italic: false, lineHeight: 1.2 },
  display: { size: 34, mobileSize: 28, weight: 900, italic: false, lineHeight: 1.1 },
} as const;

export function textStyle(role: keyof typeof TEXT, mobile = false): CSSProperties {
  const t = TEXT[role];
  return {
    fontFamily: FONT_FAMILY,
    fontSize: mobile ? t.mobileSize : t.size,
    fontWeight: t.weight,
    fontStyle: t.italic ? "italic" : "normal",
    lineHeight: t.lineHeight,
  };
}
