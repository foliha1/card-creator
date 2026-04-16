import React from "react";
import { COLORS, BORDER, RADIUS, MOTION, FONT_FAMILY, SPACE, THEME_SWATCHES, TYPE } from "@/lib/tokens";
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
      padding: SPACE[6],
      gap: SPACE[6],
    }}>

      <div style={{ display: "flex", gap: SPACE[6], justifyContent: "center" }}>
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
                background: color === "wild" ? "url(/Whoop_Whoop_Wild.png) center/cover no-repeat" : color,
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

    </div>
  );
};

export default ThemeWindow;
