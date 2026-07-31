import React from "react";
import { BORDER, COLORS, FONT_FAMILY, RADIUS } from "@/lib/tokens";
import { usePalette } from "@/lib/palette";
import { prepareArt } from "@/lib/artTheme";

/**
 * Colour-theme picker. Swaps the three brand hues everywhere — UI, card art,
 * dice art and the intro animation. Paper and ink never change.
 */
const ThemePicker: React.FC = () => {
  const { palettes, paletteId, setPaletteId } = usePalette();

  return (
    <div>
      <p
        style={{
          margin: "0 0 8px",
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: COLORS.inkMuted,
        }}
      >
        Colour theme
      </p>
      <div role="radiogroup" aria-label="Colour theme" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {palettes.map((p) => {
          const active = p.id === paletteId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onMouseEnter={() => void prepareArt(p)}
              onFocus={() => void prepareArt(p)}
              onClick={() => {
                void prepareArt(p);
                setPaletteId(p.id);
              }}
              style={{
                all: "unset",
                cursor: "pointer",
                boxSizing: "border-box",
                minHeight: 44,
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                border: BORDER.heavy,
                borderRadius: RADIUS.sm,
                background: active ? COLORS.panel : "transparent",
                fontFamily: FONT_FAMILY,
                fontSize: 16,
                color: COLORS.ink,
              }}
            >
              <span>{p.label}</span>
              <span style={{ display: "flex", gap: 4 }} aria-hidden="true">
                {[p.hue1, p.hue2, p.hue3].map((c) => (
                  <span
                    key={c}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: c,
                      border: `2px solid ${COLORS.ink}`,
                      boxSizing: "border-box",
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemePicker;
