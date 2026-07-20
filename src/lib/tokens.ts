import type { CSSProperties } from "react";

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
  // Brand tones + their hover states
  red: "#d72229",
  redHover: "#b81b20",
  blue: "#0072B2",
  blueHover: "#005a8f",
  orange: "#E79024",
  orangeHover: "#c47618",
  success: "#59cd90",
  successHover: "#4ab87d",
  // Theme background (backs the "Off-White" theme swatch — distinct from `surface`, the UI background)
  offWhite: "#fef9f0",
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

export const THEME_SWATCHES = [
  { color: COLORS.red, label: "Red" },
  { color: COLORS.blue, label: "Blue" },
  { color: COLORS.orange, label: "Orange" },
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
