import React from "react";
import { COLORS, FONT_FAMILY, SPACE, TYPE, MOBILE_TYPE } from "@/lib/tokens";
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
      <div style={{ fontFamily: FONT_FAMILY, fontStyle: "italic", fontSize: mobile ? MOBILE_TYPE.head : TYPE.head, color: COLORS.ink }}>
        Get the physical game
      </div>
      <div style={{ fontFamily: FONT_FAMILY, fontStyle: "normal", fontSize: mobile ? MOBILE_TYPE.body : TYPE.body, color: COLORS.inkMuted, maxWidth: 280, marginTop: SPACE[5], lineHeight: 1.5 }}>
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
      <div style={{ fontFamily: FONT_FAMILY, fontStyle: "normal", fontSize: mobile ? MOBILE_TYPE.caption : TYPE.caption, color: COLORS.inkMuted, marginTop: SPACE[7] }}>
        Coming soon — Oleeha &amp; Co
      </div>
    </div>
  );
};

export default PreOrderWindow;
