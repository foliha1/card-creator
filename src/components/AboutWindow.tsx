import React from "react";
import { COLORS, FONT_FAMILY, TYPE, MOBILE_TYPE, SPACE, RADIUS, BORDER } from "@/lib/tokens";
import { useIsMobile } from "@/hooks/use-mobile";

const AboutWindow: React.FC = () => {
  const mobile = useIsMobile();

  const chipStyle: React.CSSProperties = {
    backgroundColor: COLORS.surface,
    border: BORDER.standard,
    borderRadius: RADIUS.md,
    padding: `${SPACE[3]} ${SPACE[4]}`,
    fontFamily: FONT_FAMILY,
    fontStyle: "normal",
    fontSize: TYPE.caption,
    color: COLORS.inkSoft,
    whiteSpace: "nowrap",
  };

  const bodyStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontStyle: "normal",
    fontSize: mobile ? MOBILE_TYPE.body : TYPE.body,
    color: COLORS.inkSubtle,
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 440,
  };

  return (
    <div
      style={{
        padding: mobile ? SPACE[6] : SPACE[12],
        textAlign: "left",
        height: "100%",
      }}
    >
      <img
        src="/WhoopWhoop_Dark_Logo.svg"
        alt="Whoop Whoop"
        style={{ height: 44, marginBottom: SPACE[7], display: "block" }}
      />

      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontStyle: "italic",
          fontSize: mobile ? MOBILE_TYPE.subhead : TYPE.subhead,
          color: COLORS.ink,
          marginBottom: SPACE[3],
        }}
      >
        A memory game where the rules keep changing.
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontStyle: "italic",
          fontSize: TYPE.body,
          color: COLORS.inkMuted,
          marginBottom: SPACE[7],
        }}
      >
        Luck, memory, and just enough competition to ruin a family dinner.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: mobile ? "wrap" : "nowrap",
          gap: SPACE[3],
          marginTop: SPACE[7],
          marginBottom: SPACE[7],
        }}
      >
        <span style={chipStyle}>2–6 players</span>
        <span style={chipStyle}>Ages 7+</span>
        <span style={chipStyle}>15–20 min</span>
      </div>

      <p style={{ ...bodyStyle, marginBottom: SPACE[4] }}>
        Flip a card, remember what's on it, and race to call the pairs. Two dice decide what a match even means — same shape, same number, same color — and they change their mind every round. Your brain has to keep up.
      </p>
      <p style={{ ...bodyStyle, marginBottom: SPACE[7] }}>
        Across the table sits Auntie O., the family card shark who never forgets a card. Usually. Beat her to the WHOOP! and the pair is yours.
      </p>

      <div
        style={{
          width: "100%",
          borderTop: `1px solid ${COLORS.panelMuted}`,
          opacity: 0.4,
          marginTop: SPACE[7],
          marginBottom: SPACE[7],
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE[3],
          marginBottom: SPACE[7],
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            backgroundColor: COLORS.red,
            border: BORDER.standard,
            borderRadius: RADIUS.sm,
          }}
        />
        <div
          style={{
            width: 16,
            height: 16,
            backgroundColor: COLORS.blue,
            border: BORDER.standard,
            borderRadius: RADIUS.sm,
          }}
        />
        <div
          style={{
            width: 16,
            height: 16,
            backgroundColor: COLORS.orange,
            border: BORDER.standard,
            borderRadius: RADIUS.sm,
          }}
        />
        <span
          style={{
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontSize: TYPE.caption,
            color: COLORS.inkMuted,
            marginLeft: SPACE[2],
          }}
        >
          An Oleeha &amp; Co game.
        </span>
      </div>

      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontStyle: "normal",
          fontSize: TYPE.caption,
          color: COLORS.inkMuted,
        }}
      >
        WHOOP! WHOOP! · v6.0 Dice Edition
      </div>
    </div>
  );
};

export default AboutWindow;
