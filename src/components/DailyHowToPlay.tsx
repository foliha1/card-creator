import React from "react";
import { X } from "lucide-react";
import DailyShapeRule from "@/components/DailyShapeRule";
import { BORDER, COLORS, FONT_FAMILY, RADIUS } from "@/lib/tokens";

const GEIST = '"Geist", "Geist Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

const friend = (size: number, italic = false): React.CSSProperties => ({
  fontFamily: FONT_FAMILY,
  fontSize: size,
  fontStyle: italic ? "italic" : "normal",
  fontWeight: 400,
  lineHeight: 1.2,
  color: COLORS.ink,
  margin: 0,
});

const geist = (): React.CSSProperties => ({
  fontFamily: GEIST,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.2,
  color: COLORS.ink,
  margin: 0,
});

const DIE_CARDS = ["Match the NUMBER", "Match the SHAPE", "Match the COLOR"];

const DailyHowToPlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="How to Play"
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      background: COLORS.surface,
      padding: 24,
      paddingBottom: `calc(24px + env(safe-area-inset-bottom))`,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 24,
      overflowY: "auto",
      "--daily-content-max-width": "402px",
      "--daily-content-padding-x": "24px",
    } as React.CSSProperties}
  >
    <DailyShapeRule />

    <div
      style={{
        width: "100%",
        maxWidth: 402,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        textAlign: "left",
        flex: "1 0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <h2 style={friend(36)}>How to Play</h2>
        <button
          type="button"
          aria-label="Close how to play"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            padding: 10,
            margin: -10,
            cursor: "pointer",
            color: COLORS.red,
            display: "inline-flex",
          }}
        >
          <X size={24} strokeWidth={2.5} />
        </button>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={friend(24)}>Find 3 matching pairs from memory.</h3>
        <ul style={{ ...geist(), margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, listStyleType: "disc", color: COLORS.ink }}>
          <li>All cards show for 10 seconds. Study them.</li>
          <li>The cards flip over. Then the die decides what a match means.</li>
          <li>Tap WHOOP! WHOOP!, then tap two cards.</li>
        </ul>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={friend(24)}>The Die:</h3>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 15,
            width: "100%",
          }}
        >
          {DIE_CARDS.map((label) => (
            <div
              key={label}
              style={{
                flex: "1 1 0",
                minWidth: 0,
                maxWidth: 100,
                aspectRatio: "1 / 1",
                background: "#FFFFFF",
                border: BORDER.heavy,
                borderRadius: RADIUS.lg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                boxSizing: "border-box",
              }}
            >
              <span style={{ ...friend(24), fontSize: "clamp(15px, 5vw, 24px)", textAlign: "center" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <p style={geist()}>
          The die rolls again after every round. The cards do not move. What matters about them does.
        </p>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={friend(24)}>Three Rounds:</h3>
        <p style={geist()}>
          Each round takes one pair off the board. Nine cards, then seven, then five. Two misses ends
          a round. One Peek per game shows the board for 5 seconds. It shows up in your score.
        </p>
      </section>

      <p style={friend(24)}>
        A new game drops every day at midnight. Sign up for the daily reminder email.
      </p>
    </div>

    <DailyShapeRule />
  </div>
);

export default DailyHowToPlay;
