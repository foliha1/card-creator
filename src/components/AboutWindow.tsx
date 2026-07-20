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
    lineHeight: 1.42,
    margin: 0,
    maxWidth: 440,
  };

  const sectionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: SPACE[1],
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        gap: mobile ? SPACE[4] : SPACE[5],
        padding: mobile ? SPACE[6] : SPACE[10],
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div style={sectionStyle}>
        <img
          src="/WhoopWhoop_Dark_Logo.svg"
          alt="Whoop Whoop"
          style={{ height: 40, display: "block" }}
        />
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontSize: mobile ? MOBILE_TYPE.subhead : TYPE.subhead,
            color: COLORS.ink,
          }}
        >
          A memory game where the rules keep changing.
        </div>
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontSize: mobile ? MOBILE_TYPE.body : TYPE.body,
            color: COLORS.inkMuted,
          }}
        >
          Luck, memory, and just enough competition to ruin a family dinner.
        </div>
      </div>

      <div style={sectionStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: mobile ? "wrap" : "nowrap",
            gap: SPACE[3],
          }}
        >
          <span style={chipStyle}>2–6 players</span>
          <span style={chipStyle}>Ages 7+</span>
          <span style={chipStyle}>15–20 min</span>
        </div>

        <p style={bodyStyle}>
          Flip a card, remember what's on it, and race to call the pairs. A die decides what a match even means — same shape, same number, same color — and it changes its mind every round. Your brain has to keep up.
        </p>
        <p style={bodyStyle}>
          This is a playable preview of the real thing — a physical card game meant for a table full of people. Here you're playing a quick round against a single opponent, but WHOOP! WHOOP! comes alive with 3, 4, 5, or 6 players all shouting over each other. That's where it's meant to be played.
        </p>
      </div>

      <div style={{ ...sectionStyle, marginTop: "auto" }}>
        <div
          style={{
            width: "100%",
            borderTop: `1px solid ${COLORS.panelMuted}`,
            opacity: 0.4,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE[3],
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
    </div>
  );
};

export default AboutWindow;
