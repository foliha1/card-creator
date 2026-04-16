import React from "react";
import { COLORS, BORDER, RADIUS, FONT_FAMILY, MOTION, TYPE } from "@/lib/tokens";

export type ButtonVariant = "primary" | "secondary" | "pill";
export type ButtonTone = "ink" | "red" | "blue" | "orange" | "neutral" | "muted";
export type ButtonSize = "sm" | "md" | "lg";

interface AppButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  active?: boolean;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

const TONE_MAP: Record<ButtonTone, { bg: string; hoverBg: string; fg: string }> = {
  ink:     { bg: COLORS.ink,        hoverBg: COLORS.inkSoft,          fg: COLORS.surface },
  red:     { bg: COLORS.red,        hoverBg: "#b81b20",               fg: COLORS.surface },
  blue:    { bg: COLORS.blue,       hoverBg: "#005a8f",               fg: COLORS.surface },
  orange:  { bg: COLORS.orange,     hoverBg: "#c47618",               fg: COLORS.surface },
  neutral: { bg: COLORS.surface,    hoverBg: COLORS.panelMutedHover,  fg: COLORS.ink },
  muted:   { bg: COLORS.panelMuted, hoverBg: COLORS.panelMutedHover,  fg: COLORS.ink },
};

const SIZE_MAP: Record<ButtonSize, { fontSize: number | string; padding: string }> = {
  sm: { fontSize: TYPE.caption, padding: "6px 12px" },
  md: { fontSize: TYPE.ui, padding: "10px 20px" },
  lg: { fontSize: TYPE.subhead, padding: "12px 24px" },
};

export const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ variant = "primary", tone = "ink", size = "md", active = false, fullWidth = false, disabled, style, onMouseEnter, onMouseLeave, ...rest }, ref) => {
    const [focusVisible, setFocusVisible] = React.useState(false);
    const toneColors = TONE_MAP[tone];
    const sizing = SIZE_MAP[size];
    const isPill = variant === "pill";
    const isSecondary = variant === "secondary";

    const baseBg = isSecondary ? COLORS.surface : toneColors.bg;
    const baseFg = isSecondary ? COLORS.ink : toneColors.fg;
    const hoverBg = isSecondary ? COLORS.panelMutedHover : toneColors.hoverBg;

    const mergedStyle: React.CSSProperties = {
      fontFamily: FONT_FAMILY,
      fontStyle: "italic",
      fontSize: sizing.fontSize,
      padding: sizing.padding,
      borderRadius: isPill ? 999 : RADIUS.md,
      border: BORDER.standard,
      background: active ? hoverBg : baseBg,
      color: baseFg,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transition: `background ${MOTION.fast}`,
      whiteSpace: "nowrap",
      textAlign: "center",
      width: fullWidth ? "100%" : undefined,
      outline: focusVisible ? `2px solid ${COLORS.blue}` : "none",
      outlineOffset: 2,
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        style={mergedStyle}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setFocusVisible(true);
        }}
        onBlur={() => setFocusVisible(false)}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.background = hoverBg;
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.background = active ? hoverBg : baseBg;
          onMouseLeave?.(e);
        }}
        {...rest}
      />
    );
  }
);
AppButton.displayName = "AppButton";
