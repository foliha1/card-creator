import React from "react";
import { COLORS, FONT_FAMILY, SPACE, TYPE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";

const PreOrderWindow: React.FC = () => {
  return (
    <div
      style={{
        background: COLORS.surface,
        padding: SPACE[14],
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
      <div style={{ fontSize: 13, color: COLORS.ink, opacity: 0.55, maxWidth: 280, marginTop: SPACE[5], lineHeight: 1.5 }}>
        48 cards, 2 match dice, and enough competition to ruin your family dinner.
      </div>
      <AppButton
        variant="primary"
        tone="red"
        size="md"
        style={{ marginTop: SPACE[14] }}
      >
        Pre-Order Now
      </AppButton>
      <div style={{ fontSize: 11, color: COLORS.ink, opacity: 0.35, marginTop: SPACE[7] }}>
        Coming soon — Oleeha &amp; Co
      </div>
    </div>
  );
};

export default PreOrderWindow;