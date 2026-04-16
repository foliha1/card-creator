import React from "react";
import { COLORS, FONT_FAMILY, SPACE, TYPE } from "@/lib/tokens";

const AboutWindow: React.FC = () => {
  return (
    <div
      style={{
        background: COLORS.surface,
        padding: SPACE[12],
        textAlign: "left",
        overflowY: "auto",
        height: "100%",
      }}
    >
      <img src="/WhoopWhoop_Dark_Logo.svg" alt="Whoop Whoop" style={{ height: 40, marginBottom: SPACE[7] }} />
      <div style={{ fontFamily: FONT_FAMILY, fontStyle: "italic", fontSize: TYPE.subhead, color: COLORS.ink, marginBottom: SPACE[6] }}>
        From Oleeha &amp; Co
      </div>
      <p style={{ fontSize: TYPE.body, color: COLORS.ink, opacity: 0.75, lineHeight: 1.6, margin: "0 0 12px" }}>
        WHOOP! WHOOP! is a competitive memory card game where the matching rules change every round. Players flip face-down cards, memorize positions, and race to call out matching pairs. What counts as a match shifts constantly via dice rolls, forcing you to reorganize your mental map on the fly.
      </p>
      <p style={{ fontSize: TYPE.body, color: COLORS.ink, opacity: 0.75, lineHeight: 1.6, margin: "0 0 16px" }}>
        Designed for 2–6 players, ages 7+, 15–20 minute play time. Three tiers mean everyone can play.
      </p>
      <a
        href="#"
        style={{
          color: COLORS.blue,
          fontStyle: "italic",
          fontSize: TYPE.body,
          textDecoration: "underline",
        }}
      >
        Learn more →
      </a>
    </div>
  );
};

export default AboutWindow;
