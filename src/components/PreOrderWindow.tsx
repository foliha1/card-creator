import React from "react";
import { COLORS, FONT_FAMILY, RADIUS } from "@/lib/tokens";

const PreOrderWindow: React.FC = () => {
  return (
    <div
      style={{
        background: COLORS.surface,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: FONT_FAMILY, fontStyle: "italic", fontSize: 22, color: COLORS.ink }}>
        Get the physical game
      </div>
      <div style={{ fontSize: 13, color: COLORS.ink, opacity: 0.55, maxWidth: 280, marginTop: 10, lineHeight: 1.5 }}>
        48 cards, 2 match dice, and enough competition to ruin your family dinner.
      </div>
      <button
        style={{
          marginTop: 28,
          background: COLORS.red,
          color: COLORS.surface,
          fontFamily: FONT_FAMILY,
          fontStyle: "italic",
          fontSize: 16,
          padding: "12px 28px",
          borderRadius: RADIUS.sm,
          border: "none",
          cursor: "pointer",
        }}
      >
        Pre-Order Now
      </button>
      <div style={{ fontSize: 11, color: COLORS.ink, opacity: 0.35, marginTop: 14 }}>
        Coming soon — Oleeha &amp; Co
      </div>
    </div>
  );
};

export default PreOrderWindow;
