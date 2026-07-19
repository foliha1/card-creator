import React from "react";
import { COLORS, BORDER, RADIUS, MOTION, FONT_FAMILY, SPACE, THEME_SWATCHES, TYPE } from "@/lib/tokens";
import { useTheme } from "@/lib/theme-context";

const ThemeWindow: React.FC = () => {
  const { bgTheme, setTheme, arcade, toggleArcade } = useTheme();

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      padding: SPACE[5],
      gap: SPACE[6],
      height: "100%",
      justifyContent: "center",
    }}>
      <div style={{ display: "flex", gap: SPACE[5], justifyContent: "center" }}>
        {THEME_SWATCHES.map(({ color, label }) => {
          const isActive = bgTheme === color;
          return (
            <button
              key={color}
              aria-label={label}
              onClick={() => setTheme(color)}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: color === "wild" ? "url(/Whoop_Whoop_Wild.png) center/cover no-repeat" : color,
                border: isActive ? BORDER.heavy : BORDER.standard,
                boxShadow: isActive ? `inset 0 0 0 3px ${COLORS.surface}` : "none",
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

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE[4],
        paddingTop: SPACE[4],
        borderTop: `1px solid ${COLORS.panel}`,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1] }}>
          <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.ui, color: COLORS.ink, fontWeight: 600 }}>
            Arcade
          </span>
          <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.caption, color: COLORS.inkMuted }}>
            Retro scanline filter.
          </span>
        </div>
        <button
          onClick={toggleArcade}
          aria-pressed={arcade}
          aria-label="Toggle Arcade CRT filter"
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.caption,
            fontWeight: 700,
            letterSpacing: 1,
            padding: `${SPACE[3]}px ${SPACE[6]}px`,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            background: arcade ? COLORS.ink : COLORS.surface,
            color: arcade ? COLORS.surface : COLORS.ink,
            cursor: "pointer",
            transition: `background ${MOTION.fast}, color ${MOTION.fast}`,
            minWidth: 72,
          }}
        >
          {arcade ? "CRT ON" : "CRT OFF"}
        </button>
      </div>
    </div>
  );
};

export default ThemeWindow;
