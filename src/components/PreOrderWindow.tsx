import React from "react";
import { COLORS, SPACE, textStyle } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";
import { useIsMobile } from "@/hooks/use-mobile";

const PreOrderWindow: React.FC = () => {
  const mobile = useIsMobile();
  return (
    <div
      style={{
        padding: mobile ? SPACE[6] : SPACE[14],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        textAlign: "center",
      }}
    >
      <div style={{ ...textStyle("heading", mobile), fontStyle: "italic", color: COLORS.ink }}>
        Get the physical game
      </div>
      <div style={{ ...textStyle("body", mobile), color: COLORS.inkMuted, maxWidth: 280, marginTop: SPACE[5], lineHeight: 1.5 }}>
        48 cards, 2 match dice, and enough competition to ruin your family dinner.
      </div>
      <AppButton
        variant="primary"
        tone="red"
        size="md"
        style={{ marginTop: mobile ? SPACE[8] : SPACE[14] }}
      >
        Pre-Order Now
      </AppButton>
      <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted, marginTop: SPACE[7] }}>
        Coming soon — Oleeha &amp; Co
      </div>
    </div>
  );
};

export default PreOrderWindow;

