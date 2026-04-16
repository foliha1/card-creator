import React from "react";
import { COLORS, BORDER, RADIUS, MOTION, FONT_FAMILY, SPACE, THEME_SWATCHES } from "@/lib/tokens";
import { useTheme } from "@/lib/theme-context";

const ThemeWindow: React.FC = () => {
  const { bgTheme, setTheme } = useTheme();

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: SPACE[8],
      gap: SPACE[6],
    }}>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontStyle: "normal",
          fontSize: 10,
          color: COLORS.inkMuted,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        BACKGROUND
      </div>

      <div style={{ display: "flex", gap: SPACE[10], justifyContent: "center" }}>
        {THEME_SWATCHES.map(({ color, label }) => {
          const isActive = bgTheme === color;
          return (
            <button
              key={color}
              aria-label={label}
              onClick={() => setTheme(color)}
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: color,
                border: isActive ? BORDER.heavy : BORDER.standard,
                boxShadow: isActive ? `inset 0 0 0 4px ${COLORS.surface}` : "none",
                cursor: "pointer",
                transition: `transform ${MOTION.fast}`,
                padding: 0,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            />
          );
        })}
      </div>

      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontStyle: "italic",
          fontSize: 12,
          color: COLORS.inkMuted,
          textAlign: "center",
        }}
      >
        Pick a vibe. The whole desktop follows.
      </div>
    </div>
  );
};

export default ThemeWindow;
