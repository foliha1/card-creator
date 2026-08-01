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

/* ------------------------------------------------------------------ *
 * Controls — one source of truth for every tappable thing.
 * ------------------------------------------------------------------ */

/** Minimum touch target (WCAG 2.5.5 / iOS HIG). Never go below this. */
export const TOUCH_MIN = 44;

export const CONTROL_H = {
  sm: 36,
  md: 44,
  lg: 52,
} as const;

export const CONTROL_PAD_X = {
  sm: SPACE[6],
  md: SPACE[8],
  lg: SPACE[10],
} as const;

export type ButtonVariant =
  | "primary"     // main forward action (red)
  | "secondary"   // alternate forward action (blue)
  | "accent"      // playful / start (orange)
  | "neutral"     // low-emphasis on cream surfaces
  | "ghost"       // text-only
  | "danger";     // destructive (leave / quit)

const BUTTON_PALETTE: Record<ButtonVariant, { bg: string; bgHover: string; fg: string; border: string }> = {
  primary:   { bg: COLORS.red,        bgHover: COLORS.redHover,        fg: COLORS.surface, border: BORDER.heavy },
  secondary: { bg: COLORS.blue,       bgHover: COLORS.blueHover,       fg: COLORS.surface, border: BORDER.heavy },
  accent:    { bg: COLORS.orange,     bgHover: COLORS.orangeHover,     fg: COLORS.ink,     border: BORDER.heavy },
  neutral:   { bg: COLORS.panel,      bgHover: COLORS.panelMutedHover, fg: COLORS.ink,     border: BORDER.heavy },
  ghost:     { bg: "transparent",     bgHover: COLORS.surfaceHover,    fg: COLORS.ink,     border: "none" },
  danger:    { bg: COLORS.red,        bgHover: COLORS.redHover,        fg: COLORS.surface, border: BORDER.heavy },
};

/** Hover background for a variant — pair with `buttonStyle` on pointer events. */
export function buttonHoverBg(variant: ButtonVariant): string {
  return BUTTON_PALETTE[variant].bgHover;
}

/**
 * Canonical button surface. Size drives height + horizontal padding; variant
 * drives colour. Text role is fixed to `label` so buttons never drift.
 */
export function buttonStyle(
  variant: ButtonVariant = "primary",
  size: keyof typeof CONTROL_H = "md",
  opts: { mobile?: boolean; fullWidth?: boolean; disabled?: boolean } = {},
): CSSProperties {
  const p = BUTTON_PALETTE[variant];
  return {
    ...textStyle("label", opts.mobile),
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE[4],
    width: opts.fullWidth ? "100%" : undefined,
    minHeight: Math.max(CONTROL_H[size], size === "sm" ? CONTROL_H.sm : TOUCH_MIN),
    padding: `0 ${CONTROL_PAD_X[size]}px`,
    background: p.bg,
    color: p.fg,
    border: p.border,
    borderRadius: RADIUS.sm,
    cursor: opts.disabled ? "not-allowed" : "pointer",
    opacity: opts.disabled ? 0.5 : 1,
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: `background ${MOTION.fast}, opacity ${MOTION.fast}, transform ${MOTION.fast}`,
  };
}

/** Square icon button — always a full touch target. */
export function iconButtonStyle(
  variant: ButtonVariant = "ghost",
  size: number = TOUCH_MIN,
): CSSProperties {
  const p = BUTTON_PALETTE[variant];
  return {
    boxSizing: "border-box",
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    background: p.bg,
    color: p.fg,
    border: p.border,
    borderRadius: RADIUS.sm,
    cursor: "pointer",
    transition: `background ${MOTION.fast}`,
  };
}

/** Cream card/panel surface used by every pre-game section. */
export function panelStyle(
  tone: "surface" | "panel" = "surface",
  pad: keyof typeof SPACE = 8,
): CSSProperties {
  return {
    boxSizing: "border-box",
    background: tone === "surface" ? COLORS.surface : COLORS.panel,
    border: BORDER.heavy,
    borderRadius: RADIUS.md,
    padding: SPACE[pad],
  };
}

