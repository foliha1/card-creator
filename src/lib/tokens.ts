export const COLORS = {
  surface: "#F8F2E9",
  panel: "#D0C3AF",
  panelMuted: "#ADA290",
  panelMutedHover: "#bdb5a4",
  ink: "#231f20",
  inkSoft: "#3a3637",
  inkMuted: "#706662",
  inverse: "#F8F2E9",
  red: "#d72229",
  blue: "#0072B2",
  orange: "#E79024",
  success: "#59cd90",
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
] as const;

export const FONT_FAMILY = '"Friend", sans-serif';

export const TYPE = {
  caption: 13,
  body: 15,
  ui: 17,
  subhead: 20,
  head: 24,
  display: 28,
} as const;
