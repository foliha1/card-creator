import React from "react";

const AboutWindow: React.FC = () => {
  return (
    <div
      style={{
        background: "#f8f2e9",
        padding: 24,
        textAlign: "left",
        overflowY: "auto",
        height: "100%",
      }}
    >
      <img src="/WhoopWhoop_Stacked_Logo.svg" alt="Whoop Whoop" style={{ height: 40, marginBottom: 14 }} />
      <div style={{ fontFamily: '"Friend", serif', fontStyle: "italic", fontSize: 18, color: "#231f20", marginBottom: 12 }}>
        From Oleeha &amp; Co
      </div>
      <p style={{ fontSize: 13, color: "#231f20", opacity: 0.75, lineHeight: 1.6, margin: "0 0 12px" }}>
        WHOOP! WHOOP! is a competitive memory card game where the matching rules change every round. Players flip face-down cards, memorize positions, and race to call out matching pairs. What counts as a match shifts constantly via dice rolls, forcing you to reorganize your mental map on the fly.
      </p>
      <p style={{ fontSize: 13, color: "#231f20", opacity: 0.75, lineHeight: 1.6, margin: "0 0 16px" }}>
        Designed for 2–6 players, ages 7+, 15–20 minute play time. Three tiers mean everyone can play.
      </p>
      <a
        href="#"
        style={{
          color: "#0072b2",
          fontStyle: "italic",
          fontSize: 13,
          textDecoration: "underline",
        }}
      >
        Learn more →
      </a>
    </div>
  );
};

export default AboutWindow;
