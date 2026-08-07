import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import DailyShapeRule from "@/components/DailyShapeRule";
import { BORDER, COLORS, FONT_FAMILY, RADIUS } from "@/lib/tokens";

const FADE_MS = 200;

const GEIST = '"Geist", "Geist Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

const friend = (size: number, italic = false, scale = 1): React.CSSProperties => ({
  fontFamily: FONT_FAMILY,
  fontSize: Math.round(size * scale),
  fontStyle: italic ? "italic" : "normal",
  fontWeight: 400,
  lineHeight: 1.2,
  color: COLORS.ink,
  margin: 0,
});

const geist = (scale = 1): React.CSSProperties => ({
  fontFamily: GEIST,
  fontSize: Math.round(14 * scale),
  fontWeight: 500,
  lineHeight: 1.35,
  color: COLORS.ink,
  margin: 0,
});

const DIE_CARDS = [
  { label: "Match the NUMBER", src: "/dice/match-number.svg" },
  { label: "Match the SHAPE", src: "/dice/match-shape.svg" },
  { label: "Match the COLOR", src: "/dice/match-color.svg" },
];

/** Type scale steps up once past tablet so the card doesn't read as a phone. */
const useTypeScale = () => {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    const sync = () => setScale(lg.matches ? 1.12 : md.matches ? 1.08 : 1);
    sync();
    md.addEventListener("change", sync);
    lg.addEventListener("change", sync);
    return () => {
      md.removeEventListener("change", sync);
      lg.removeEventListener("change", sync);
    };
  }, []);
  return scale;
};

const DailyHowToPlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [visible, setVisible] = useState(false);
  const scale = useTypeScale();

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);


  const handleClose = () => {
    setVisible(false);
    window.setTimeout(onClose, FADE_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to Play"
      onClick={handleClose}
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
        justifyContent: "space-between",
        alignItems: "center",
        gap: 24,
        overflowY: "auto",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        "--daily-content-max-width": "402px",
        "--daily-content-padding-x": "24px",
      } as React.CSSProperties}
    >
      <DailyShapeRule />

      <div
        className="daily-howto-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
          background: COLORS.panel,
          borderRadius: RADIUS.sm,
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
          flex: "0 1 auto",
        }}
      >
        <button
          type="button"
          aria-label="Close how to play"
          onClick={handleClose}
          style={{
            alignSelf: "flex-end",
            background: "transparent",
            border: "none",
            padding: 10,
            margin: -10,
            cursor: "pointer",
            color: COLORS.ink,
            display: "inline-flex",
          }}
        >
          <X size={24} strokeWidth={2.5} />
        </button>

        <h2 style={friend(36, true, scale)}>How to Play</h2>

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={friend(24, false, scale)}>Find 3 matching pairs from memory.</h3>
          <ul style={{ ...geist(scale), margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, listStyleType: "disc", color: COLORS.ink }}>
            <li>All cards show for 10 seconds. Study them.</li>
            <li>The cards flip over. Then the die decides what a match means.</li>
            <li>Tap two cards to call a match. Tap the same card again to change your mind.</li>
          </ul>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={friend(24, false, scale)}>The Die:</h3>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 15,
              width: "100%",
            }}
          >
            {DIE_CARDS.map(({ label, src }) => (
              <div
                key={label}
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  maxWidth: "var(--howto-die-max, 100px)",
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
                <img
                  src={src}
                  alt={label}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </div>
            ))}
          </div>
          <p style={geist(scale)}>
            The die rolls again after every round. The cards do not move. What matters about them does.
          </p>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={friend(24, false, scale)}>Three Rounds:</h3>
          <ul style={{ ...geist(scale), margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, listStyleType: "disc", color: COLORS.ink }}>
            <li>Solve a round and that pair leaves the board. Nine cards, then seven, then five.</li>
            <li>Two misses ends a round. Those cards stay where they are.</li>
            <li>One Peek per game shows the board for 5 seconds. It shows up in your score.</li>
            <li>After round three, everything left flips face up.</li>
          </ul>
        </section>

        <p className="daily-howto-outro" style={{ ...friend(20, false, scale), whiteSpace: "pre-line" }}>
          {"A new game drops every day at midnight.\nSign up for the daily reminder email."}
        </p>
      </div>

      <DailyShapeRule />
    </div>
  );
};

export default DailyHowToPlay;
