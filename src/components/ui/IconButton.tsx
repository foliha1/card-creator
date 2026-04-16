import React from "react";
import { COLORS, MOTION, RADIUS } from "@/lib/tokens";

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  tone?: "default" | "close";
  size?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tone = "default", size = 44, style, onMouseEnter, onMouseLeave, children, ...rest }, ref) => {
    const [focusVisible, setFocusVisible] = React.useState(false);
    const isClose = tone === "close";

    const baseColor = COLORS.ink;
    const hoverColor = isClose ? COLORS.red : COLORS.ink;
    const baseOpacity = isClose ? 1 : 0.5;
    const hoverOpacity = 1;

    const mergedStyle: React.CSSProperties = {
      background: "transparent",
      color: baseColor,
      border: "none",
      cursor: "pointer",
      padding: 0,
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: baseOpacity,
      transition: `opacity ${MOTION.fast}, color ${MOTION.fast}`,
      flexShrink: 0,
      outline: focusVisible ? `2px solid ${COLORS.blue}` : "none",
      outlineOffset: 2,
      borderRadius: isClose ? RADIUS.sm : "50%",
      ...style,
    };

    return (
      <button
        ref={ref}
        style={mergedStyle}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setFocusVisible(true);
        }}
        onBlur={() => setFocusVisible(false)}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = String(hoverOpacity);
          e.currentTarget.style.color = hoverColor;
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = String(baseOpacity);
          e.currentTarget.style.color = baseColor;
          onMouseLeave?.(e);
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";